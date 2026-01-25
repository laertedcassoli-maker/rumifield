-- Create function to get schema tables for documentation sync
CREATE OR REPLACE FUNCTION public.get_schema_tables()
RETURNS TABLE (
  table_name text,
  column_count integer,
  has_rls boolean,
  policy_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.table_name::text,
    (SELECT COUNT(*)::integer FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.table_name),
    COALESCE((SELECT relrowsecurity FROM pg_class WHERE relname = t.table_name AND relnamespace = 'public'::regnamespace), false),
    (SELECT COUNT(*)::integer FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.table_name)
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
  ORDER BY t.table_name
$$;