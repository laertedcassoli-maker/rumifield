import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocSummary {
  id: string;
  slug: string;
  title: string;
  category: string;
  type: string;
  summary: string | null;
  updated_at: string;
  related_tables?: string[];
}

interface AIIndex {
  version: string;
  last_updated: string;
  total_documents: number;
  modules: DocSummary[];
  tables: DocSummary[];
  rules: DocSummary[];
  permissions: DocSummary[];
  overview: DocSummary[];
  endpoints: {
    json: string;
    markdown: string;
  };
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

    // Fetch all public documentation
    const { data: docs, error } = await supabase
      .from('system_documentation')
      .select('id, slug, title, category, summary, updated_at, ai_metadata, related_modules')
      .eq('is_public', true)
      .order('category')
      .order('title');

    if (error) throw error;

    const baseUrl = Deno.env.get('SUPABASE_URL')!.replace('/rest/v1', '');
    const functionsBase = `${baseUrl}/functions/v1`;

    // Categorize documents
    const categorize = (category: string): DocSummary[] => 
      (docs || [])
        .filter(d => d.category === category)
        .map(d => ({
          id: d.id,
          slug: d.slug,
          title: d.title,
          category: d.category,
          type: d.ai_metadata?.type || categoryToType(d.category),
          summary: d.summary,
          updated_at: d.updated_at,
          related_tables: d.ai_metadata?.related_tables || []
        }));

    const index: AIIndex = {
      version: "1.0.0",
      last_updated: new Date().toISOString(),
      total_documents: docs?.length || 0,
      modules: categorize('modulo'),
      tables: categorize('tabela'),
      rules: categorize('regra_transversal'),
      permissions: categorize('permissao'),
      overview: categorize('visao_geral'),
      endpoints: {
        json: `${functionsBase}/docs-ai-item?slug={slug}&format=json`,
        markdown: `${functionsBase}/docs-ai-item?slug={slug}&format=md`
      }
    };

    return new Response(JSON.stringify(index, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: unknown) {
    console.error('Error generating AI index:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

function categoryToType(category: string): string {
  const map: Record<string, string> = {
    'modulo': 'module',
    'tabela': 'table',
    'regra_transversal': 'rule',
    'permissao': 'permission',
    'visao_geral': 'overview'
  };
  return map[category] || 'unknown';
}
