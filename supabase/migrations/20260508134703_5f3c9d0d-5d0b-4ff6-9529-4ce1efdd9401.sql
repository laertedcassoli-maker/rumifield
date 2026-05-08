ALTER TABLE public.pecas REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pecas;