/**
 * RumiField Analytics — event bus + batcher.
 *
 * Design:
 * - Single event bus. Never call Supabase/PostHog directly from components.
 * - Events are enriched with session/user/route/device metadata automatically.
 * - Flushed in batches (10s or 20 events) via fetch keepalive; sendBeacon on unload.
 * - Never sends raw form values / PII — only field names, types, sizes, flags.
 */

import { supabase } from "@/integrations/supabase/client";

// ---------- Types ----------

export type AnalyticsEvent = {
  occurred_at: string;
  event_name: string;
  screen?: string | null;
  entity?: string | null;
  entity_id?: string | null;
  properties?: Record<string, unknown>;
};

type EnrichedEvent = AnalyticsEvent & {
  user_id: string | null;
  session_id: string;
  app_version: string;
  device: Record<string, unknown>;
};

// ---------- Session ----------

const SESSION_STORAGE_KEY = "rf_analytics_session";
const SESSION_MAX_IDLE_MS = 30 * 60 * 1000; // 30 minutes

type SessionState = {
  id: string;
  startedAt: number;
  lastActivityAt: number;
};

function loadOrCreateSession(): SessionState {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionState;
      if (Date.now() - parsed.lastActivityAt < SESSION_MAX_IDLE_MS) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const s: SessionState = {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
  return s;
}

let session: SessionState = loadOrCreateSession();

function touchSession() {
  session.lastActivityAt = Date.now();
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function getSessionId(): string {
  return session.id;
}

export function getSessionStartedAt(): number {
  return session.startedAt;
}

export function rotateSession(): string {
  session = {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
  return session.id;
}

// ---------- User identity ----------

let currentUserId: string | null = null;
let currentRole: string | null = null;

export function identifyUser(userId: string | null, role?: string | null) {
  currentUserId = userId;
  currentRole = role ?? null;
}

// ---------- Route ----------

let currentScreen: string | null = null;
export function setCurrentScreen(screen: string | null) {
  currentScreen = screen;
}

// ---------- Device ----------

function buildDeviceInfo(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  return {
    ua: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dpr: window.devicePixelRatio,
    online: navigator.onLine,
  };
}

const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";

// ---------- Preview / disabled detection ----------

function isDisabledEnvironment(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true; // iframe (Lovable preview)
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.includes("id-preview--") || host.includes("lovableproject.com")) {
    return true;
  }
  return false;
}

const DISABLED = isDisabledEnvironment();

// ---------- Buffer ----------

const BUFFER: EnrichedEvent[] = [];
const MAX_BATCH = 20;
const FLUSH_INTERVAL_MS = 10_000;
let flushTimer: number | null = null;

function enrich(evt: AnalyticsEvent): EnrichedEvent {
  return {
    occurred_at: evt.occurred_at ?? new Date().toISOString(),
    event_name: evt.event_name,
    screen: evt.screen ?? currentScreen,
    entity: evt.entity ?? null,
    entity_id: evt.entity_id ?? null,
    properties: {
      ...(evt.properties ?? {}),
      role: currentRole ?? undefined,
    },
    user_id: currentUserId,
    session_id: session.id,
    app_version: APP_VERSION,
    device: buildDeviceInfo(),
  };
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

async function flush(useBeacon = false): Promise<void> {
  if (BUFFER.length === 0) return;
  const batch = BUFFER.splice(0, BUFFER.length);
  if (DISABLED) return; // drop silently in preview/iframe

  try {
    if (useBeacon && "sendBeacon" in navigator) {
      // Beacon sends unauthenticated — insert only what we can. Prefer direct
      // insert via supabase when a session token exists.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/analytics_events`;
        const blob = new Blob([JSON.stringify(batch)], {
          type: "application/json",
        });
        // sendBeacon cannot set custom headers, so fall back to fetch keepalive.
        void fetch(url, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
            Authorization: `Bearer ${token}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify(batch),
        }).catch(() => {
          // swallow — analytics must not surface errors
        });
      }
      return;
    }

    // Cast: our enriched shape carries `Record<string, unknown>` for
    // properties/device, which the generated Supabase types narrow to `Json`.
    // Values are always JSON-safe here.
    const { error } = await supabase
      .from("analytics_events")
      .insert(batch as unknown as never);
    if (error) {
      // Non-fatal: log and drop. Do not retry aggressively to avoid loops.
      console.warn("[analytics] flush failed", error.message);
    }
  } catch (e) {
    console.warn("[analytics] flush exception", e);
  }
}

// ---------- Public API ----------

export function track(
  eventName: string,
  properties?: Record<string, unknown>,
  extra?: { entity?: string; entity_id?: string; screen?: string }
) {
  if (DISABLED) return;
  touchSession();
  const enriched = enrich({
    occurred_at: new Date().toISOString(),
    event_name: eventName,
    entity: extra?.entity,
    entity_id: extra?.entity_id,
    screen: extra?.screen,
    properties,
  });
  BUFFER.push(enriched);
  if (BUFFER.length >= MAX_BATCH) {
    void flush();
  } else {
    scheduleFlush();
  }
}

export async function flushNow(useBeacon = false) {
  await flush(useBeacon);
}

// ---------- Lifecycle wiring ----------

if (typeof window !== "undefined" && !DISABLED) {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flush(true);
    }
  });
  window.addEventListener("pagehide", () => {
    void flush(true);
  });
  window.addEventListener("beforeunload", () => {
    void flush(true);
  });
}
