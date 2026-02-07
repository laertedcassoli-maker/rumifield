import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const mode = body.mode || 'transcribe';

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // ===== SUMMARIZE MODE =====
    if (mode === 'summarize') {
      const { text } = body;
      if (!text) throw new Error('No text provided for summarization');

      console.log('Summarizing transcription, length:', text.length);

      const summarizeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: `Você é um assistente que resume transcrições de visitas comerciais/técnicas em bullet points objetivos.
Extraia os pontos principais:
- Problemas identificados
- Ações realizadas ou sugeridas
- Observações importantes
- Próximos passos
Responda APENAS no formato JSON: { "summary": ["ponto 1", "ponto 2", ...] }
Máximo 8 bullet points. Seja conciso e objetivo.`
            },
            {
              role: "user",
              content: `Resuma esta transcrição de visita:\n\n"${text}"`
            }
          ]
        }),
      });

      if (!summarizeResponse.ok) {
        const errorText = await summarizeResponse.text();
        console.error('Summarize error:', summarizeResponse.status, errorText);
        throw new Error(`AI gateway error: ${summarizeResponse.status}`);
      }

      const summarizeData = await summarizeResponse.json();
      const responseText = summarizeData.choices?.[0]?.message?.content?.trim() || "";

      let summary: string[] = [];
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          summary = Array.isArray(parsed.summary) ? parsed.summary : [];
        }
      } catch (e) {
        console.error('Error parsing summary response:', e);
        summary = [responseText];
      }

      return new Response(
        JSON.stringify({ summary }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== TRANSCRIBE MODE (default) =====
    const { audio } = body;
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Received audio data, length:', audio.length);

    const audioDataUrl = `data:audio/webm;base64,${audio}`;

    console.log('Sending request to Lovable AI Gateway for transcription...');

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

    // For visit audio mode, just return the transcription without client matching
    if (body.skipClientMatch) {
      return new Response(
        JSON.stringify({ transcription }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Legacy mode: match client + extract date + summarize
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

    const clientesList = clientes?.map(c => `- ${c.nome}${c.fazenda ? ` (Fazenda: ${c.fazenda})` : ''}`).join('\n') || '';
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
3. Um resumo objetivo da visita em bullet points

Para a data, considere:
- Datas explícitas como "dia 15 de janeiro", "15/01", etc.
- Referências relativas como "hoje", "ontem", "semana passada", "segunda-feira passada"
- Se não houver data mencionada, retorne null

Para o resumo, extraia os pontos principais mencionados na visita como:
- Problemas identificados
- Ações realizadas
- Observações importantes
- Próximos passos sugeridos

A data de hoje é: ${todayStr}

Responda APENAS no formato JSON:
{
  "cliente": "Nome exato do cliente da lista ou null",
  "data": "YYYY-MM-DD ou null",
  "resumo": ["Ponto 1", "Ponto 2", "Ponto 3"] ou []
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
    let resumo: string[] = [];

    if (identifyResponse.ok) {
      const identifyData = await identifyResponse.json();
      const responseText = identifyData.choices?.[0]?.message?.content?.trim() || "";
      
      console.log('AI response:', responseText);

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          if (parsed.data && parsed.data !== "null") {
            dataVisita = parsed.data;
          }

          if (parsed.resumo && Array.isArray(parsed.resumo)) {
            resumo = parsed.resumo;
          }

          if (parsed.cliente && parsed.cliente !== "null") {
            const clienteNome = parsed.cliente;
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
      JSON.stringify({ transcription, clienteEncontrado, dataVisita, resumo }),
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
