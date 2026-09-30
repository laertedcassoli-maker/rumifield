ALTER TYPE public.work_order_status ADD VALUE IF NOT EXISTS 'cancelada';
ALTER TYPE public.pedido_status ADD VALUE IF NOT EXISTS 'cancelado';
ALTER TYPE public.preventive_route_status ADD VALUE IF NOT EXISTS 'cancelada';