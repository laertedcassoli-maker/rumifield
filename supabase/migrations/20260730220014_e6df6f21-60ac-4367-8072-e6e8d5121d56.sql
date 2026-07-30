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
  v_uid uuid;
BEGIN
  BEGIN
    v_uid := NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  v_sql := btrim(COALESCE(p_sql, ''));
  v_sql := regexp_replace(v_sql, ';\s*$', '');

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
  ELSIF v_norm ~ '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|set|reset|vacuum|analyze|call|do|merge|refresh|comment|lock|listen|notify|prepare|execute|reindex|cluster)\M' THEN
    v_reason := 'Comando de escrita ou DDL detectado. Apenas leitura é permitida.';
  ELSIF v_norm ~ '\m(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_sleep|dblink|pg_logical_slot|lo_import|lo_export)\M' THEN
    v_reason := 'Função não permitida.';
  END IF;

  IF v_reason IS NOT NULL THEN
    -- registra a recusa e devolve o erro como linha (RAISE desfaria o registro)
    INSERT INTO public.mcp_query_audit (user_id, sql_text, outcome, error_message, row_limit)
    VALUES (v_uid, v_sql, 'rejected', v_reason, v_limit);
    RETURN NEXT jsonb_build_object('__mcp_error', 'Consulta recusada: ' || v_reason);
    RETURN;
  END IF;

  INSERT INTO public.mcp_query_audit (user_id, sql_text, outcome, row_limit)
  VALUES (v_uid, v_sql, 'executed', v_limit);

  SET LOCAL transaction_read_only = on;
  SET LOCAL statement_timeout = '10s';

  RETURN QUERY EXECUTE format(
    'SELECT to_jsonb(__mcp_q) FROM (%s) AS __mcp_q LIMIT %s', v_sql, v_limit
  );
END;
$$;