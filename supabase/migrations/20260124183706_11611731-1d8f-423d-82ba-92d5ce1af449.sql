-- Enum para categorias de documentação
CREATE TYPE public.doc_category AS ENUM (
  'visao_geral',
  'modulo',
  'regra_transversal',
  'permissao'
);

-- Tabela principal de documentação do sistema
CREATE TABLE public.system_documentation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category doc_category NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  summary TEXT,
  related_modules TEXT[] DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de histórico do chat de documentação
CREATE TABLE public.doc_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_doc_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_chat_history ENABLE ROW LEVEL SECURITY;

-- Policies para system_documentation
-- Todos autenticados podem ler
CREATE POLICY "Authenticated users can read documentation"
ON public.system_documentation
FOR SELECT
TO authenticated
USING (true);

-- Apenas admin e coordenadores podem modificar
CREATE POLICY "Admins and coordinators can insert documentation"
ON public.system_documentation
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'coordenador_servicos')
);

CREATE POLICY "Admins and coordinators can update documentation"
ON public.system_documentation
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'coordenador_servicos')
);

CREATE POLICY "Admins and coordinators can delete documentation"
ON public.system_documentation
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'coordenador_servicos')
);

-- Policies para doc_chat_history
CREATE POLICY "Users can read own chat history"
ON public.doc_chat_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat history"
ON public.doc_chat_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_system_documentation_updated_at
BEFORE UPDATE ON public.system_documentation
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Índices para performance
CREATE INDEX idx_system_documentation_category ON public.system_documentation(category);
CREATE INDEX idx_system_documentation_slug ON public.system_documentation(slug);
CREATE INDEX idx_doc_chat_history_user ON public.doc_chat_history(user_id);
CREATE INDEX idx_doc_chat_history_created ON public.doc_chat_history(created_at DESC);