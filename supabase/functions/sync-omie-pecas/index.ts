import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OmieImagem {
  url_imagem: string;
}

interface OmieProduto {
  codigo_produto: number;
  codigo: string;
  descricao: string;
  inativo: string;
  descricao_familia?: string;
  imagens?: OmieImagem[];
}

interface OmieEstoqueItem {
  codigo_local_estoque: number;
  nCodProd: number;
  cCodigo: string;
  cDescricao: string;
  nEstoque: number;
  nSaldo: number;
}

interface OmieEstoqueResponse {
  nPagina: number;
  nTotPaginas: number;
  nRegistros: number;
  nTotRegistros: number;
  lista_posestoque: OmieEstoqueItem[];
  faultstring?: string;
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
            inativo: 'N',
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
        // Filter only ACTIVE products from RUMIFLOW family (case insensitive)
        const rumiflowPecas = data.produto_servico_cadastro.filter(p => {
          const familia = (p.descricao_familia || '').toUpperCase();
          const ativo = (p.inativo || '').toUpperCase() === 'N';
          return ativo && (familia === 'RUMIFLOW' || familia.includes('RUMIFLOW'));
        });
        console.log(`Found ${rumiflowPecas.length} RUMIFLOW products on page ${currentPage}`);
        allPecas.push(...rumiflowPecas);
      }

      totalPages = data.total_de_paginas || 1;
      currentPage++;
    }

    console.log(`Total active parts found: ${allPecas.length}`);

    // Fetch stock information from Omie
    console.log('Fetching stock information from Omie...');
    const estoqueMap = new Map<string, number>();
    
    // Get today's date in DD/MM/YYYY format for Omie API
    const today = new Date();
    const dataFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    
    let estoqueCurrentPage = 1;
    let estoqueTotalPages = 1;
    
    while (estoqueCurrentPage <= estoqueTotalPages) {
      console.log(`Fetching stock page ${estoqueCurrentPage}...`);
      
      const estoqueResponse = await fetch('https://app.omie.com.br/api/v1/estoque/consulta/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          call: 'ListarPosEstoque',
          app_key: omieAppKey,
          app_secret: omieAppSecret,
          param: [{
            nPagina: estoqueCurrentPage,
            nRegPorPagina: 100,
            dDataPosicao: dataFormatted,
          }],
        }),
      });

      if (estoqueResponse.ok) {
        const estoqueData = await estoqueResponse.json();
        console.log('Stock API raw response:', JSON.stringify(estoqueData).substring(0, 500));
        
        // Check for different response formats from Omie
        if (estoqueData.faultstring) {
          console.warn('Omie stock API fault:', estoqueData.faultstring);
          break;
        }
        
        // The API might return produtos_cadastro or lista_posestoque
        const estoqueItems = estoqueData.lista_posestoque || estoqueData.produtos || [];
        
        if (estoqueItems.length > 0) {
          for (const item of estoqueItems) {
            // Try different field names that Omie might use
            const codigoProduto = item.nCodProd || item.codigo_produto || item.nCodigo;
            const quantidade = item.nSaldo || item.nEstoque || item.saldo || item.estoque || 0;
            if (codigoProduto) {
              estoqueMap.set(String(codigoProduto), quantidade);
            }
          }
          console.log(`Stock page ${estoqueCurrentPage}: ${estoqueItems.length} records`);
          estoqueTotalPages = estoqueData.nTotPaginas || estoqueData.total_de_paginas || 1;
        } else {
          console.log('No stock items in response, keys:', Object.keys(estoqueData));
          break;
        }
      } else {
        const errorText = await estoqueResponse.text();
        console.warn('Failed to fetch stock data:', estoqueResponse.status, errorText);
        break;
      }
      
      estoqueCurrentPage++;
    }
    
    console.log(`Stock info fetched for ${estoqueMap.size} products`);

    // Get existing parts by omie_codigo (include inactive ones)
    const { data: existingPecas, error: fetchError } = await supabase
      .from('pecas')
      .select('id, omie_codigo, ativo');

    if (fetchError) {
      console.error('Error fetching existing parts:', fetchError);
      throw fetchError;
    }

    const existingOmieCodigoMap = new Map(
      existingPecas?.filter(p => p.omie_codigo).map(p => [p.omie_codigo, { id: p.id, ativo: p.ativo }]) || []
    );

    // Set of omie_codigo from Omie API (active products)
    const omieCodigoSet = new Set<string>();

    let created = 0;
    let updated = 0;
    let reactivated = 0;
    let deactivated = 0;
    let errors: string[] = [];

    for (const omiePeca of allPecas) {
      try {
        // Get first image URL if available
        const imagemUrl = omiePeca.imagens && omiePeca.imagens.length > 0 
          ? omiePeca.imagens[0].url_imagem 
          : null;

        // Get stock quantity for this product
        const quantidadeEstoque = estoqueMap.get(String(omiePeca.codigo_produto)) || 0;

        const pecaData = {
          codigo: omiePeca.codigo || '',
          nome: omiePeca.descricao || 'Sem descrição',
          descricao: omiePeca.descricao || '',
          omie_codigo: String(omiePeca.codigo_produto),
          familia: omiePeca.descricao_familia || null,
          ativo: true,
          imagem_url: imagemUrl,
          quantidade_estoque: quantidadeEstoque,
        };

        if (!pecaData.omie_codigo) {
          console.log('Skipping part without codigo_produto:', omiePeca);
          continue;
        }

        omieCodigoSet.add(pecaData.omie_codigo);

        const existing = existingOmieCodigoMap.get(pecaData.omie_codigo);

        if (existing) {
          // Update existing part (also reactivate if was inactive)
          const wasInactive = existing.ativo === false;
          
          const { error: updateError } = await supabase
            .from('pecas')
            .update({
              codigo: pecaData.codigo,
              nome: pecaData.nome,
              descricao: pecaData.descricao,
              familia: pecaData.familia,
              ativo: true, // Always reactivate if in Omie
              imagem_url: pecaData.imagem_url,
              quantidade_estoque: pecaData.quantidade_estoque,
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('Error updating part:', updateError);
            errors.push(`Update error for ${pecaData.omie_codigo}: ${updateError.message}`);
          } else {
            updated++;
            if (wasInactive) {
              reactivated++;
              console.log(`Reactivated part ${pecaData.omie_codigo}`);
            }
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

    // IMPORTANT: Mark parts as inactive if they're no longer in Omie (NEVER DELETE)
    for (const [omie_codigo, existing] of existingOmieCodigoMap) {
      if (!omieCodigoSet.has(omie_codigo) && existing.ativo !== false) {
        const { error: deactivateError } = await supabase
          .from('pecas')
          .update({ ativo: false })
          .eq('id', existing.id);

        if (deactivateError) {
          console.error('Error deactivating part:', deactivateError);
          errors.push(`Deactivate error for ${omie_codigo}: ${deactivateError.message}`);
        } else {
          deactivated++;
          console.log(`Deactivated part ${omie_codigo} (not in Omie anymore)`);
        }
      }
    }

    console.log(`Sync completed: ${created} created, ${updated} updated, ${reactivated} reactivated, ${deactivated} deactivated, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total: allPecas.length,
        created,
        updated,
        reactivated,
        deactivated,
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
