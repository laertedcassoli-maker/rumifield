
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  ingested_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event_name text NOT NULL,
  screen text,
  entity text,
  entity_id uuid,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  app_version text,
  device jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_analytics_events_occurred_at ON public.analytics_events (occurred_at DESC);
CREATE INDEX idx_analytics_events_user_time ON public.analytics_events (user_id, occurred_at DESC);
CREATE INDEX idx_analytics_events_name_time ON public.analytics_events (event_name, occurred_at DESC);
CREATE INDEX idx_analytics_events_screen_time ON public.analytics_events (screen, occurred_at DESC);
CREATE INDEX idx_analytics_events_session ON public.analytics_events (session_id);

GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own events
CREATE POLICY "users_read_own_analytics_events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins and coordinators can read all events
CREATE POLICY "admins_read_all_analytics_events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.is_admin_or_coordinator(auth.uid()));

-- Only the authenticated user can insert their own events
CREATE POLICY "users_insert_own_analytics_events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
