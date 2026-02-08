import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch live data from the AI endpoints
    const functionsBase = `${supabaseUrl}/functions/v1`;

    console.log('Fetching docs-ai-index...');
    const [indexRes, schemaRes] = await Promise.all([
      fetch(`${functionsBase}/docs-ai-index`, {
        headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey }
      }),
      fetch(`${functionsBase}/docs-ai-schema`, {
        headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey }
      }),
    ]);

    if (!indexRes.ok) throw new Error(`docs-ai-index returned ${indexRes.status}`);
    if (!schemaRes.ok) throw new Error(`docs-ai-schema returned ${schemaRes.status}`);

    const indexData = await indexRes.json();
    const schemaData = await schemaRes.json();

    console.log(`Index: ${indexData.total_documents} docs, Schema: ${schemaData.total_tables} tables`);

    // Fetch one sample doc for the docs-ai-item example
    const sampleSlug = indexData.modules?.[0]?.slug || indexData.overview?.[0]?.slug || null;
    let sampleItemJson = '{ "slug": "...", "title": "...", "content": "..." }';
    if (sampleSlug) {
      const itemRes = await fetch(`${functionsBase}/docs-ai-item?slug=${sampleSlug}&format=json`, {
        headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey }
      });
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        // Truncate content for example
        const truncated = { ...itemData, content: (itemData.content || '').substring(0, 200) + '...' };
        sampleItemJson = JSON.stringify(truncated, null, 2);
      }
    }

    // Build category summary
    const categorySummary = [
      `- **Módulos**: ${indexData.modules?.length || 0}`,
      `- **Tabelas**: ${indexData.tables?.length || 0}`,
      `- **Regras Transversais**: ${indexData.rules?.length || 0}`,
      `- **Permissões**: ${indexData.permissions?.length || 0}`,
      `- **Visão Geral**: ${indexData.overview?.length || 0}`,
    ].join('\n');

    // Build schema summary
    const documentedTables = schemaData.tables?.filter((t: any) => t.documentation_slug)?.length || 0;
    const totalTables = schemaData.total_tables || 0;
    const tablesWithRls = schemaData.tables?.filter((t: any) => t.has_rls)?.length || 0;

    // Top tables sample
    const topTables = (schemaData.tables || []).slice(0, 5).map((t: any) =>
      `| ${t.table_name} | ${t.column_count} | ${t.has_rls ? '✅' : '❌'} | ${t.policy_count} | ${t.documentation_slug ? '✅' : '—'} |`
    ).join('\n');

    const now = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const content = `# Camada IA — API de Documentação

> **Atualizado automaticamente em ${formattedDate}**

Esta página descreve os endpoints públicos da camada IA da documentação do sistema. Eles permitem que agentes de IA (como o Cursor, Copilot, ou qualquer LLM) consumam a documentação de forma estruturada.

## Resumo do Sistema

- **Total de documentos públicos**: ${indexData.total_documents}
- **Total de tabelas no schema**: ${totalTables}
- **Tabelas documentadas**: ${documentedTables} de ${totalTables}
- **Tabelas com RLS**: ${tablesWithRls} de ${totalTables}

### Documentos por Categoria

${categorySummary}

---

## Endpoints

### 1. \`GET /functions/v1/docs-ai-index\`

Retorna o índice completo de toda a documentação pública, organizada por categoria.

**Campos retornados:**
- \`version\` — Versão do índice
- \`last_updated\` — Data/hora da geração
- \`total_documents\` — Total de documentos indexados
- \`modules[]\`, \`tables[]\`, \`rules[]\`, \`permissions[]\`, \`overview[]\` — Arrays por categoria
- \`endpoints\` — URLs template para acessar documentos individuais

**Campos de cada documento:**
- \`id\`, \`slug\`, \`title\`, \`category\`, \`type\`, \`summary\`, \`updated_at\`, \`related_tables[]\`

---

### 2. \`GET /functions/v1/docs-ai-item?slug={slug}&format={json|md}\`

Retorna o conteúdo completo de um documento específico.

**Parâmetros:**
- \`slug\` (obrigatório) — Identificador único do documento
- \`format\` (opcional) — \`json\` (padrão) ou \`md\` (Markdown puro)

**Exemplo de resposta JSON (truncada):**

\`\`\`json
${sampleItemJson}
\`\`\`

---

### 3. \`GET /functions/v1/docs-ai-schema\`

Retorna o mapa completo do schema do banco de dados, incluindo metadados de documentação e IA.

**Campos retornados por tabela:**
- \`table_name\` — Nome da tabela
- \`column_count\` — Quantidade de colunas
- \`has_rls\` — Se RLS está habilitado
- \`policy_count\` — Quantidade de policies RLS
- \`documentation_slug\` — Slug do documento associado (se houver)
- \`documentation_summary\` — Resumo da documentação
- \`entity_type\`, \`semantic_tags[]\`, \`related_entities\`, \`common_queries[]\`, \`business_context\` — Metadados enriquecidos

**Amostra de tabelas:**

| Tabela | Colunas | RLS | Policies | Doc |
|--------|---------|-----|----------|-----|
${topTables}

---

## Como Usar (para Agentes IA)

1. **Descoberta**: Chame \`docs-ai-index\` para obter a lista completa de documentos disponíveis
2. **Leitura**: Use \`docs-ai-item?slug={slug}\` para ler o conteúdo de um documento específico
3. **Schema**: Consulte \`docs-ai-schema\` para entender a estrutura do banco de dados
4. **Contexto**: Use os campos \`summary\`, \`semantic_tags\` e \`business_context\` para decidir quais documentos são relevantes para uma pergunta

## Autenticação

Todos os endpoints são públicos (não requerem JWT). Basta passar o \`apikey\` header com a chave anon do projeto.

\`\`\`bash
curl -H "apikey: {ANON_KEY}" \\
  ${functionsBase}/docs-ai-index
\`\`\``;

    // Update the document
    const { error: updateError } = await supabase
      .from('system_documentation')
      .update({
        content,
        summary: `Documentação dos ${indexData.total_documents} endpoints da camada IA. Schema com ${totalTables} tabelas (${documentedTables} documentadas). Atualizado em ${formattedDate}.`,
        updated_at: now,
      })
      .eq('slug', 'api-docs-ai-layer');

    if (updateError) throw updateError;

    console.log('Document api-docs-ai-layer updated successfully');

    return new Response(JSON.stringify({ success: true, updated_at: now }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('Error refreshing AI docs:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
