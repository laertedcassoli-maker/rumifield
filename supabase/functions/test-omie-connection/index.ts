import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { app_key, app_secret } = await req.json();

    if (!app_key || !app_secret) {
      return new Response(
        JSON.stringify({ success: false, error: 'APP KEY e APP SECRET são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // First test with products API (always works)
    const prodResponse = await fetch('https://app.omie.com.br/api/v1/geral/produtos/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: 'ListarProdutos',
        app_key: app_key,
        app_secret: app_secret,
        param: [{
          pagina: 1,
          registros_por_pagina: 1,
          apenas_importado_api: 'N',
        }],
      }),
    });

    const prodData = await prodResponse.json();

    if (prodData.faultstring) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: prodData.faultstring,
          details: 'Credenciais inválidas ou sem permissão'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Now try to get company info using ListarEmpresas with proper pagination params
    let empresa = null;
    try {
      const empresaResponse = await fetch('https://app.omie.com.br/api/v1/geral/empresas/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call: 'ListarEmpresas',
          app_key: app_key,
          app_secret: app_secret,
          param: [{
            pagina: 1,
            registros_por_pagina: 1,
          }],
        }),
      });

      const empresaData = await empresaResponse.json();
      console.log('Empresa API response:', JSON.stringify(empresaData).substring(0, 500));
      
      if (!empresaData.faultstring) {
        const empresas = empresaData.empresas_cadastro || [];
        empresa = empresas[0] || null;
      }
    } catch (e) {
      console.warn('Could not fetch company info:', e);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conexão estabelecida com sucesso!',
        empresa: empresa ? {
          cnpj: empresa.cnpj || null,
          razao_social: empresa.razao_social || null,
          nome_fantasia: empresa.nome_fantasia || null,
        } : null,
        total_produtos: prodData.total_de_registros || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Test connection error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
