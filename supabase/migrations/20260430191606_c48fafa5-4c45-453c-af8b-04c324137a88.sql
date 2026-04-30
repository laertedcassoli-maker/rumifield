CREATE OR REPLACE FUNCTION public.can_edit_completed_checklist(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND lower(trim(email)) = 'phelipe.rogerio@rumina.com.br'
  );
$$;