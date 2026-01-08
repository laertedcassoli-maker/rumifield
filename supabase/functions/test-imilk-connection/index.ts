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
    const imilkApiKey = Deno.env.get('IMILK_API_KEY');

    if (!imilkApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'IMILK_API_KEY não configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('Testing iMilk API connection...');

    // Test connection to iMilk API
    const imilkResponse = await fetch('http://n8n.rumina.com.br/webhook/imilk/rumiflow/clientes', {
      method: 'GET',
      headers: {
        'Authorization': imilkApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!imilkResponse.ok) {
      const errorText = await imilkResponse.text();
      console.error('iMilk API error:', imilkResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro na API: ${imilkResponse.status}`,
          details: errorText
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const data = await imilkResponse.json();
    const clientCount = Array.isArray(data) ? data.length : 0;

    console.log(`iMilk connection successful. Found ${clientCount} clients.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conexão com iMilk estabelecida com sucesso',
        total_clientes: clientCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error testing iMilk connection:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
