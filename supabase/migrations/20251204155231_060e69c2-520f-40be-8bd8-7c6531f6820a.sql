-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'tecnico');

-- Enum para status de pedido
CREATE TYPE public.pedido_status AS ENUM ('solicitado', 'processamento', 'faturado', 'enviado', 'entregue');

-- Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de roles (seguindo boas práticas de segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'tecnico',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Tabela de clientes (fazendas)
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  fazenda TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vínculo técnico-cliente (carteira)
CREATE TABLE public.tecnico_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tecnico_id, cliente_id)
);

-- Visitas técnicas
CREATE TABLE public.visitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data_visita TIMESTAMPTZ NOT NULL DEFAULT now(),
  descricao TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  sincronizado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mídias das visitas (fotos, áudios)
CREATE TABLE public.visita_midias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id UUID NOT NULL REFERENCES public.visitas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'audio', 'texto')),
  url TEXT,
  conteudo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Produtos químicos (catálogo)
CREATE TABLE public.produtos_quimicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'litros',
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estoque de produtos por cliente
CREATE TABLE public.estoque_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos_quimicos(id) ON DELETE CASCADE,
  quantidade DECIMAL(10, 2) NOT NULL DEFAULT 0,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID REFERENCES auth.users(id),
  observacoes TEXT,
  UNIQUE(cliente_id, produto_id)
);

-- Catálogo de peças
CREATE TABLE public.pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  omie_codigo TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedidos de peças
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  status pedido_status NOT NULL DEFAULT 'solicitado',
  observacoes TEXT,
  omie_pedido_id TEXT,
  omie_nf_numero TEXT,
  omie_data_faturamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens do pedido
CREATE TABLE public.pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  peca_id UUID NOT NULL REFERENCES public.pecas(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Função para verificar role (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para obter role do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_visitas_updated_at BEFORE UPDATE ON public.visitas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'tecnico');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnico_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visita_midias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_quimicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pecas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

-- RLS Policies para profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin/Gestor can view all profiles" ON public.profiles FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

-- RLS Policies para user_roles (apenas admin pode gerenciar)
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies para clientes
CREATE POLICY "Admin/Gestor can manage all clientes" ON public.clientes FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);
CREATE POLICY "Tecnico can view assigned clientes" ON public.clientes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tecnico_clientes WHERE tecnico_id = auth.uid() AND cliente_id = id)
);

-- RLS Policies para tecnico_clientes
CREATE POLICY "Admin/Gestor can manage assignments" ON public.tecnico_clientes FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);
CREATE POLICY "Tecnico can view own assignments" ON public.tecnico_clientes FOR SELECT USING (tecnico_id = auth.uid());

-- RLS Policies para visitas
CREATE POLICY "Tecnico can manage own visitas" ON public.visitas FOR ALL USING (tecnico_id = auth.uid());
CREATE POLICY "Admin/Gestor can view all visitas" ON public.visitas FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

-- RLS Policies para visita_midias
CREATE POLICY "Users can manage midias of own visitas" ON public.visita_midias FOR ALL USING (
  EXISTS (SELECT 1 FROM public.visitas WHERE id = visita_id AND tecnico_id = auth.uid())
);
CREATE POLICY "Admin/Gestor can view all midias" ON public.visita_midias FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

-- RLS Policies para produtos_quimicos (todos podem ver, admin gerencia)
CREATE POLICY "All authenticated can view produtos" ON public.produtos_quimicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage produtos" ON public.produtos_quimicos FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para estoque_cliente
CREATE POLICY "Tecnico can manage estoque of assigned clientes" ON public.estoque_cliente FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tecnico_clientes WHERE tecnico_id = auth.uid() AND cliente_id = estoque_cliente.cliente_id)
);
CREATE POLICY "Admin/Gestor can view all estoque" ON public.estoque_cliente FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

-- RLS Policies para pecas (todos podem ver, admin gerencia)
CREATE POLICY "All authenticated can view pecas" ON public.pecas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage pecas" ON public.pecas FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para pedidos
CREATE POLICY "Tecnico can manage own pedidos" ON public.pedidos FOR ALL USING (solicitante_id = auth.uid());
CREATE POLICY "Admin/Gestor can manage all pedidos" ON public.pedidos FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

-- RLS Policies para pedido_itens
CREATE POLICY "Users can manage items of own pedidos" ON public.pedido_itens FOR ALL USING (
  EXISTS (SELECT 1 FROM public.pedidos WHERE id = pedido_id AND solicitante_id = auth.uid())
);
CREATE POLICY "Admin/Gestor can manage all pedido items" ON public.pedido_itens FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

-- Storage bucket para mídias
INSERT INTO storage.buckets (id, name, public) VALUES ('visita-midias', 'visita-midias', false);

-- Storage policies
CREATE POLICY "Users can upload own midias" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'visita-midias' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can view own midias" ON storage.objects FOR SELECT USING (
  bucket_id = 'visita-midias' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Admin/Gestor can view all midias" ON storage.objects FOR SELECT USING (
  bucket_id = 'visita-midias' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
);

-- Inserir 2 produtos químicos padrão
INSERT INTO public.produtos_quimicos (nome, unidade, descricao) VALUES
  ('Produto A', 'litros', 'Primeiro produto químico'),
  ('Produto B', 'kg', 'Segundo produto químico');