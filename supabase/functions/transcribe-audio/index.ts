import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

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
    const { audio } = await req.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Received audio data, length:', audio.length);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Convert base64 audio to data URL for Gemini
    const audioDataUrl = `data:audio/webm;base64,${audio}`;

    console.log('Sending request to Lovable AI Gateway for transcription...');

    // Step 1: Transcribe the audio
    const transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Por favor, transcreva este áudio para texto. Retorne APENAS a transcrição, sem comentários adicionais ou formatação extra."
              },
              {
                type: "image_url",
                image_url: {
                  url: audioDataUrl
                }
              }
            ]
          }
        ]
      }),
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error('Lovable AI error:', transcribeResponse.status, errorText);
      
      if (transcribeResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (transcribeResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${transcribeResponse.status}`);
    }

    const transcribeData = await transcribeResponse.json();
    console.log('Received transcription:', JSON.stringify(transcribeData).substring(0, 200));

    const transcription = transcribeData.choices?.[0]?.message?.content || "";

    // Step 2: Get list of clients from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select('id, nome, fazenda')
      .eq('status', 'ativo');

    if (clientesError) {
      console.error('Error fetching clients:', clientesError);
      return new Response(
        JSON.stringify({ transcription, clienteEncontrado: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${clientes?.length || 0} active clients`);

    // Step 3: Use AI to identify the client mentioned in the transcription
    const clientesList = clientes?.map(c => `- ${c.nome}${c.fazenda ? ` (Fazenda: ${c.fazenda})` : ''}`).join('\n') || '';

    const identifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que identifica clientes mencionados em textos. 
Analise a transcrição e identifique qual cliente da lista está sendo mencionado.
Considere variações de nome, apelidos, nomes de fazenda e possíveis erros de transcrição.
Se encontrar um cliente, responda APENAS com o nome exato como aparece na lista.
Se não encontrar nenhum cliente correspondente, responda "NENHUM_CLIENTE_ENCONTRADO".`
          },
          {
            role: "user",
            content: `Transcrição do áudio:
"${transcription}"

Lista de clientes cadastrados:
${clientesList}

Qual cliente está sendo mencionado nesta transcrição?`
          }
        ]
      }),
    });

    let clienteEncontrado = null;

    if (identifyResponse.ok) {
      const identifyData = await identifyResponse.json();
      const clienteNome = identifyData.choices?.[0]?.message?.content?.trim() || "";
      
      console.log('AI identified client:', clienteNome);

      if (clienteNome && clienteNome !== "NENHUM_CLIENTE_ENCONTRADO") {
        // Find the matching client
        const matchedCliente = clientes?.find(c => 
          c.nome.toLowerCase().includes(clienteNome.toLowerCase()) ||
          clienteNome.toLowerCase().includes(c.nome.toLowerCase())
        );

        if (matchedCliente) {
          clienteEncontrado = {
            id: matchedCliente.id,
            nome: matchedCliente.nome,
            fazenda: matchedCliente.fazenda
          };
        }
      }
    } else {
      console.error('Error identifying client:', await identifyResponse.text());
    }

    return new Response(
      JSON.stringify({ transcription, clienteEncontrado }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
