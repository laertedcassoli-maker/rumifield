import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper: group array by key and count
function groupAndCount(arr: any[], key: string): { label: string; count: number }[] {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const label = item[key] || "N/A";
    map[label] = (map[label] || 0) + 1;
  }
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// Helper: group parts by name summing quantities
function groupParts(arr: any[]): { label: string; total: number }[] {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const label = item.part_name_snapshot || "N/A";
    map[label] = (map[label] || 0) + (item.quantity || 1);
  }
  return Object.entries(map)
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

// Helper: count by status
function countByStatus(arr: any[], field = "status"): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const s = item[field] || "N/A";
    map[s] = (map[s] || 0) + 1;
  }
  return map;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, question } = await req.json();
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[client-intelligence] Starting for client:", clientId, "question:", question?.substring(0, 80));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ====== WAVE 1: Independent queries ======
    const [
      clientRes,
      prevMaintenanceRes,
      ticketsRes,
      ticketVisitsRes,
      crmVisitsRes,
      crmProductsRes,
      crmActionsRes,
      pedidosRes,
      estoqueRes,
      enviosRes,
    ] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", clientId).single(),
      supabase
        .from("preventive_maintenance")
        .select("id, status, scheduled_date, completed_date, notes, route_id")
        .eq("client_id", clientId)
        .order("scheduled_date", { ascending: false })
        .limit(12),
      supabase
        .from("technical_tickets")
        .select("id, code, title, status, priority, created_at, resolved_at, client_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("ticket_visits")
        .select("id, visit_code, status, result, planned_start_date, checkin_at, checkout_at, visit_summary, ticket_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("crm_visits")
        .select("id, status, objective, summary, checkin_at, checkout_at, created_at, owner_user_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("crm_client_products")
        .select("id, product_code, stage, value_estimated, probability, notes, loss_notes, loss_reason_id, stage_updated_at")
        .eq("client_id", clientId),
      supabase
        .from("crm_actions")
        .select("id, title, type, status, priority, due_at, description, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("pedidos")
        .select("id, status, created_at, observacoes, pedido_itens(id, quantidade, pecas(nome, codigo))")
        .eq("cliente_id", clientId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("estoque_cliente")
        .select("id, quantidade, galoes_cheios, nivel_galao_parcial, data_afericao, produtos_quimicos(nome)")
        .eq("cliente_id", clientId)
        .order("data_afericao", { ascending: false })
        .limit(10),
      supabase
        .from("envios_produtos")
        .select("id, quantidade, galoes, data_envio, produtos_quimicos(nome)")
        .eq("cliente_id", clientId)
        .order("data_envio", { ascending: false })
        .limit(15),
    ]);

    const client = clientRes.data;
    if (!client) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const preventivas = prevMaintenanceRes.data || [];
    const chamados = ticketsRes.data || [];
    const ticketVisitas = ticketVisitsRes.data || [];
    const crmVisits = crmVisitsRes.data || [];
    const crmProducts = crmProductsRes.data || [];
    const crmActions = crmActionsRes.data || [];
    const pedidos = pedidosRes.data || [];
    const estoque = estoqueRes.data || [];
    const envios = enviosRes.data || [];

    // ====== WAVE 2: Dependent queries ======
    const prevIds = preventivas.map((p: any) => p.id);
    const crmVisitIds = crmVisits.map((v: any) => v.id);
    const crmProductIds = crmProducts.map((p: any) => p.id);

    const wave2Promises: Promise<any>[] = [];

    // Preventive parts consumption
    wave2Promises.push(
      prevIds.length > 0
        ? supabase
            .from("preventive_part_consumption")
            .select("part_name_snapshot, quantity, consumed_at")
            .in("preventive_id", prevIds)
            .limit(100)
        : Promise.resolve({ data: [] })
    );

    // CRM visit audios
    wave2Promises.push(
      crmVisitIds.length > 0
        ? supabase
            .from("crm_visit_audios")
            .select("id, duration_seconds, transcription, summary, status, visit_id, created_at")
            .in("visit_id", crmVisitIds)
        : Promise.resolve({ data: [] })
    );

    // CRM proposals
    wave2Promises.push(
      crmProductIds.length > 0
        ? supabase
            .from("crm_proposals")
            .select("id, status, proposed_value, notes, sent_at, valid_until, client_product_id")
            .in("client_product_id", crmProductIds)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] })
    );

    // CRM visit checklists
    wave2Promises.push(
      crmVisitIds.length > 0
        ? supabase
            .from("crm_visit_checklists")
            .select("id, status, visit_id, checklist_template_id")
            .in("visit_id", crmVisitIds)
        : Promise.resolve({ data: [] })
    );

    // CRM visit product snapshots
    wave2Promises.push(
      crmVisitIds.length > 0
        ? supabase
            .from("crm_visit_product_snapshots")
            .select("product_code, stage, value_estimated, probability, visit_id")
            .in("visit_id", crmVisitIds)
        : Promise.resolve({ data: [] })
    );

    // Ticket tags
    const ticketIds = chamados.map((t: any) => t.id);
    wave2Promises.push(
      ticketIds.length > 0
        ? supabase
            .from("ticket_tag_links")
            .select("ticket_id, ticket_tags(name)")
            .in("ticket_id", ticketIds)
        : Promise.resolve({ data: [] })
    );

    // Preventive NCs — via preventive_checklists
    wave2Promises.push(
      prevIds.length > 0
        ? supabase
            .from("preventive_checklists")
            .select("id, preventive_id")
            .in("preventive_id", prevIds)
        : Promise.resolve({ data: [] })
    );

    const [
      partsRes,
      audiosRes,
      proposalsRes,
      crmChecklistsRes,
      visitSnapshotsRes,
      tagLinksRes,
      prevChecklistsRes,
    ] = await Promise.all(wave2Promises);

    const parts = partsRes.data || [];
    const audios = audiosRes.data || [];
    const proposals = proposalsRes.data || [];
    const crmChecklists = crmChecklistsRes.data || [];
    const visitSnapshots = visitSnapshotsRes.data || [];
    const tagLinks = tagLinksRes.data || [];
    const prevChecklists = prevChecklistsRes.data || [];

    // ====== WAVE 3: NCs and actions from preventive checklists ======
    const prevChecklistIds = prevChecklists.map((c: any) => c.id);
    let ncs: any[] = [];
    let correctiveActions: any[] = [];

    if (prevChecklistIds.length > 0) {
      // Get blocks -> items with status N
      const { data: prevBlocks } = await supabase
        .from("preventive_checklist_blocks")
        .select("id")
        .in("checklist_id", prevChecklistIds);

      const blockIds = (prevBlocks || []).map((b: any) => b.id);

      if (blockIds.length > 0) {
        const { data: prevItems } = await supabase
          .from("preventive_checklist_items")
          .select("id")
          .in("exec_block_id", blockIds)
          .eq("status", "N");

        const itemIds = (prevItems || []).map((i: any) => i.id);

        if (itemIds.length > 0) {
          const [ncsRes, actionsRes] = await Promise.all([
            supabase
              .from("preventive_checklist_item_nonconformities")
              .select("nonconformity_label_snapshot, selected_at")
              .in("exec_item_id", itemIds)
              .limit(50),
            supabase
              .from("preventive_checklist_item_actions")
              .select("action_label_snapshot, selected_at")
              .in("exec_item_id", itemIds)
              .limit(50),
          ]);
          ncs = ncsRes.data || [];
          correctiveActions = actionsRes.data || [];
        }
      }
    }

    // ====== COMPUTE STATS ======
    const allAudios = audios;
    const transcribedAudios = allAudios.filter((a: any) => a.transcription);

    // Tempo médio resolução chamados
    const resolvedTickets = chamados.filter((t: any) => t.resolved_at);
    let tempoMedioResolucao: number | null = null;
    if (resolvedTickets.length > 0) {
      const totalDays = resolvedTickets.reduce((sum: number, t: any) => {
        const created = new Date(t.created_at).getTime();
        const resolved = new Date(t.resolved_at).getTime();
        return sum + (resolved - created) / (1000 * 60 * 60 * 24);
      }, 0);
      tempoMedioResolucao = Math.round((totalDays / resolvedTickets.length) * 10) / 10;
    }

    // Extract tags
    const allTags: string[] = [];
    for (const link of tagLinks) {
      const tagName = (link as any).ticket_tags?.name;
      if (tagName) allTags.push(tagName);
    }
    const tagCounts = groupAndCount(
      allTags.map((t) => ({ label: t })),
      "label"
    );

    // Transcriptions
    const recentTranscriptions = transcribedAudios
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
      .map((a: any) => ({
        date: a.created_at?.substring(0, 10),
        text: a.transcription?.substring(0, 300),
        summary: a.summary,
      }));

    const stats = {
      total_preventivas: preventivas.length,
      preventivas_por_status: countByStatus(preventivas),
      ultima_preventiva: preventivas[0]?.scheduled_date || null,
      ultima_concluida: preventivas.find((p: any) => p.status === "concluida")?.completed_date || null,
      top_nao_conformidades: groupAndCount(ncs, "nonconformity_label_snapshot").slice(0, 10),
      top_acoes_corretivas: groupAndCount(correctiveActions, "action_label_snapshot").slice(0, 10),
      top_pecas: groupParts(parts).slice(0, 10),
      total_chamados: chamados.length,
      chamados_abertos: chamados
        .filter((c: any) => c.status !== "resolvido" && c.status !== "cancelado")
        .map((c: any) => ({ code: c.code, title: c.title, priority: c.priority, status: c.status })),
      chamados_por_status: countByStatus(chamados),
      chamados_por_prioridade: countByStatus(chamados, "priority"),
      tempo_medio_resolucao: tempoMedioResolucao,
      tags_frequentes: tagCounts.slice(0, 5),
      total_visitas_crm: crmVisits.length,
      audios_gravados: allAudios.length,
      audios_transcritos: transcribedAudios.length,
      transcricoes_recentes: recentTranscriptions,
      total_propostas: proposals.length,
      propostas_por_status: countByStatus(proposals),
      total_pecas_consumidas: parts.reduce((s: number, p: any) => s + (p.quantity || 0), 0),
      acoes_crm_recentes: crmActions.slice(0, 10).map((a: any) => ({
        title: a.title,
        status: a.status,
        type: a.type,
        due_at: a.due_at,
        priority: a.priority,
      })),
      pedidos_por_status: countByStatus(pedidos),
      pedidos_pendentes: pedidos
        .filter((p: any) => p.status === "solicitado")
        .map((p: any) => ({ id: p.id, created_at: p.created_at })),
      produtos_crm: crmProducts.map((p: any) => ({
        product_code: p.product_code,
        stage: p.stage,
        value_estimated: p.value_estimated,
        probability: p.probability,
      })),
    };

    // ====== BUILD AI CONTEXT ======
    const PRODUCT_LABELS: Record<string, string> = {
      ideagri: "Ideagri", rumiflow: "RumiFlow", onfarm: "OnFarm",
      rumiaction: "RumiAction", procare: "RumiProcare",
    };
    const STAGE_LABELS: Record<string, string> = {
      nao_qualificado: "Não Qualificado", qualificado: "Qualificado",
      proposta: "Proposta", negociacao: "Negociação",
      ganho: "Ganho (Ativo)", perdido: "Perdido",
    };

    const sections: string[] = [];

    // Client info
    sections.push(`## Cliente\n- Nome: ${client.nome}\n- Fazenda: ${client.fazenda || "N/A"}\n- Cidade/UF: ${client.cidade || ""}/${client.estado || ""}\n- Status: ${client.status}\n- Contrato: ${client.modelo_contrato || "N/A"}\n- Ordenhas/dia: ${client.ordenhas_dia || "N/A"}\n- Pistolas: ${client.quantidade_pistolas || "N/A"}`);

    // Preventivas
    if (preventivas.length > 0) {
      sections.push(`## Preventivas (${preventivas.length} registros)\n- Por status: ${JSON.stringify(stats.preventivas_por_status)}\n- Última: ${stats.ultima_preventiva}\n- Última concluída: ${stats.ultima_concluida}\n- Top NCs: ${stats.top_nao_conformidades.map((n: any) => `${n.label} (${n.count}x)`).join(", ") || "Nenhuma"}\n- Top Ações Corretivas: ${stats.top_acoes_corretivas.map((a: any) => `${a.label} (${a.count}x)`).join(", ") || "Nenhuma"}\n- Top Peças: ${stats.top_pecas.map((p: any) => `${p.label} (${p.total}un)`).join(", ") || "Nenhuma"}`);
    }

    // Chamados
    if (chamados.length > 0) {
      const abertos = stats.chamados_abertos;
      sections.push(`## Chamados Técnicos (${chamados.length})\n- Por status: ${JSON.stringify(stats.chamados_por_status)}\n- Prioridade: ${JSON.stringify(stats.chamados_por_prioridade)}\n- Abertos agora: ${abertos.map((c: any) => `${c.code}: "${c.title}" (${c.priority})`).join("; ") || "Nenhum"}\n- Tempo médio resolução: ${tempoMedioResolucao !== null ? tempoMedioResolucao + " dias" : "N/A"}\n- Tags: ${stats.tags_frequentes.map((t: any) => `${t.label} (${t.count})`).join(", ") || "Nenhuma"}`);
    }

    // CRM
    if (crmVisits.length > 0 || crmProducts.length > 0) {
      const prodLines = crmProducts.map((p: any) =>
        `  - ${PRODUCT_LABELS[p.product_code] || p.product_code}: ${STAGE_LABELS[p.stage] || p.stage}${p.value_estimated ? ` R$${p.value_estimated}` : ""}${p.probability ? ` prob=${p.probability}%` : ""}`
      );
      sections.push(`## CRM\n- Visitas: ${crmVisits.length}\n- Áudios: ${allAudios.length} gravados, ${transcribedAudios.length} transcritos\n- Produtos:\n${prodLines.join("\n")}\n- Propostas: ${JSON.stringify(stats.propostas_por_status)}\n- Ações recentes: ${stats.acoes_crm_recentes.map((a: any) => `[${a.status}] ${a.title}${a.due_at ? ` prazo:${a.due_at.substring(0, 10)}` : ""}`).join("; ")}`);
    }

    // Transcriptions
    if (recentTranscriptions.length > 0) {
      const transLines = recentTranscriptions.map(
        (t: any) => `- ${t.date}: ${t.text}${t.summary ? "\n  Resumo: " + (Array.isArray(t.summary) ? t.summary.join("; ") : t.summary) : ""}`
      );
      sections.push(`## Transcrições Recentes\n${transLines.join("\n")}`);
    }

    // Pedidos
    if (pedidos.length > 0) {
      sections.push(`## Pedidos (${pedidos.length})\n- Por status: ${JSON.stringify(stats.pedidos_por_status)}\n- Pendentes: ${stats.pedidos_pendentes.length}`);
    }

    // Estoque
    if (estoque.length > 0) {
      const estLines = estoque.map((e: any) => `- ${(e as any).produtos_quimicos?.nome || "?"}: ${e.quantidade}L, ${e.galoes_cheios} galões (${e.data_afericao})`);
      sections.push(`## Estoque Químicos\n${estLines.join("\n")}`);
    }

    // Envios
    if (envios.length > 0) {
      const envLines = envios.slice(0, 5).map((e: any) => `- ${e.data_envio}: ${(e as any).produtos_quimicos?.nome || "?"} ${e.quantidade}L (${e.galoes} galões)`);
      sections.push(`## Últimos Envios\n${envLines.join("\n")}`);
    }

    const fullContext = sections.join("\n\n");
    console.log("[client-intelligence] Context:", fullContext.length, "chars. Calling AI...");

    // ====== CALL LOVABLE AI ======
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API de IA não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userQuestion = question || "Faça um resumo completo deste cliente";

    const systemPrompt = `Você é o assistente de inteligência do RumiField — sistema de gestão de serviços técnicos e CRM para fazendas leiteiras.

CAPACIDADES:
- Analisar dados completos de clientes: preventivas, chamados técnicos, CRM, estoque, pedidos
- Identificar padrões, problemas recorrentes e tendências
- Interpretar transcrições de áudio de visitas comerciais
- Avaliar saúde dos produtos e qualificações

REGRAS:
- Responda SEMPRE em português brasileiro
- Use dados concretos: datas, números, nomes de peças, scores
- Destaque PENDÊNCIAS e ALERTAS primeiro
- Cite transcrições de áudio quando relevantes
- Seja objetivo e completo
- Formate com markdown: ## para seções, **negrito** para destaques, listas para itens
- Se não houver dados suficientes, diga claramente
- Máximo 600 palavras
- Vá direto ao ponto`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Pergunta do usuário: "${userQuestion}"\n\nDados do cliente:\n\n${fullContext}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[client-intelligence] AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar análise com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const analysis = aiData.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    console.log("[client-intelligence] Done. Analysis length:", analysis.length);

    return new Response(
      JSON.stringify({
        stats,
        analysis,
        client: {
          nome: client.nome,
          fazenda: client.fazenda,
          cidade: client.cidade,
          estado: client.estado,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[client-intelligence] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
