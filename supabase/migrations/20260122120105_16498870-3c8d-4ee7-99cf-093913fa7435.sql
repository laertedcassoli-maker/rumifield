-- Add cliente_id to work_orders table
ALTER TABLE public.work_orders 
ADD COLUMN cliente_id uuid REFERENCES public.clientes(id);

-- Add index for performance
CREATE INDEX idx_work_orders_cliente_id ON public.work_orders(cliente_id);

-- Add comment
COMMENT ON COLUMN public.work_orders.cliente_id IS 'Cliente de origem das peças para a OS';