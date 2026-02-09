
-- Drop the overly permissive policy we just created
DROP POLICY "Qualquer um pode marcar convite como usado" ON public.user_invites;
