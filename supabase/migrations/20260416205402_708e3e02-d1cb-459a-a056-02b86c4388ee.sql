-- 1) access_logs table
CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  email text NULL,
  event_type text NOT NULL CHECK (event_type IN ('login','logout','login_denied','login_error')),
  reason text NULL,
  ip text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_logs_user_id ON public.access_logs(user_id);
CREATE INDEX idx_access_logs_created_at ON public.access_logs(created_at DESC);
CREATE INDEX idx_access_logs_event_type ON public.access_logs(event_type);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert their own log entry; anon can also insert (for login_denied/error before session)
CREATE POLICY "Anyone can insert access logs"
ON public.access_logs FOR INSERT
WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Only admins can read access logs"
ON public.access_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 2) RPC validate_rumina_login
CREATE OR REPLACE FUNCTION public.validate_rumina_login(p_user_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_profile_active boolean;
BEGIN
  v_email := lower(trim(p_email));

  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Email não informado');
  END IF;

  IF v_email NOT LIKE '%@rumina.com.br' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Apenas contas @rumina.com.br são permitidas');
  END IF;

  SELECT is_active INTO v_profile_active
  FROM public.profiles
  WHERE lower(trim(email)) = v_email
  LIMIT 1;

  IF v_profile_active IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Usuário não cadastrado. Procure o RH.');
  END IF;

  IF v_profile_active = false THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Usuário inativo. Procure o RH.');
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', null);
END;
$$;

-- 3) Update handle_new_user to mark non-rumina as inactive (defense-in-depth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_rumina boolean;
BEGIN
  v_is_rumina := lower(trim(NEW.email)) LIKE '%@rumina.com.br';

  INSERT INTO public.profiles (id, nome, email, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    v_is_rumina  -- Active by default only for rumina emails
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'consultor_rplus')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;