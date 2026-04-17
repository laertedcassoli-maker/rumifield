CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_rumina boolean;
  v_existing_profile_id uuid;
  v_normalized_email text;
BEGIN
  v_normalized_email := lower(trim(NEW.email));
  v_is_rumina := v_normalized_email LIKE '%@rumina.com.br';

  -- Try to find a pre-existing profile by email (case-insensitive)
  SELECT id INTO v_existing_profile_id
  FROM public.profiles
  WHERE lower(trim(email)) = v_normalized_email
    AND id <> NEW.id
  LIMIT 1;

  IF v_existing_profile_id IS NOT NULL THEN
    -- Pre-registered profile exists: re-key it to the new auth user id
    -- First, move any user_roles that were attached to the placeholder id
    UPDATE public.user_roles
    SET user_id = NEW.id
    WHERE user_id = v_existing_profile_id
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur2
        WHERE ur2.user_id = NEW.id AND ur2.role = public.user_roles.role
      );

    -- Remove any leftover roles on the placeholder id (duplicates)
    DELETE FROM public.user_roles WHERE user_id = v_existing_profile_id;

    -- Re-key the profile itself
    UPDATE public.profiles
    SET id = NEW.id,
        is_active = true,
        email = NEW.email
    WHERE id = v_existing_profile_id;
  ELSE
    -- No pre-registered profile: create a fresh one
    INSERT INTO public.profiles (id, nome, email, is_active)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'name', NEW.email),
      NEW.email,
      v_is_rumina
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'consultor_rplus')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;