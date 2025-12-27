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
        JSON.stringify({ transcription, clienteEncontrado: null, dataVisita: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${clientes?.length || 0} active clients`);

    // Step 3: Use AI to identify the client AND date mentioned in the transcription
    const clientesList = clientes?.map(c => `- ${c.nome}${c.fazenda ? ` (Fazenda: ${c.fazenda})` : ''}`).join('\n') || '';
    
    // Get current date for context
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

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
            content: `Você é um assistente que extrai informações de transcrições de áudio sobre visitas a clientes.
Analise a transcrição e identifique:
1. O cliente mencionado (da lista fornecida)
2. A data da visita mencionada

Para a data, considere:
- Datas explícitas como "dia 15 de janeiro", "15/01", etc.
- Referências relativas como "hoje", "ontem", "semana passada", "segunda-feira passada"
- Se não houver data mencionada, retorne null

A data de hoje é: ${todayStr}

Responda APENAS no formato JSON:
{
  "cliente": "Nome exato do cliente da lista ou null",
  "data": "YYYY-MM-DD ou null"
}`
          },
          {
            role: "user",
            content: `Transcrição do áudio:
"${transcription}"

Lista de clientes cadastrados:
${clientesList}

Extraia o cliente e a data da visita desta transcrição.`
          }
        ]
      }),
    });

    let clienteEncontrado = null;
    let dataVisita = null;

    if (identifyResponse.ok) {
      const identifyData = await identifyResponse.json();
      const responseText = identifyData.choices?.[0]?.message?.content?.trim() || "";
      
      console.log('AI response:', responseText);

      try {
        // Try to parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Extract date
          if (parsed.data && parsed.data !== "null") {
            dataVisita = parsed.data;
            console.log('Extracted date:', dataVisita);
          }

          // Extract client
          if (parsed.cliente && parsed.cliente !== "null") {
            const clienteNome = parsed.cliente;
            console.log('AI identified client:', clienteNome);

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
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
      }
    } else {
      console.error('Error identifying client/date:', await identifyResponse.text());
    }

    return new Response(
      JSON.stringify({ transcription, clienteEncontrado, dataVisita }),
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
