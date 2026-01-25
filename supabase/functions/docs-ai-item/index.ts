import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIDocument {
  id: string;
  slug: string;
  title: string;
  type: string;
  category: string;
  summary: string | null;
  content: string;
  updated_at: string;
  metadata: {
    scope?: string;
    business_rules?: string[];
    events?: string[];
    related_tables?: string[];
    main_fields?: string[];
    possible_statuses?: string[];
    enabled_metrics?: string[];
    practical_examples?: string[];
  };
  related_modules: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const format = url.searchParams.get('format') || 'json';

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Missing slug parameter' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: doc, error } = await supabase
      .from('system_documentation')
      .select('*')
      .eq('slug', slug)
      .eq('is_public', true)
      .single();

    if (error || !doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    const aiDoc: AIDocument = {
      id: doc.id,
      slug: doc.slug,
      title: doc.title,
      type: doc.ai_metadata?.type || categoryToType(doc.category),
      category: doc.category,
      summary: doc.summary,
      content: doc.content,
      updated_at: doc.updated_at,
      metadata: {
        scope: doc.ai_metadata?.scope,
        business_rules: doc.ai_metadata?.business_rules || [],
        events: doc.ai_metadata?.events || [],
        related_tables: doc.ai_metadata?.related_tables || [],
        main_fields: doc.ai_metadata?.main_fields || [],
        possible_statuses: doc.ai_metadata?.possible_statuses || [],
        enabled_metrics: doc.ai_metadata?.enabled_metrics || [],
        practical_examples: doc.ai_metadata?.practical_examples || []
      },
      related_modules: doc.related_modules || []
    };

    if (format === 'md' || format === 'markdown') {
      const markdown = generateMarkdown(aiDoc);
      return new Response(markdown, {
        headers: { ...corsHeaders, 'Content-Type': 'text/markdown; charset=utf-8' },
        status: 200
      });
    }

    return new Response(JSON.stringify(aiDoc, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: unknown) {
    console.error('Error fetching AI document:', error);
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

function generateMarkdown(doc: AIDocument): string {
  const lines: string[] = [];
  
  // YAML frontmatter for metadata
  lines.push('---');
  lines.push(`id: ${doc.id}`);
  lines.push(`slug: ${doc.slug}`);
  lines.push(`title: "${doc.title}"`);
  lines.push(`type: ${doc.type}`);
  lines.push(`category: ${doc.category}`);
  lines.push(`updated_at: ${doc.updated_at}`);
  
  if (doc.metadata.related_tables?.length) {
    lines.push(`related_tables: [${doc.metadata.related_tables.map(t => `"${t}"`).join(', ')}]`);
  }
  if (doc.metadata.possible_statuses?.length) {
    lines.push(`statuses: [${doc.metadata.possible_statuses.map(s => `"${s}"`).join(', ')}]`);
  }
  if (doc.related_modules?.length) {
    lines.push(`related_modules: [${doc.related_modules.map(m => `"${m}"`).join(', ')}]`);
  }
  
  lines.push('---');
  lines.push('');
  
  // Title
  lines.push(`# ${doc.title}`);
  lines.push('');
  
  // Summary
  if (doc.summary) {
    lines.push(`> ${doc.summary}`);
    lines.push('');
  }
  
  // Scope
  if (doc.metadata.scope) {
    lines.push('## Escopo Funcional');
    lines.push('');
    lines.push(doc.metadata.scope);
    lines.push('');
  }
  
  // Main content
  lines.push('## Descrição');
  lines.push('');
  lines.push(doc.content);
  lines.push('');
  
  // Business Rules
  if (doc.metadata.business_rules?.length) {
    lines.push('## Regras de Negócio');
    lines.push('');
    doc.metadata.business_rules.forEach((rule, i) => {
      lines.push(`${i + 1}. ${rule}`);
    });
    lines.push('');
  }
  
  // Events
  if (doc.metadata.events?.length) {
    lines.push('## Eventos Gerados');
    lines.push('');
    doc.metadata.events.forEach(event => {
      lines.push(`- \`${event}\``);
    });
    lines.push('');
  }
  
  // Related Tables
  if (doc.metadata.related_tables?.length) {
    lines.push('## Tabelas Relacionadas');
    lines.push('');
    doc.metadata.related_tables.forEach(table => {
      lines.push(`- \`${table}\``);
    });
    lines.push('');
  }
  
  // Main Fields
  if (doc.metadata.main_fields?.length) {
    lines.push('## Campos Principais');
    lines.push('');
    doc.metadata.main_fields.forEach(field => {
      lines.push(`- ${field}`);
    });
    lines.push('');
  }
  
  // Possible Statuses
  if (doc.metadata.possible_statuses?.length) {
    lines.push('## Status Possíveis');
    lines.push('');
    doc.metadata.possible_statuses.forEach(status => {
      lines.push(`- \`${status}\``);
    });
    lines.push('');
  }
  
  // Metrics
  if (doc.metadata.enabled_metrics?.length) {
    lines.push('## Métricas Habilitadas');
    lines.push('');
    doc.metadata.enabled_metrics.forEach(metric => {
      lines.push(`- ${metric}`);
    });
    lines.push('');
  }
  
  // Examples
  if (doc.metadata.practical_examples?.length) {
    lines.push('## Exemplos Práticos');
    lines.push('');
    doc.metadata.practical_examples.forEach((example, i) => {
      lines.push(`### Exemplo ${i + 1}`);
      lines.push('');
      lines.push(example);
      lines.push('');
    });
  }
  
  return lines.join('\n');
}
