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
    // Legacy fields (for backward compatibility)
    scope?: string;
    business_rules?: string[];
    events?: string[];
    related_tables?: string[];
    main_fields?: string[];
    possible_statuses?: string[];
    enabled_metrics?: string[];
    practical_examples?: string[];
    // New enriched fields
    entity_type?: string;
    semantic_tags?: string[];
    related_entities?: Record<string, string>;
    key_fields?: Record<string, string>;
    common_queries?: string[];
    business_context?: string;
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

    const aiMeta = doc.ai_metadata || {};
    
    const aiDoc: AIDocument = {
      id: doc.id,
      slug: doc.slug,
      title: doc.title,
      type: aiMeta.type || categoryToType(doc.category),
      category: doc.category,
      summary: doc.summary,
      content: doc.content,
      updated_at: doc.updated_at,
      metadata: {
        // Legacy fields
        scope: aiMeta.scope,
        business_rules: aiMeta.business_rules || [],
        events: aiMeta.events || [],
        related_tables: aiMeta.related_tables || [],
        main_fields: aiMeta.main_fields || [],
        possible_statuses: aiMeta.possible_statuses || [],
        enabled_metrics: aiMeta.enabled_metrics || [],
        practical_examples: aiMeta.practical_examples || [],
        // New enriched fields
        entity_type: aiMeta.entity_type,
        semantic_tags: aiMeta.semantic_tags || [],
        related_entities: aiMeta.related_entities || {},
        key_fields: aiMeta.key_fields || {},
        common_queries: aiMeta.common_queries || [],
        business_context: aiMeta.business_context
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
  
  // === NEW ENRICHED FIELDS ===
  
  // Business Context
  if (doc.metadata.business_context) {
    lines.push('## Contexto de Negócio');
    lines.push('');
    lines.push(doc.metadata.business_context);
    lines.push('');
  }
  
  // Entity Type
  if (doc.metadata.entity_type) {
    lines.push(`**Tipo de Entidade:** \`${doc.metadata.entity_type}\``);
    lines.push('');
  }
  
  // Semantic Tags
  if (doc.metadata.semantic_tags?.length) {
    lines.push('## Tags Semânticas');
    lines.push('');
    lines.push(doc.metadata.semantic_tags.map(t => `\`${t}\``).join(', '));
    lines.push('');
  }
  
  // Key Fields with descriptions
  if (doc.metadata.key_fields && Object.keys(doc.metadata.key_fields).length) {
    lines.push('## Campos-Chave');
    lines.push('');
    lines.push('| Campo | Descrição |');
    lines.push('|-------|-----------|');
    Object.entries(doc.metadata.key_fields).forEach(([field, desc]) => {
      lines.push(`| \`${field}\` | ${desc} |`);
    });
    lines.push('');
  }
  
  // Related Entities
  if (doc.metadata.related_entities && Object.keys(doc.metadata.related_entities).length) {
    lines.push('## Entidades Relacionadas');
    lines.push('');
    Object.entries(doc.metadata.related_entities).forEach(([rel, table]) => {
      lines.push(`- **${rel}**: \`${table}\``);
    });
    lines.push('');
  }
  
  // Common Queries (for RAG)
  if (doc.metadata.common_queries?.length) {
    lines.push('## Perguntas Frequentes');
    lines.push('');
    doc.metadata.common_queries.forEach(q => {
      lines.push(`- ${q}`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}
