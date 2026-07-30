-- 1) Audit table
CREATE TABLE public.mcp_query_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  sql_text text NOT NULL,
  outcome text NOT NULL,
  error_message text,
  row_limit integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mcp_query_audit TO authenticated;
GRANT ALL ON public.mcp_query_audit TO service_role;

ALTER TABLE public.mcp_query_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own mcp audit"
ON public.mcp_query_audit FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own mcp audit"
ON public.mcp_query_audit FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_mcp_query_audit_created_at ON public.mcp_query_audit (created_at DESC);

-- 2) Read-only SQL executor (SECURITY INVOKER => RLS still applies)
CREATE OR REPLACE FUNCTION public.mcp_readonly_query(p_sql text, p_limit integer DEFAULT 5000)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_sql text;
  v_norm text;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 5000), 1), 5000);
  v_reason text;
BEGIN
  v_sql := btrim(COALESCE(p_sql, ''));
  v_sql := regexp_replace(v_sql, ';\s*$', '');

  -- normalized copy: strip string literals and comments before pattern checks
  v_norm := regexp_replace(v_sql, '''([^'']|'''')*''', ' ', 'g');
  v_norm := regexp_replace(v_norm, '--[^\n]*', ' ', 'g');
  v_norm := regexp_replace(v_norm, '/\*.*?\*/', ' ', 'gs');
  v_norm := lower(regexp_replace(v_norm, '\s+', ' ', 'g'));

  IF v_norm = '' THEN
    v_reason := 'Consulta vazia.';
  ELSIF position(';' in v_norm) > 0 THEN
    v_reason := 'Múltiplos statements não são permitidos.';
  ELSIF v_norm !~ '^(select|with)\s' THEN
    v_reason := 'Apenas SELECT ou WITH ... SELECT são permitidos.';
  ELSIF v_norm ~ '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|set|reset|vacuum|analyze|call|do|merge|refresh|comment|lock|listen|notify|prepare|execute|reindex|cluster|security\s+label)\M' THEN
    v_reason := 'Comando de escrita ou DDL detectado. Apenas leitura é permitida.';
  ELSIF v_norm ~ '\m(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_sleep|dblink|pg_logical_slot|lo_import|lo_export)\M' THEN
    v_reason := 'Função não permitida.';
  END IF;

  IF v_reason IS NOT NULL THEN
    INSERT INTO public.mcp_query_audit (user_id, sql_text, outcome, error_message, row_limit)
    VALUES (auth.uid(), v_sql, 'rejected', v_reason, v_limit);
    RAISE EXCEPTION 'Consulta recusada: %', v_reason;
  END IF;

  -- audit BEFORE switching the transaction to read-only (the audit row is itself a write)
  INSERT INTO public.mcp_query_audit (user_id, sql_text, outcome, row_limit)
  VALUES (auth.uid(), v_sql, 'executed', v_limit);

  -- structural guarantee: the engine refuses any write from here on
  SET LOCAL transaction_read_only = on;
  SET LOCAL statement_timeout = '10s';

  RETURN QUERY EXECUTE format(
    'SELECT to_jsonb(__mcp_q) FROM (%s) AS __mcp_q LIMIT %s', v_sql, v_limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mcp_readonly_query(text, integer) TO authenticated;

-- 3) Catalog helpers (metadata only, public schema whitelist)
CREATE OR REPLACE FUNCTION public.mcp_list_tables()
RETURNS TABLE(table_name text, approx_rows bigint, has_rls boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.relname::text,
         GREATEST(c.reltuples, 0)::bigint,
         c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE 'pg\_%'
    AND c.relname NOT IN ('mcp_query_audit','access_logs','audit_logs','authorized_users','user_invites','sync_dead_letter')
  ORDER BY c.relname
$$;

GRANT EXECUTE ON FUNCTION public.mcp_list_tables() TO authenticated;

CREATE OR REPLACE FUNCTION public.mcp_describe_table(p_table text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ok boolean;
  v_cols jsonb;
  v_fks jsonb;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.mcp_list_tables() t WHERE t.table_name = p_table) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Tabela % não disponível para inspeção.', p_table;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'column_name', c.column_name,
           'data_type', c.data_type,
           'udt_name', c.udt_name,
           'is_nullable', (c.is_nullable = 'YES'),
           'column_default', c.column_default,
           'enum_values', (
             SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
             FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
             WHERE t.typname = c.udt_name
           )
         ) ORDER BY c.ordinal_position)
  INTO v_cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = p_table;

  SELECT jsonb_agg(jsonb_build_object(
           'column', kcu.column_name,
           'references_table', ccu.table_name,
           'references_column', ccu.column_name
         ))
  INTO v_fks
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public' AND tc.table_name = p_table;

  RETURN jsonb_build_object(
    'table_name', p_table,
    'columns', COALESCE(v_cols, '[]'::jsonb),
    'foreign_keys', COALESCE(v_fks, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mcp_describe_table(text) TO authenticated;