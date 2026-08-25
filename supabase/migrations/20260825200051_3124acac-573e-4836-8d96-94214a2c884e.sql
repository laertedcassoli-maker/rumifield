DO $$
DECLARE t text;
  tabelas text[] := ARRAY[
    'pedidos','pedido_itens','pedido_item_assets',
    'estoque_cliente','visitas','visita_midias','profiles'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Authenticated can read all" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Authenticated can read all" ON public.%I '
        'FOR SELECT TO authenticated USING (true)', t);
      RAISE NOTICE 'ok: %', t;
    ELSE
      RAISE NOTICE 'inexistente, pulada: %', t;
    END IF;
  END LOOP;
END $$;