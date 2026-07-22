import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  track,
  setCurrentScreen,
  getSessionId,
  getSessionStartedAt,
} from "@/lib/analytics";

/**
 * Emits `screen_viewed` on every route change and `screen_left` with the
 * dwell time when the user navigates away or hides the tab.
 */
export function useScreenTracking() {
  const location = useLocation();
  const enteredAtRef = useRef<number>(Date.now());
  const previousRef = useRef<string | null>(null);

  useEffect(() => {
    const screen = location.pathname;
    const now = Date.now();

    // Emit leave for previous screen
    if (previousRef.current && previousRef.current !== screen) {
      const dwellMs = now - enteredAtRef.current;
      track(
        "screen_left",
        {
          dwell_ms: dwellMs,
          reason: "navigation",
        },
        { screen: previousRef.current }
      );
    }

    setCurrentScreen(screen);
    enteredAtRef.current = now;
    previousRef.current = screen;

    track(
      "screen_viewed",
      {
        search: location.search || undefined,
        referrer_screen: previousRef.current,
      },
      { screen }
    );

    const onHide = () => {
      if (document.visibilityState === "hidden") {
        track(
          "screen_left",
          {
            dwell_ms: Date.now() - enteredAtRef.current,
            reason: "hidden",
          },
          { screen }
        );
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [location.pathname, location.search]);
}

/**
 * Emits `session_started` once and `session_ended` on tab close.
 */
export function useSessionTracking() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    track("session_started", {
      session_id: getSessionId(),
    });

    const onEnd = () => {
      track("session_ended", {
        session_id: getSessionId(),
        duration_ms: Date.now() - getSessionStartedAt(),
        reason: "pagehide",
      });
    };
    window.addEventListener("pagehide", onEnd);
    return () => {
      window.removeEventListener("pagehide", onEnd);
    };
  }, []);
}
