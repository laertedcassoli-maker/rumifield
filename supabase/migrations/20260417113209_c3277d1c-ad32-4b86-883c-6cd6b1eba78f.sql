-- 1) Authorized users allowlist
CREATE TABLE IF NOT EXISTS public.authorized_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'consultor_rplus',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_authorized_users_email_lower
  ON public.authorized_users (lower(trim(email)));

ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view authorized users"
  ON public.authorized_users FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert authorized users"
  ON public.authorized_users FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update authorized users"
  ON public.authorized_users FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete authorized users"
  ON public.authorized_users FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_authorized_users_updated_at
  BEFORE UPDATE ON public.authorized_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Update validate_rumina_login to also accept allowlisted emails
CREATE OR REPLACE FUNCTION public.validate_rumina_login(p_user_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_profile_active boolean;
  v_authorized_active boolean;
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

  IF v_profile_active = true THEN
    RETURN jsonb_build_object('allowed', true, 'reason', null);
  END IF;

  IF v_profile_active = false THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Usuário inativo. Procure o RH.');
  END IF;

  -- No profile yet — check allowlist
  SELECT is_active INTO v_authorized_active
  FROM public.authorized_users
  WHERE lower(trim(email)) = v_email
  LIMIT 1;

  IF v_authorized_active = true THEN
    RETURN jsonb_build_object('allowed', true, 'reason', null);
  END IF;

  IF v_authorized_active = false THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Usuário inativo. Procure o RH.');
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'Usuário não cadastrado. Procure o RH.');
END;
$$;

-- 3) Update handle_new_user to apply allowlist role on first login
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_email text;
  v_is_rumina boolean;
  v_authorized record;
  v_assigned_role app_role;
  v_assigned_name text;
  v_assigned_active boolean;
BEGIN
  v_normalized_email := lower(trim(NEW.email));
  v_is_rumina := v_normalized_email LIKE '%@rumina.com.br';

  -- Look up allowlist
  SELECT nome, role, is_active INTO v_authorized
  FROM public.authorized_users
  WHERE lower(trim(email)) = v_normalized_email
  LIMIT 1;

  IF v_authorized.role IS NOT NULL THEN
    v_assigned_role := v_authorized.role;
    v_assigned_name := v_authorized.nome;
    v_assigned_active := v_authorized.is_active;
  ELSE
    v_assigned_role := 'consultor_rplus'::app_role;
    v_assigned_name := COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'name', NEW.email);
    v_assigned_active := v_is_rumina;
  END IF;

  INSERT INTO public.profiles (id, nome, email, is_active)
  VALUES (NEW.id, v_assigned_name, NEW.email, v_assigned_active)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;