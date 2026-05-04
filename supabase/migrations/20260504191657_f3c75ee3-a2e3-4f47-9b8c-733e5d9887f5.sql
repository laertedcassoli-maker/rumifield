
INSERT INTO storage.buckets (id, name, public)
VALUES ('relatorios-publicos', 'relatorios-publicos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Relatorios publicos - leitura publica"
ON storage.objects FOR SELECT
USING (bucket_id = 'relatorios-publicos');

CREATE POLICY "Relatorios publicos - upload autenticado"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'relatorios-publicos');

CREATE POLICY "Relatorios publicos - update autenticado"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'relatorios-publicos');

CREATE POLICY "Relatorios publicos - delete autenticado"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'relatorios-publicos');
