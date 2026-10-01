CREATE TABLE public.estoque_consumo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  peca_id uuid NULL REFERENCES public.pecas(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.estoque_consumo_itens TO authenticated;
GRANT ALL ON public.estoque_consumo_itens TO service_role;
ALTER TABLE public.estoque_consumo_itens ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_estoque_consumo_itens_updated_at BEFORE UPDATE ON public.estoque_consumo_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.estoque_consumo_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.estoque_consumo_itens(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  local text NOT NULL CHECK (local IN ('centro_servicos','tecnico')),
  tecnico_user_id uuid NULL REFERENCES auth.users(id),
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('inventario_inicial','carrinho','os','visita','pedido','ajuste')),
  origem_id uuid NULL,
  transacao_id uuid NULL,
  notes text NULL,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estoque_mov_tecnico_local_chk CHECK (
    (local = 'tecnico' AND tecnico_user_id IS NOT NULL) OR
    (local = 'centro_servicos' AND tecnico_user_id IS NULL))
);
GRANT SELECT, INSERT ON public.estoque_consumo_movimentos TO authenticated;
GRANT ALL ON public.estoque_consumo_movimentos TO service_role;
ALTER TABLE public.estoque_consumo_movimentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_estoque_mov_saldo ON public.estoque_consumo_movimentos(item_id, local, tecnico_user_id);
CREATE INDEX idx_estoque_mov_transacao ON public.estoque_consumo_movimentos(transacao_id);

CREATE OR REPLACE FUNCTION public.can_manage_estoque_consumo(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_menu_permissions rmp ON rmp.role::text = ur.role::text
    WHERE ur.user_id = _user_id AND rmp.menu_key = 'estoque_uso_consumo' AND rmp.can_edit)
$$;
CREATE OR REPLACE FUNCTION public.can_registrar_saida_estoque(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_menu_permissions rmp ON rmp.role::text = ur.role::text
    WHERE ur.user_id = _user_id AND rmp.menu_key = 'estoque_uso_consumo' AND rmp.can_delete)
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_estoque_consumo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_registrar_saida_estoque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_estoque_consumo(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_registrar_saida_estoque(uuid) TO authenticated, service_role;

CREATE POLICY "Authenticated read estoque itens" ON public.estoque_consumo_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert estoque itens" ON public.estoque_consumo_itens FOR INSERT TO authenticated WITH CHECK (public.can_manage_estoque_consumo(auth.uid()));
CREATE POLICY "Managers update estoque itens" ON public.estoque_consumo_itens FOR UPDATE TO authenticated USING (public.can_manage_estoque_consumo(auth.uid())) WITH CHECK (public.can_manage_estoque_consumo(auth.uid()));

CREATE POLICY "Authenticated read estoque movimentos" ON public.estoque_consumo_movimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert estoque movimentos by tipo" ON public.estoque_consumo_movimentos FOR INSERT TO authenticated WITH CHECK (
  (tipo = 'entrada' AND public.can_manage_estoque_consumo(auth.uid())) OR
  (tipo = 'saida' AND public.can_registrar_saida_estoque(auth.uid())));