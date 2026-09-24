import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireRole } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    let conta = 'principal';
    try {
      const body = await req.json();
      if (body?.conta === 'futurecow') conta = 'futurecow';
    } catch { /* sem corpo = principal */ }
    const prefix = conta === 'futurecow' ? 'OMIE_FUTURECOW' : 'OMIE';
    const app_key = Deno.env.get(`${prefix}_APP_KEY`)?.trim();
    const app_secret = Deno.env.get(`${prefix}_APP_SECRET`)?.trim();

    if (!app_key || !app_secret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciais do Omie não configuradas nos segredos do backend.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // First test with products API (always works)
    const prodResponse = await fetch('https://app.omie.com.br/api/v1/geral/produtos/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: 'ListarProdutos',
        app_key,
        app_secret,
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
          details: 'Credenciais inválidas ou sem permissão',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    let empresa = null;
    try {
      const empresaResponse = await fetch('https://app.omie.com.br/api/v1/geral/empresas/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call: 'ListarEmpresas',
          app_key,
          app_secret,
          param: [{
            pagina: 1,
            registros_por_pagina: 1,
          }],
        }),
      });

      const empresaData = await empresaResponse.json();

      if (!empresaData.faultstring) {
        const empresas = empresaData.empresas_cadastro || [];
        empresa = empresas[0] || null;
      }
    } catch (e) {
      console.warn('Could not fetch company info');
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
        total_produtos: prodData.total_de_registros || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Test connection error');
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
