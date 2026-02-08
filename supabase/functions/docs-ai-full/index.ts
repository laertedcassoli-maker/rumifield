import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const categoryOrder = ['visao_geral', 'modulo', 'tabela', 'regra_transversal', 'permissao'];
const categoryLabels: Record<string, string> = {
  visao_geral: 'Visão Geral',
  modulo: 'Módulos',
  tabela: 'Tabelas',
  regra_transversal: 'Regras Transversais',
  permissao: 'Permissões',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: docs, error } = await supabase
      .from('system_documentation')
      .select('slug, title, category, summary, content, ai_metadata, related_modules, updated_at')
      .eq('is_public', true)
      .order('category')
      .order('title');

    if (error) throw error;

    // Group by category
    const grouped = new Map<string, typeof docs>();
    for (const cat of categoryOrder) {
      const items = (docs || []).filter(d => d.category === cat);
      if (items.length > 0) grouped.set(cat, items);
    }

    const totalDocs = docs?.length || 0;
    const lines: string[] = [];

    // Header
    lines.push('# Documentação Completa do Sistema - RumiField');
    lines.push('');
    lines.push(`> Gerado em: ${new Date().toISOString()}`);
    lines.push(`> Total: ${totalDocs} documentos`);
    lines.push('');

    // Table of contents
    lines.push('## Índice');
    lines.push('');
    for (const [cat, items] of grouped) {
      const label = categoryLabels[cat] || cat;
      lines.push(`- **${label}**`);
      for (const doc of items) {
        const anchor = doc.slug;
        lines.push(`  - [${doc.title}](#${anchor})`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Content by category
    for (const [cat, items] of grouped) {
      const label = categoryLabels[cat] || cat;
      lines.push(`## ${label}`);
      lines.push('');

      for (const doc of items) {
        lines.push(`### ${doc.title} {#${doc.slug}}`);
        lines.push('');

        if (doc.summary) {
          lines.push(`> ${doc.summary}`);
          lines.push('');
        }

        if (doc.content) {
          lines.push(doc.content);
          lines.push('');
        }

        // Inline metadata
        const ai = doc.ai_metadata || {};

        if (ai.business_rules?.length) {
          lines.push('**Regras de Negócio:**');
          for (const r of ai.business_rules) lines.push(`- ${r}`);
          lines.push('');
        }

        if (ai.related_tables?.length) {
          lines.push(`**Tabelas:** ${ai.related_tables.map((t: string) => `\`${t}\``).join(', ')}`);
          lines.push('');
        }

        if (ai.possible_statuses?.length) {
          lines.push(`**Status:** ${ai.possible_statuses.map((s: string) => `\`${s}\``).join(', ')}`);
          lines.push('');
        }

        if (doc.related_modules?.length) {
          lines.push(`**Módulos relacionados:** ${doc.related_modules.join(', ')}`);
          lines.push('');
        }

        lines.push('---');
        lines.push('');
      }
    }

    return new Response(lines.join('\n'), {
      headers: { ...corsHeaders, 'Content-Type': 'text/markdown; charset=utf-8' },
      status: 200,
    });
  } catch (error: unknown) {
    console.error('Error generating full docs:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
