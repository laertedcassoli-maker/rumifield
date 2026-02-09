
-- Allow anyone to update used_at on invites (needed for accept flow)
CREATE POLICY "Qualquer um pode marcar convite como usado"
ON public.user_invites
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Create a security definer function to accept invite and set role
CREATE OR REPLACE FUNCTION public.accept_invite(
  _invite_id uuid,
  _user_id uuid,
  _role app_role,
  _cidade_base text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update user role from default to invite role
  UPDATE public.user_roles
  SET role = _role
  WHERE user_id = _user_id;

  -- Update cidade_base if provided
  IF _cidade_base IS NOT NULL THEN
    UPDATE public.profiles
    SET cidade_base = _cidade_base
    WHERE id = _user_id;
  END IF;

  -- Mark invite as used
  UPDATE public.user_invites
  SET used_at = now()
  WHERE id = _invite_id;
END;
$$;
