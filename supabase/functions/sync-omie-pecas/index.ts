import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OmieProduto {
  codigo_produto: number;
  codigo: string;
  descricao: string;
  inativo: string;
  descricao_familia?: string;
}

interface OmieResponse {
  pagina: number;
  total_de_paginas: number;
  registros: number;
  total_de_registros: number;
  produto_servico_cadastro: OmieProduto[];
  faultstring?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Initialize Supabase client first to fetch credentials
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Fetch Omie credentials from configuracoes table
    const { data: configData, error: configError } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['omie_app_key', 'omie_app_secret']);

    if (configError) {
      throw new Error(`Error fetching config: ${configError.message}`);
    }

    const omieAppKey = configData?.find(c => c.chave === 'omie_app_key')?.valor;
    const omieAppSecret = configData?.find(c => c.chave === 'omie_app_secret')?.valor;

    if (!omieAppKey || !omieAppSecret) {
      throw new Error('Credenciais do Omie não configuradas. Acesse Configurações > Integrações para configurar.');
    }

    console.log('Fetching parts from Omie API...');

    const allPecas: OmieProduto[] = [];
    let currentPage = 1;
    let totalPages = 1;

    // Paginate through all results
    while (currentPage <= totalPages) {
      console.log(`Fetching page ${currentPage}...`);
      
      const omieResponse = await fetch('https://app.omie.com.br/api/v1/geral/produtos/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          call: 'ListarProdutos',
          app_key: omieAppKey,
          app_secret: omieAppSecret,
          param: [{
            pagina: currentPage,
            registros_por_pagina: 50,
            apenas_importado_api: 'N',
            filtrar_apenas_omiepdv: 'N',
          }],
        }),
      });

      if (!omieResponse.ok) {
        const errorText = await omieResponse.text();
        console.error('Omie API error:', omieResponse.status, errorText);
        throw new Error(`Omie API error: ${omieResponse.status} - ${errorText}`);
      }

      const data: OmieResponse = await omieResponse.json();
      
      if (data.faultstring) {
        throw new Error(`Omie API fault: ${data.faultstring}`);
      }

      console.log(`Page ${currentPage}: ${data.registros || 0} records, total pages: ${data.total_de_paginas || 1}`);
      
      if (data.produto_servico_cadastro) {
        // Filter only products from RUMIFLOW family (case insensitive)
        const rumiflowPecas = data.produto_servico_cadastro.filter(p => {
          const familia = (p.descricao_familia || '').toUpperCase();
          return familia === 'RUMIFLOW' || familia.includes('RUMIFLOW');
        });
        console.log(`Found ${rumiflowPecas.length} RUMIFLOW products on page ${currentPage}`);
        allPecas.push(...rumiflowPecas);
      }

      totalPages = data.total_de_paginas || 1;
      currentPage++;
    }

    console.log(`Total active parts found: ${allPecas.length}`);

    // Get existing parts by omie_codigo
    const { data: existingPecas, error: fetchError } = await supabase
      .from('pecas')
      .select('id, omie_codigo');

    if (fetchError) {
      console.error('Error fetching existing parts:', fetchError);
      throw fetchError;
    }

    const existingOmieCodigoMap = new Map(
      existingPecas?.filter(p => p.omie_codigo).map(p => [p.omie_codigo, p.id]) || []
    );

    let created = 0;
    let updated = 0;
    let errors: string[] = [];

    for (const omiePeca of allPecas) {
      try {
        const pecaData = {
          codigo: omiePeca.codigo || '',
          nome: omiePeca.descricao || 'Sem descrição',
          descricao: omiePeca.descricao || '',
          omie_codigo: String(omiePeca.codigo_produto),
          ativo: true,
        };

        if (!pecaData.omie_codigo) {
          console.log('Skipping part without codigo_produto:', omiePeca);
          continue;
        }

        const existingId = existingOmieCodigoMap.get(pecaData.omie_codigo);

        if (existingId) {
          // Update existing part
          const { error: updateError } = await supabase
            .from('pecas')
            .update({
              codigo: pecaData.codigo,
              nome: pecaData.nome,
              descricao: pecaData.descricao,
              ativo: pecaData.ativo,
            })
            .eq('id', existingId);

          if (updateError) {
            console.error('Error updating part:', updateError);
            errors.push(`Update error for ${pecaData.omie_codigo}: ${updateError.message}`);
          } else {
            updated++;
          }
        } else {
          // Insert new part
          const { error: insertError } = await supabase
            .from('pecas')
            .insert(pecaData);

          if (insertError) {
            console.error('Error inserting part:', insertError);
            errors.push(`Insert error for ${pecaData.omie_codigo}: ${insertError.message}`);
          } else {
            created++;
          }
        }
      } catch (pecaError) {
        console.error('Error processing part:', pecaError);
        errors.push(`Processing error: ${pecaError}`);
      }
    }

    console.log(`Sync completed: ${created} created, ${updated} updated, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total: allPecas.length,
        created,
        updated,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sync-omie-pecas:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
