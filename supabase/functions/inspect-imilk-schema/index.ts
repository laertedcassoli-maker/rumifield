import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const imilkApiKey = Deno.env.get('IMILK_API_KEY');

    if (!imilkApiKey) {
      throw new Error('IMILK_API_KEY not configured');
    }

    console.log('Fetching clients from iMilk API to inspect schema...');

    // Fetch clients from iMilk API
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
      throw new Error(`iMilk API error: ${imilkResponse.status} - ${errorText}`);
    }

    const imilkClientes = await imilkResponse.json();
    console.log(`Received ${Array.isArray(imilkClientes) ? imilkClientes.length : 0} clients from iMilk`);

    if (!Array.isArray(imilkClientes) || imilkClientes.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No clients returned from iMilk API',
          raw_response: imilkClientes,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the first client as a sample
    const sampleClient = imilkClientes[0];
    
    // Extract field names and types
    const fields = Object.entries(sampleClient).map(([key, value]) => ({
      field: key,
      type: typeof value,
      sample_value: value,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        total_clients: imilkClientes.length,
        sample_client: sampleClient,
        fields: fields,
        all_field_names: Object.keys(sampleClient),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in inspect-imilk-schema:', error);
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
