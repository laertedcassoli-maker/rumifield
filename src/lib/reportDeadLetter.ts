import { supabase } from "@/integrations/supabase/client";

export interface DeadLetterContext {
  table: string;
  operation: string;
  retryCount: number;
  errorMessage?: string | null;
  data?: Record<string, unknown>;
}

/**
 * Reports a sync item that exhausted its retry budget.
 * - Best-effort insert into public.sync_dead_letter (RLS scoped by user).
 * - Best-effort Sentry capture (defensive: works only if window.Sentry is wired).
 * - Always logs to console for local visibility.
 */
export async function reportDeadLetter(ctx: DeadLetterContext): Promise<void> {
  const { table, operation, retryCount, errorMessage, data } = ctx;

  // Local visibility — always logged.
  console.error("[sync-dead-letter]", {
    table,
    operation,
    retryCount,
    errorMessage,
  });

  // Sentry: defensive access. If integrated in the future, this fires automatically.
  try {
    const w = window as unknown as {
      Sentry?: {
        captureException?: (e: unknown, ctx?: Record<string, unknown>) => void;
      };
    };
    if (w?.Sentry?.captureException) {
      w.Sentry.captureException(new Error(errorMessage || "sync dead-letter"), {
        extra: { table, operation, retryCount },
        tags: { source: "offline-sync-dead-letter" },
      });
    }
  } catch {
    // ignore Sentry failures
  }

  // Best-effort remote persist. Requires an authenticated session; failures
  // are non-fatal — the local dead-letter store still holds the record.
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;

    const { error } = await supabase.from("sync_dead_letter").insert({
      user_id: userId,
      table_name: table,
      operation,
      payload: (data ?? {}) as never,
      retry_count: retryCount,
      error_message: errorMessage ?? null,
    } as never);

    if (error) {
      console.warn("[sync-dead-letter] remote insert failed", error.message);
    }
  } catch (err) {
    console.warn("[sync-dead-letter] remote insert threw", err);
  }
}
