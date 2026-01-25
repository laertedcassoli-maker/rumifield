import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TableInfo {
  table_name: string;
  column_count: number;
  has_rls: boolean;
  policy_count: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the tables to document from the request body
    const { tables } = await req.json();
    
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No tables provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating documentation for ${tables.length} tables:`, tables);

    // Get schema information for requested tables
    const { data: schemaData, error: schemaError } = await supabase.rpc('get_schema_tables');
    
    if (schemaError) {
      console.error('Error fetching schema:', schemaError);
      throw schemaError;
    }

    const tableInfoMap = new Map<string, TableInfo>();
    schemaData?.forEach((t: TableInfo) => {
      tableInfoMap.set(t.table_name, t);
    });

    // Generate documentation for each table
    const docsToInsert = [];
    
    for (const tableName of tables) {
      const tableInfo = tableInfoMap.get(tableName);
      
      if (!tableInfo) {
        console.warn(`Table ${tableName} not found in schema`);
        continue;
      }

      // Create documentation entry
      const slug = `tabela-${tableName.replace(/_/g, '-')}`;
      const title = formatTableTitle(tableName);
      
      const content = generateTableDocContent(tableName, tableInfo);
      const summary = `Documentação da tabela ${tableName}. ${tableInfo.column_count} colunas, RLS: ${tableInfo.has_rls ? 'Ativo' : 'Inativo'}, ${tableInfo.policy_count} política(s).`;

      docsToInsert.push({
        title,
        slug,
        category: 'tabela',
        summary,
        content,
        related_modules: [tableName],
        is_public: true
      });
    }

    if (docsToInsert.length === 0) {
      return new Response(
        JSON.stringify({ generated: 0, message: 'No valid tables to document' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert documentation entries
    const { data: insertedDocs, error: insertError } = await supabase
      .from('system_documentation')
      .upsert(docsToInsert, { onConflict: 'slug' })
      .select();

    if (insertError) {
      console.error('Error inserting documentation:', insertError);
      throw insertError;
    }

    console.log(`Successfully generated ${docsToInsert.length} documentation entries`);

    return new Response(
      JSON.stringify({ 
        generated: docsToInsert.length,
        docs: insertedDocs?.map(d => d.slug) || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating documentation:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function formatTableTitle(tableName: string): string {
  // Convert snake_case to Title Case
  return tableName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateTableDocContent(tableName: string, tableInfo: TableInfo): string {
  const rlsStatus = tableInfo.has_rls ? '✅ Ativo' : '❌ Inativo';
  const policyInfo = tableInfo.policy_count > 0 
    ? `${tableInfo.policy_count} política(s) configurada(s)`
    : 'Nenhuma política configurada';

  return `## Visão Geral

A tabela \`${tableName}\` faz parte do schema público do banco de dados.

## Estrutura

| Propriedade | Valor |
|-------------|-------|
| **Nome da Tabela** | \`${tableName}\` |
| **Número de Colunas** | ${tableInfo.column_count} |
| **RLS (Row Level Security)** | ${rlsStatus} |
| **Políticas de Acesso** | ${policyInfo} |

## Colunas

*Documentação das colunas será adicionada manualmente.*

## Relacionamentos

*Documentar relacionamentos com outras tabelas.*

## Regras de Negócio

*Documentar regras de negócio específicas desta tabela.*

## Políticas de Segurança

${tableInfo.has_rls 
  ? `Esta tabela possui Row Level Security (RLS) ativo com ${tableInfo.policy_count} política(s).

*Detalhar as políticas de acesso configuradas.*`
  : `⚠️ **Atenção**: Esta tabela não possui RLS ativo. Considere ativar para proteger os dados.`
}

## Observações

*Adicionar observações relevantes sobre o uso desta tabela.*`;
}
