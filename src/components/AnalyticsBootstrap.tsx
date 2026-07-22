import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { identifyUser } from "@/lib/analytics";
import { useScreenTracking, useSessionTracking } from "@/hooks/useAnalytics";

/**
 * Wires analytics inside the Router + AuthProvider tree.
 * - Identifies the current user for enrichment.
 * - Emits screen_viewed / screen_left on route changes.
 * - Emits session_started / session_ended.
 */
export function AnalyticsBootstrap() {
  const { user, role } = useAuth();

  useEffect(() => {
    identifyUser(user?.id ?? null, role ?? null);
  }, [user?.id, role]);

  useSessionTracking();
  useScreenTracking();

  return null;
}
