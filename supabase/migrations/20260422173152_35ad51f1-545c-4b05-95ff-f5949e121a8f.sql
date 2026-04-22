-- Permitir que o técnico atribuído à rota execute check-in/check-out e atualize
-- o andamento das suas próprias preventivas, sem depender de admin/coordenador.

-- Função auxiliar: verifica se o usuário é o técnico de campo da rota
CREATE OR REPLACE FUNCTION public.is_route_technician(_user_id uuid, _route_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.preventive_routes
    WHERE id = _route_id AND field_technician_user_id = _user_id
  )
$$;

-- 1) preventive_routes — técnico pode mudar status da própria rota (planejada → em_execucao → concluida)
CREATE POLICY "Technicians can update their assigned routes"
ON public.preventive_routes
FOR UPDATE
TO authenticated
USING (field_technician_user_id = auth.uid())
WITH CHECK (field_technician_user_id = auth.uid());

-- 2) preventive_route_items — técnico pode gravar check-in/check-out e status nos itens da sua rota
CREATE POLICY "Technicians can update items of their routes"
ON public.preventive_route_items
FOR UPDATE
TO authenticated
USING (public.is_route_technician(auth.uid(), route_id))
WITH CHECK (public.is_route_technician(auth.uid(), route_id));

-- 3) preventive_maintenance — técnico responsável pode INSERT e UPDATE seus próprios registros
CREATE POLICY "Technicians can insert their own preventive_maintenance"
ON public.preventive_maintenance
FOR INSERT
TO authenticated
WITH CHECK (
  technician_user_id = auth.uid()
  OR (route_id IS NOT NULL AND public.is_route_technician(auth.uid(), route_id))
);

CREATE POLICY "Technicians can update their own preventive_maintenance"
ON public.preventive_maintenance
FOR UPDATE
TO authenticated
USING (
  technician_user_id = auth.uid()
  OR (route_id IS NOT NULL AND public.is_route_technician(auth.uid(), route_id))
)
WITH CHECK (
  technician_user_id = auth.uid()
  OR (route_id IS NOT NULL AND public.is_route_technician(auth.uid(), route_id))
);