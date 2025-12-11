import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!imilkApiKey) {
      throw new Error('IMILK_API_KEY not configured');
    }

    console.log('Fetching clients from iMilk API...');

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

    if (!Array.isArray(imilkClientes)) {
      console.log('Response is not an array:', typeof imilkClientes, imilkClientes);
      throw new Error('Invalid response format from iMilk API');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Get existing clients by cod_imilk
    const { data: existingClients, error: fetchError } = await supabase
      .from('clientes')
      .select('id, cod_imilk');

    if (fetchError) {
      console.error('Error fetching existing clients:', fetchError);
      throw fetchError;
    }

    const existingCodIlmilkMap = new Map(
      existingClients?.filter(c => c.cod_imilk).map(c => [c.cod_imilk, c.id]) || []
    );

    let created = 0;
    let updated = 0;
    let errors: string[] = [];

    for (const imilkCliente of imilkClientes) {
      try {
        // Map iMilk fields to local fields based on actual API response
        const clienteData = {
          nome: imilkCliente.nome_cliente || 'Sem nome',
          cod_imilk: String(imilkCliente.id_cliente || ''),
        };

        if (!clienteData.cod_imilk) {
          console.log('Skipping client without cod_imilk:', imilkCliente);
          continue;
        }

        const existingId = existingCodIlmilkMap.get(clienteData.cod_imilk);

        if (existingId) {
          // Update existing client
          const { error: updateError } = await supabase
            .from('clientes')
            .update({
              ...clienteData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingId);

          if (updateError) {
            console.error('Error updating client:', updateError);
            errors.push(`Update error for ${clienteData.cod_imilk}: ${updateError.message}`);
          } else {
            updated++;
          }
        } else {
          // Insert new client
          const { error: insertError } = await supabase
            .from('clientes')
            .insert({
              ...clienteData,
              status: 'ativo',
            });

          if (insertError) {
            console.error('Error inserting client:', insertError);
            errors.push(`Insert error for ${clienteData.cod_imilk}: ${insertError.message}`);
          } else {
            created++;
          }
        }
      } catch (clientError) {
        console.error('Error processing client:', clientError);
        errors.push(`Processing error: ${clientError}`);
      }
    }

    console.log(`Sync completed: ${created} created, ${updated} updated, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total: imilkClientes.length,
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
    console.error('Error in sync-imilk-clientes:', error);
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
