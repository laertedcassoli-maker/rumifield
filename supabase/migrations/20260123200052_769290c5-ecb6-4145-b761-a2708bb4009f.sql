-- Create RLS policies for pedidos table
CREATE POLICY "Users can view all pedidos" 
ON public.pedidos 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create pedidos" 
ON public.pedidos 
FOR INSERT 
WITH CHECK (auth.uid() = solicitante_id);

CREATE POLICY "Users can update their own pedidos" 
ON public.pedidos 
FOR UPDATE 
USING (auth.uid() = solicitante_id);

CREATE POLICY "Users can delete their own pedidos" 
ON public.pedidos 
FOR DELETE 
USING (auth.uid() = solicitante_id);

-- Create RLS policies for pedido_itens table
CREATE POLICY "Users can view all pedido_itens" 
ON public.pedido_itens 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create pedido_itens" 
ON public.pedido_itens 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pedidos 
    WHERE id = pedido_id AND solicitante_id = auth.uid()
  )
);

CREATE POLICY "Users can update pedido_itens of their pedidos" 
ON public.pedido_itens 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos 
    WHERE id = pedido_id AND solicitante_id = auth.uid()
  )
);

CREATE POLICY "Users can delete pedido_itens of their pedidos" 
ON public.pedido_itens 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos 
    WHERE id = pedido_id AND solicitante_id = auth.uid()
  )
);