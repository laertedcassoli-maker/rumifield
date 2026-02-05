-- Tabela para armazenar tokens de convite
CREATE TABLE public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'consultor_rplus',
  cidade_base TEXT,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- Política: admins e coordenadores podem ver todos os convites
CREATE POLICY "Admins e coordenadores podem ver convites"
ON public.user_invites
FOR SELECT
TO authenticated
USING (public.is_admin_or_coordinator(auth.uid()));

-- Política: admins e coordenadores podem criar convites
CREATE POLICY "Admins e coordenadores podem criar convites"
ON public.user_invites
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

-- Política: admins e coordenadores podem deletar convites
CREATE POLICY "Admins e coordenadores podem deletar convites"
ON public.user_invites
FOR DELETE
TO authenticated
USING (public.is_admin_or_coordinator(auth.uid()));

-- Política: anônimos podem ler convite pelo token (para página de aceite)
CREATE POLICY "Qualquer um pode ler convite por token"
ON public.user_invites
FOR SELECT
TO anon
USING (true);