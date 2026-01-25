import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TableSchema {
  table_name: string;
  column_count: number;
  has_rls: boolean;
  policy_count: number;
  documentation_slug?: string;
  documentation_summary?: string;
}

interface SchemaIndex {
  version: string;
  last_updated: string;
  total_tables: number;
  documented_tables: number;
  tables: TableSchema[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get schema tables
    const { data: schemaTables, error: schemaError } = await supabase.rpc('get_schema_tables');
    
    if (schemaError) throw schemaError;

    // Get table documentation
    const { data: tableDocs, error: docsError } = await supabase
      .from('system_documentation')
      .select('slug, title, summary')
      .eq('category', 'tabela')
      .eq('is_public', true);

    if (docsError) throw docsError;

    // Create lookup for table docs by extracting table name from slug
    const docLookup = new Map<string, { slug: string; summary: string | null }>();
    (tableDocs || []).forEach(doc => {
      // Extract table name from slug (e.g., "tabela-clientes" -> "clientes")
      const tableName = doc.slug.replace('tabela-', '').replace(/-/g, '_');
      docLookup.set(tableName, { slug: doc.slug, summary: doc.summary });
    });

    // Merge schema with documentation
    const tables: TableSchema[] = (schemaTables || []).map((t: any) => {
      const docInfo = docLookup.get(t.table_name);
      return {
        table_name: t.table_name,
        column_count: t.column_count,
        has_rls: t.has_rls,
        policy_count: t.policy_count,
        documentation_slug: docInfo?.slug,
        documentation_summary: docInfo?.summary
      };
    });

    const documentedCount = tables.filter(t => t.documentation_slug).length;

    const schemaIndex: SchemaIndex = {
      version: "1.0.0",
      last_updated: new Date().toISOString(),
      total_tables: tables.length,
      documented_tables: documentedCount,
      tables
    };

    return new Response(JSON.stringify(schemaIndex, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: unknown) {
    console.error('Error generating schema index:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
