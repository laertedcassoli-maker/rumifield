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
  // New enriched fields from ai_metadata
  entity_type?: string;
  semantic_tags?: string[];
  related_entities?: Record<string, string>;
  common_queries?: string[];
  business_context?: string;
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

    // Get table documentation with ai_metadata
    const { data: tableDocs, error: docsError } = await supabase
      .from('system_documentation')
      .select('slug, title, summary, ai_metadata')
      .eq('category', 'tabela')
      .eq('is_public', true);

    if (docsError) throw docsError;

    // Create lookup for table docs by extracting table name from slug
    const docLookup = new Map<string, { 
      slug: string; 
      summary: string | null;
      ai_metadata: any;
    }>();
    (tableDocs || []).forEach(doc => {
      // Extract table name from slug (e.g., "tabela-clientes" -> "clientes")
      const tableName = doc.slug.replace('tabela-', '').replace(/-/g, '_');
      docLookup.set(tableName, { 
        slug: doc.slug, 
        summary: doc.summary,
        ai_metadata: doc.ai_metadata || {}
      });
    });

    // Merge schema with documentation and enriched metadata
    const tables: TableSchema[] = (schemaTables || []).map((t: any) => {
      const docInfo = docLookup.get(t.table_name);
      const aiMeta = docInfo?.ai_metadata || {};
      return {
        table_name: t.table_name,
        column_count: t.column_count,
        has_rls: t.has_rls,
        policy_count: t.policy_count,
        documentation_slug: docInfo?.slug,
        documentation_summary: docInfo?.summary,
        // Include enriched ai_metadata fields
        entity_type: aiMeta.entity_type,
        semantic_tags: aiMeta.semantic_tags,
        related_entities: aiMeta.related_entities,
        common_queries: aiMeta.common_queries,
        business_context: aiMeta.business_context
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
