-- Fix the handle_new_user function to use a valid role from the enum
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email), NEW.email);
  
  -- Use 'consultor_rplus' as default role (previously was 'tecnico' which no longer exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'consultor_rplus');
  
  RETURN NEW;
END;
$$;