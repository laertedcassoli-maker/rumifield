CREATE TABLE public.sync_dead_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  operation text NOT NULL,
  payload jsonb NOT NULL,
  retry_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sync_dead_letter TO authenticated;
GRANT ALL ON public.sync_dead_letter TO service_role;

ALTER TABLE public.sync_dead_letter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own dead letter"
  ON public.sync_dead_letter FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own or privileged read all"
  ON public.sync_dead_letter FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador_rplus')
    OR public.has_role(auth.uid(), 'coordenador_servicos')
    OR public.has_role(auth.uid(), 'coordenador_logistica')
  );

CREATE INDEX idx_sync_dead_letter_user_created ON public.sync_dead_letter(user_id, created_at DESC);
CREATE INDEX idx_sync_dead_letter_table ON public.sync_dead_letter(table_name);