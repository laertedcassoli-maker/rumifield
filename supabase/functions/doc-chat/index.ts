import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Pergunta é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Received question:", question);

    // Get Supabase client to fetch documentation
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all documentation
    const { data: docs, error: docsError } = await supabase
      .from("system_documentation")
      .select("id, title, slug, category, content, summary")
      .order("category");

    if (docsError) {
      console.error("Error fetching documentation:", docsError);
      return new Response(
        JSON.stringify({ error: "Erro ao carregar documentação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!docs || docs.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "A documentação do sistema ainda não foi cadastrada. Por favor, adicione documentos antes de usar o chat.",
          source_docs: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Loaded ${docs.length} documentation entries`);

    // Build context from documentation
    const docContext = docs
      .map((doc) => `## ${doc.title}\n\n${doc.content}`)
      .join("\n\n---\n\n");

    const docList = docs
      .map((doc) => `- ${doc.title} (${doc.category}): ${doc.summary || ""}`)
      .join("\n");

    // Get Lovable AI API key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "API de IA não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the system prompt
    const systemPrompt = `Você é um assistente especializado no sistema RumiField. Você responde perguntas EXCLUSIVAMENTE com base na documentação oficial do sistema fornecida abaixo.

REGRAS IMPORTANTES:
1. Responda APENAS com informações contidas na documentação fornecida
2. Se a informação não estiver documentada, responda: "Essa regra não está documentada no sistema atualmente."
3. Sempre cite qual documento/módulo contém a informação da sua resposta
4. Seja claro, objetivo e em português brasileiro
5. Formate sua resposta em markdown quando apropriado
6. Ao final da resposta, indique entre colchetes o documento fonte, ex: [Fonte: Chamados Técnicos]

DOCUMENTAÇÃO DISPONÍVEL:
${docList}

CONTEÚDO COMPLETO DA DOCUMENTAÇÃO:
${docContext}`;

    // Call Lovable AI
    console.log("Calling Lovable AI...");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        temperature: 0.3, // Lower temperature for more factual responses
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao processar pergunta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const answer = aiResponse.choices?.[0]?.message?.content || "Não foi possível gerar uma resposta.";

    console.log("AI response received");

    // Try to identify which docs were used based on the answer
    const usedDocs: string[] = [];
    for (const doc of docs) {
      if (answer.toLowerCase().includes(doc.title.toLowerCase()) || 
          answer.toLowerCase().includes(doc.slug.replace(/-/g, " "))) {
        usedDocs.push(doc.id);
      }
    }

    return new Response(
      JSON.stringify({
        answer,
        source_doc_ids: usedDocs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in doc-chat function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
