CREATE POLICY "Authenticated users can read non-sensitive config keys"
ON public.configuracoes
FOR SELECT
TO authenticated
USING (chave IN ('inicio_menu_enabled', 'estoque_menu_enabled', 'garantia_motor_horas'));