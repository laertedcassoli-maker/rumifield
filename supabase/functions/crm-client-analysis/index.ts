import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId } = await req.json();
    if (!clientId) {
      return new Response(JSON.stringify({ error: "clientId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[crm-client-analysis] Starting analysis for client:", clientId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all data in parallel
    const [
      clientRes,
      productsRes,
      snapshotsRes,
      visitsRes,
      actionsRes,
      proposalsRes,
      audiosRes,
      ticketsRes,
      preventivesRes,
      correctivesRes,
      metricDefsRes,
    ] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", clientId).single(),
      supabase.from("crm_client_products").select("*").eq("client_id", clientId),
      supabase.from("crm_client_product_snapshots").select("*").eq("client_id", clientId).order("snapshot_at", { ascending: false }).limit(20),
      supabase.from("crm_visits").select("id, status, objective, summary, checkin_at, checkout_at, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
      supabase.from("crm_actions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30),
      supabase.from("crm_proposals").select("*, crm_client_products(product_code)").eq("crm_client_products.client_id", clientId),
      supabase.from("crm_visit_audios").select("product_code, transcription, summary, status, created_at").eq("visit_id", clientId),
      supabase.from("ticket_visits").select("id, status, created_at, ticket:tickets(id, titulo, status, prioridade, created_at)").eq("tickets.client_id", clientId).limit(20),
      supabase.from("preventive_route_clients").select("route:preventive_routes(id, name, status, start_date, end_date)").eq("client_id", clientId).limit(20),
      supabase.from("corrective_maintenance").select("id, status, checkin_at, checkout_at, notes, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
      supabase.from("crm_metric_definitions").select("*").eq("is_active", true).order("priority"),
    ]);

    const client = clientRes.data;
    if (!client) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also fetch audio transcriptions from visits of this client
    const visitIds = (visitsRes.data || []).map((v: any) => v.id);
    let visitAudios: any[] = [];
    if (visitIds.length > 0) {
      const { data } = await supabase
        .from("crm_visit_audios")
        .select("product_code, transcription, summary, created_at")
        .in("visit_id", visitIds)
        .not("transcription", "is", null);
      visitAudios = data || [];
    }

    // Build product labels map
    const PRODUCT_LABELS: Record<string, string> = {
      ideagri: "Ideagri",
      rumiflow: "RumiFlow",
      onfarm: "OnFarm",
      rumiaction: "RumiAction",
      procare: "RumiProcare",
    };

    const STAGE_LABELS: Record<string, string> = {
      nao_qualificado: "Não Qualificado",
      qualificado: "Qualificado",
      proposta: "Proposta",
      negociacao: "Negociação",
      ganho: "Ganho (Ativo)",
      perdido: "Perdido",
    };

    // Build context
    const sections: string[] = [];

    // 1. Client info
    sections.push(`## Cliente
- Nome: ${client.nome}
- Fazenda: ${client.fazenda || "N/A"}
- Cidade/UF: ${client.cidade || ""}/${client.estado || ""}
- Telefone: ${client.telefone || "N/A"}
- Status: ${client.status}
- Contrato: ${client.modelo_contrato || "N/A"}
- Ordenhas/dia: ${client.ordenhas_dia || "N/A"}
- Pistolas: ${client.quantidade_pistolas || "N/A"}`);

    // 2. Products and stages
    const products = productsRes.data || [];
    if (products.length > 0) {
      const productLines = products.map((p: any) =>
        `- ${PRODUCT_LABELS[p.product_code] || p.product_code}: ${STAGE_LABELS[p.stage] || p.stage}${p.value_estimated ? ` (R$ ${p.value_estimated})` : ""}${p.probability ? ` prob=${p.probability}%` : ""}${p.notes ? ` | ${p.notes}` : ""}`
      );
      sections.push(`## Produtos CRM\n${productLines.join("\n")}`);
    }

    // 3. Health metrics (snapshots)
    const snapshots = snapshotsRes.data || [];
    const defs = metricDefsRes.data || [];
    if (snapshots.length > 0 && defs.length > 0) {
      const metricLines: string[] = [];
      for (const snap of snapshots) {
        const data = snap.data as Record<string, any> || {};
        const productDefs = defs.filter((d: any) => d.product_code === snap.product_code);
        const metrics = productDefs.map((d: any) => `${d.label}: ${data[d.metric_key] ?? "N/A"}${d.unit ? ` ${d.unit}` : ""}`).join(", ");
        if (metrics) {
          metricLines.push(`- ${PRODUCT_LABELS[snap.product_code] || snap.product_code} (${snap.snapshot_at?.substring(0, 10)}): saúde=${snap.health_status || "N/A"} | ${metrics}`);
        }
      }
      if (metricLines.length > 0) {
        sections.push(`## Métricas de Saúde (Snapshots)\n${metricLines.join("\n")}`);
      }
    }

    // 4. Visits
    const visits = visitsRes.data || [];
    if (visits.length > 0) {
      const visitLines = visits.map((v: any) =>
        `- ${v.created_at?.substring(0, 10)} | status=${v.status} | obj: ${v.objective || "N/A"} | resumo: ${v.summary || "N/A"}`
      );
      sections.push(`## Visitas CRM (últimas ${visits.length})\n${visitLines.join("\n")}`);
    }

    // 5. Actions
    const actions = actionsRes.data || [];
    if (actions.length > 0) {
      const actionLines = actions.map((a: any) =>
        `- [${a.status}] ${a.title}${a.due_at ? ` (prazo: ${a.due_at.substring(0, 10)})` : ""} tipo=${a.type} prioridade=${a.priority}`
      );
      sections.push(`## Ações CRM\n${actionLines.join("\n")}`);
    }

    // 6. Audio transcriptions
    if (visitAudios.length > 0) {
      const audioLines = visitAudios.map((a: any) =>
        `- [${PRODUCT_LABELS[a.product_code] || a.product_code}] ${a.created_at?.substring(0, 10)}: ${a.transcription?.substring(0, 500) || ""}${a.summary ? "\n  Resumo: " + (a.summary as string[]).join("; ") : ""}`
      );
      sections.push(`## Transcrições de Áudios de Visitas\n${audioLines.join("\n")}`);
    }

    // 7. Corrective maintenance
    const correctives = correctivesRes.data || [];
    if (correctives.length > 0) {
      const corrLines = correctives.map((c: any) =>
        `- ${c.created_at?.substring(0, 10)} | status=${c.status}${c.notes ? ` | ${c.notes}` : ""}`
      );
      sections.push(`## Manutenções Corretivas (últimas ${correctives.length})\n${corrLines.join("\n")}`);
    }

    // 8. Preventive routes
    const preventives = preventivesRes.data || [];
    if (preventives.length > 0) {
      const prevLines = preventives
        .filter((p: any) => p.route)
        .map((p: any) => `- Rota: ${p.route.name} | status=${p.route.status} | ${p.route.start_date || ""} a ${p.route.end_date || ""}`);
      if (prevLines.length > 0) {
        sections.push(`## Preventivas\n${prevLines.join("\n")}`);
      }
    }

    const fullContext = sections.join("\n\n");
    console.log("[crm-client-analysis] Context length:", fullContext.length, "chars");

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API de IA não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um analista de sucesso do cliente no agronegócio leiteiro. Analise os dados fornecidos e gere um resumo CURTO e OBJETIVO em português brasileiro.

Estrutura (use apenas as seções que tiverem dados relevantes):

### 📍 Situação Atual
2-3 frases diretas: produtos ativos e estágio no funil, saúde da conta, última visita.

### ⚠️ Pontos de Atenção
Lista curta APENAS com alertas reais extraídos dos dados:
- Ações atrasadas (cite título e prazo)
- Métricas de saúde ruins (cite valores específicos)
- Chamados/corretivas abertas
- Tempo sem visita (cite última data)
- Produtos em risco de churn

### 🎯 Próximos Passos
2-3 ações concretas e prioritárias baseadas nos dados acima.

REGRAS OBRIGATÓRIAS:
- Use EXCLUSIVAMENTE os dados fornecidos, NUNCA invente ou suponha
- OMITA seções inteiras se não houver dados relevantes para elas
- NUNCA use frases genéricas como "recomenda-se acompanhar de perto" ou "manter contato regular"
- Cite datas, valores e status específicos dos dados
- Máximo de 400 palavras no total
- Vá direto ao ponto, sem introduções, saudações ou conclusões formais
- Formate valores monetários em R$ com separador de milhar`;

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
          { role: "user", content: `Analise o seguinte cliente:\n\n${fullContext}` },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[crm-client-analysis] AI error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao gerar análise" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const analysis = aiResponse.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    console.log("[crm-client-analysis] Analysis generated successfully");

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[crm-client-analysis] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
