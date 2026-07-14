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
    const { clientId, question, model, scope: scopeIn, filters } = await req.json();
    const scope: "client" | "all" | "oficina" =
      scopeIn === "oficina" ? "oficina" : clientId === "all" ? "all" : clientId ? "client" : "all";

    if (scope === "client" && !clientId) {
      return new Response(
        JSON.stringify({ error: "clientId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[client-intelligence] scope:", scope, "client:", clientId, "q:", question?.substring(0, 80));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const isAll = scope === "all";
    const isOficina = scope === "oficina";
    let stats: any;
    let fullContext: string;

    if (isOficina) {
      // ====== OFICINA MODE ======
      const dateFrom: string | null = filters?.dateFrom || null;
      const dateTo: string | null = filters?.dateTo || null;
      const activityFilter: string[] | null =
        Array.isArray(filters?.activityIds) && filters.activityIds.length > 0 ? filters.activityIds : null;

      let woQ = supabase
        .from("work_orders")
        .select(
          "id, code, status, created_at, start_time, end_time, total_time_seconds, activity_id, activities(name, execution_type), work_order_items(workshop_item_id, omie_product_id, quantity), work_order_parts_used(omie_product_id, quantity, pecas(codigo, nome))"
        )
        .order("created_at", { ascending: false })
        .limit(1500);
      if (dateFrom) woQ = woQ.gte("created_at", dateFrom);
      if (dateTo) woQ = woQ.lte("created_at", dateTo);
      if (activityFilter) woQ = woQ.in("activity_id", activityFilter);

      // Full history for rework detection (last 12 months, all parts)
      const historyFrom = new Date();
      historyFrom.setMonth(historyFrom.getMonth() - 12);
      const partsHistoryQ = supabase
        .from("work_orders")
        .select(
          "id, code, created_at, work_order_items(workshop_item_id), work_order_parts_used(omie_product_id, pecas(codigo, nome))"
        )
        .gte("created_at", historyFrom.toISOString())
        .limit(3000);

      const [woRes, motorsRes, replHistRes, partsHistRes] = await Promise.all([
        woQ,
        supabase
          .from("workshop_items")
          .select("id, unique_code, meter_hours_last, motor_replaced_at_meter_hours, motor_id")
          .not("motor_id", "is", null)
          .limit(1000),
        supabase
          .from("motor_replacement_history")
          .select("workshop_item_id, old_motor_code, new_motor_code, motor_hours_used, replaced_at")
          .order("replaced_at", { ascending: false })
          .limit(30),
        partsHistoryQ,
      ]);

      const workOrders = woRes.data || [];
      const motors = motorsRes.data || [];
      const replacements = replHistRes.data || [];
      const partsHistory = partsHistRes.data || [];

      // KPIs
      const totalOS = workOrders.length;
      const byStatus = countByStatus(workOrders);
      const concluidas = workOrders.filter((o: any) => o.status === "concluida" && o.total_time_seconds);
      const avgTimeSec = concluidas.length
        ? Math.round(concluidas.reduce((s: number, o: any) => s + (o.total_time_seconds || 0), 0) / concluidas.length)
        : 0;
      const buckets = { "<30m": 0, "30-60m": 0, "1-2h": 0, "2-4h": 0, ">4h": 0 };
      for (const o of concluidas) {
        const m = (o.total_time_seconds || 0) / 60;
        if (m < 30) buckets["<30m"]++;
        else if (m < 60) buckets["30-60m"]++;
        else if (m < 120) buckets["1-2h"]++;
        else if (m < 240) buckets["2-4h"]++;
        else buckets[">4h"]++;
      }
      // By activity
      const byActivity: Record<string, { count: number; min: number; max: number; sum: number; done: number }> = {};
      for (const o of workOrders) {
        const name = (o as any).activities?.name || "N/A";
        if (!byActivity[name]) byActivity[name] = { count: 0, min: Infinity, max: 0, sum: 0, done: 0 };
        byActivity[name].count++;
        if (o.status === "concluida" && o.total_time_seconds) {
          const s = o.total_time_seconds;
          byActivity[name].done++;
          byActivity[name].sum += s;
          if (s < byActivity[name].min) byActivity[name].min = s;
          if (s > byActivity[name].max) byActivity[name].max = s;
        }
      }
      const activityStats = Object.entries(byActivity)
        .map(([name, v]) => ({
          name,
          count: v.count,
          done: v.done,
          avg_min: v.done ? Math.round(v.sum / v.done / 60) : null,
          min_min: v.done ? Math.round(v.min / 60) : null,
          max_min: v.done ? Math.round(v.max / 60) : null,
        }))
        .sort((a, b) => b.count - a.count);

      // Parts consumed on OS
      const partsMap: Record<string, { label: string; total: number }> = {};
      for (const o of workOrders) {
        for (const p of (o as any).work_order_parts_used || []) {
          const label = p.pecas ? `${p.pecas.codigo} — ${p.pecas.nome}` : p.omie_product_id;
          partsMap[label] = partsMap[label] || { label, total: 0 };
          partsMap[label].total += p.quantity || 0;
        }
      }
      const topParts = Object.values(partsMap).sort((a, b) => b.total - a.total).slice(0, 15);

      // Motor health
      const motorHealth = motors
        .map((m: any) => {
          const used = (m.meter_hours_last || 0) - (m.motor_replaced_at_meter_hours || 0);
          const level = used > 1000 ? "critico" : used > 800 ? "atencao" : "ok";
          return { unique_code: m.unique_code, meter_hours_last: m.meter_hours_last, motor_hours_used: used, level };
        })
        .sort((a, b) => b.motor_hours_used - a.motor_hours_used);
      const motorsCritico = motorHealth.filter((m) => m.level === "critico");
      const motorsAtencao = motorHealth.filter((m) => m.level === "atencao");

      // Rework: same asset+part in different OS within 90d
      const eventsByKey: Record<string, { asset: string; partLabel: string; events: { os: string; date: string }[] }> = {};
      for (const o of partsHistory) {
        const items = (o as any).work_order_items || [];
        const assetId = items.find((i: any) => i.workshop_item_id)?.workshop_item_id;
        if (!assetId) continue;
        for (const p of (o as any).work_order_parts_used || []) {
          if (!p.omie_product_id) continue;
          const key = `${assetId}::${p.omie_product_id}`;
          const label = p.pecas ? `${p.pecas.codigo} — ${p.pecas.nome}` : p.omie_product_id;
          if (!eventsByKey[key]) eventsByKey[key] = { asset: assetId, partLabel: label, events: [] };
          eventsByKey[key].events.push({ os: o.code, date: o.created_at });
        }
      }
      // Resolve asset codes
      const assetIds = [...new Set(Object.values(eventsByKey).map((v) => v.asset))];
      const { data: assetsRes } = assetIds.length
        ? await supabase.from("workshop_items").select("id, unique_code").in("id", assetIds)
        : ({ data: [] } as any);
      const assetCode: Record<string, string> = {};
      for (const a of assetsRes || []) assetCode[a.id] = a.unique_code;

      const reworkList: any[] = [];
      for (const g of Object.values(eventsByKey)) {
        const evs = g.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (evs.length < 2) continue;
        // find any pair within 90 days
        const pairs: { os: string[]; days: number }[] = [];
        for (let i = 1; i < evs.length; i++) {
          const days = Math.round((new Date(evs[i].date).getTime() - new Date(evs[i - 1].date).getTime()) / 86400000);
          if (days <= 90) pairs.push({ os: [evs[i - 1].os, evs[i].os], days });
        }
        if (pairs.length === 0) continue;
        reworkList.push({
          asset: assetCode[g.asset] || g.asset,
          part: g.partLabel,
          repeats: evs.length,
          os_codes: evs.map((e) => e.os),
          intervals_days: pairs.map((p) => p.days),
        });
      }
      reworkList.sort((a, b) => b.repeats - a.repeats);
      const topRework = reworkList.slice(0, 20);

      // OS abertas mais antigas
      const openOS = workOrders
        .filter((o: any) => o.status !== "concluida" && o.status !== "cancelada")
        .map((o: any) => ({
          code: o.code,
          status: o.status,
          days_open: Math.round((Date.now() - new Date(o.created_at).getTime()) / 86400000),
          activity: (o as any).activities?.name || "N/A",
        }))
        .sort((a, b) => b.days_open - a.days_open)
        .slice(0, 15);

      stats = {
        scope: "oficina",
        total_os: totalOS,
        os_por_status: byStatus,
        os_concluidas: concluidas.length,
        lead_time_medio_min: Math.round(avgTimeSec / 60),
        distribuicao_tempo: buckets,
        por_atividade: activityStats.slice(0, 20),
        top_pecas: topParts,
        motores_criticos: motorsCritico.length,
        motores_atencao: motorsAtencao.length,
        motores_topo: motorHealth.slice(0, 15),
        ultimas_trocas_motor: replacements.slice(0, 10).map((r: any) => ({
          asset: assetCode[r.workshop_item_id] || r.workshop_item_id,
          old_motor: r.old_motor_code,
          new_motor: r.new_motor_code,
          hours_used: r.motor_hours_used,
          replaced_at: r.replaced_at?.substring(0, 10),
        })),
        retrabalho_top: topRework,
        os_abertas_antigas: openOS,
      };

      const sec: string[] = [];
      const periodo = dateFrom || dateTo ? `${dateFrom || "início"} → ${dateTo || "hoje"}` : "todo histórico";
      sec.push(
        `## Visão Oficina (período: ${periodo})\n- Total OS: ${totalOS}\n- Por status: ${JSON.stringify(byStatus)}\n- Concluídas: ${concluidas.length}\n- Lead time médio (concluídas): ${Math.round(avgTimeSec / 60)} min\n- Distribuição: ${JSON.stringify(buckets)}`
      );
      sec.push(
        `## Por Atividade (top 20)\n${activityStats
          .slice(0, 20)
          .map(
            (a) =>
              `- ${a.name}: ${a.count} OS (${a.done} concluídas)${a.avg_min !== null ? ` — média ${a.avg_min}m, min ${a.min_min}m, max ${a.max_min}m` : ""}`
          )
          .join("\n") || "—"}`
      );
      if (topParts.length)
        sec.push(`## Peças mais consumidas na oficina\n${topParts.map((p) => `- ${p.label}: ${p.total} un`).join("\n")}`);
      sec.push(
        `## Saúde de Motores\n- Críticos (>1000h): ${motorsCritico.length}\n- Atenção (>800h): ${motorsAtencao.length}\n${motorHealth
          .slice(0, 15)
          .map((m) => `- ${m.unique_code}: ${m.motor_hours_used}h uso (${m.level})`)
          .join("\n")}`
      );
      if (stats.ultimas_trocas_motor.length)
        sec.push(
          `## Últimas trocas de motor\n${stats.ultimas_trocas_motor
            .map((r: any) => `- ${r.replaced_at} ${r.asset}: ${r.old_motor} → ${r.new_motor} (${r.hours_used}h)`)
            .join("\n")}`
        );
      if (topRework.length)
        sec.push(
          `## Possível Retrabalho (mesma peça no mesmo ativo em ≤90d) — top 20\n${topRework
            .map(
              (r: any) =>
                `- ${r.asset} | ${r.part}: ${r.repeats}x — OS ${r.os_codes.join(", ")} — intervalos: ${r.intervals_days.join(", ")}d`
            )
            .join("\n")}`
        );
      if (openOS.length)
        sec.push(
          `## OS em aberto mais antigas\n${openOS.map((o: any) => `- ${o.code} (${o.activity}) ${o.status}: ${o.days_open}d`).join("\n")}`
        );

      fullContext = sec.join("\n\n");
    } else if (isAll) {
      // ====== ALL CLIENTS MODE ======
      const [
        clientsCountRes,
        prevRes,
        ticketsRes,
        crmProductsRes,
        crmVisitsRes,
        pedidosRes,
      ] = await Promise.all([
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase
          .from("preventive_maintenance")
          .select("id, status, client_id, scheduled_date, completed_date, clientes(nome)")
          .order("scheduled_date", { ascending: false })
          .limit(200),
        supabase
          .from("technical_tickets")
          .select("id, code, title, status, priority, created_at, resolved_at, clientes(nome)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("crm_client_products")
          .select("id, product_code, stage, value_estimated, probability, client_id, clientes(nome)")
          .limit(500),
        supabase
          .from("crm_visits")
          .select("id, status, client_id, checkin_at, checkout_at, created_at, clientes(nome)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("pedidos")
          .select("id, status, created_at, clientes(nome)")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const totalClientes = clientsCountRes.count || 0;
      const preventivas = prevRes.data || [];
      const chamados = ticketsRes.data || [];
      const crmProducts = crmProductsRes.data || [];
      const crmVisits = crmVisitsRes.data || [];
      const pedidos = pedidosRes.data || [];

      const chamadosAbertos = chamados.filter((c: any) => c.status !== "resolvido" && c.status !== "cancelado");

      // Group open tickets by client
      const chamadosPorCliente: Record<string, { nome: string; tickets: any[] }> = {};
      for (const c of chamadosAbertos) {
        const nome = (c as any).clientes?.nome || "N/A";
        if (!chamadosPorCliente[nome]) chamadosPorCliente[nome] = { nome, tickets: [] };
        chamadosPorCliente[nome].tickets.push({ code: c.code, title: c.title, priority: c.priority });
      }

      // Preventivas atrasadas (status pendente/agendada com data passada)
      const hoje = new Date().toISOString().substring(0, 10);
      const prevAtrasadas = preventivas.filter((p: any) =>
        (p.status === "pendente" || p.status === "agendada") && p.scheduled_date && p.scheduled_date < hoje
      );
      const prevPorCliente: Record<string, number> = {};
      for (const p of prevAtrasadas) {
        const nome = (p as any).clientes?.nome || "N/A";
        prevPorCliente[nome] = (prevPorCliente[nome] || 0) + 1;
      }

      // Pipeline
      const pipeline: Record<string, Record<string, number>> = {};
      for (const p of crmProducts) {
        const stage = p.stage || "N/A";
        const code = p.product_code || "N/A";
        if (!pipeline[stage]) pipeline[stage] = {};
        pipeline[stage][code] = (pipeline[stage][code] || 0) + 1;
      }

      // Pedidos pendentes por cliente
      const pedidosPendentes = pedidos.filter((p: any) => p.status === "solicitado");
      const pedidosPorCliente: Record<string, number> = {};
      for (const p of pedidosPendentes) {
        const nome = (p as any).clientes?.nome || "N/A";
        pedidosPorCliente[nome] = (pedidosPorCliente[nome] || 0) + 1;
      }

      stats = {
        total_clientes: totalClientes,
        total_preventivas: preventivas.length,
        preventivas_por_status: countByStatus(preventivas),
        preventivas_atrasadas: Object.keys(prevPorCliente).length,
        total_chamados: chamados.length,
        chamados_abertos: chamadosAbertos.length,
        chamados_por_status: countByStatus(chamados),
        total_visitas_crm: crmVisits.length,
        total_pedidos: pedidos.length,
        pedidos_pendentes: pedidosPendentes.length,
        pipeline_geral: pipeline,
      };

      // Build context for AI
      const sections: string[] = [];
      sections.push(`## Visão Geral\n- Total de clientes ativos: ${totalClientes}\n- Preventivas registradas: ${preventivas.length}\n- Chamados: ${chamados.length} (${chamadosAbertos.length} abertos)\n- Visitas CRM: ${crmVisits.length}\n- Pedidos: ${pedidos.length} (${pedidosPendentes.length} pendentes)`);

      sections.push(`## Preventivas\n- Por status: ${JSON.stringify(stats.preventivas_por_status)}\n- Clientes com preventivas atrasadas (${Object.keys(prevPorCliente).length}):\n${Object.entries(prevPorCliente).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([nome, qt]) => `  - ${nome}: ${qt} atrasada(s)`).join("\n") || "  Nenhum"}`);

      sections.push(`## Chamados Abertos por Cliente (${chamadosAbertos.length})\n${Object.values(chamadosPorCliente).sort((a, b) => b.tickets.length - a.tickets.length).slice(0, 20).map((c) => `- ${c.nome}: ${c.tickets.map((t: any) => `${t.code} "${t.title}" (${t.priority})`).join("; ")}`).join("\n") || "Nenhum"}`);

      sections.push(`## Pipeline CRM\n${Object.entries(pipeline).map(([stage, products]) => `- ${stage}: ${Object.entries(products).map(([code, count]) => `${code}(${count})`).join(", ")}`).join("\n")}`);

      if (pedidosPendentes.length > 0) {
        sections.push(`## Pedidos Pendentes por Cliente\n${Object.entries(pedidosPorCliente).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([nome, qt]) => `- ${nome}: ${qt} pedido(s)`).join("\n")}`);
      }

      fullContext = sections.join("\n\n");
    } else {
      // ====== SINGLE CLIENT MODE (existing logic) ======
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

      wave2Promises.push(
        prevIds.length > 0
          ? supabase
              .from("preventive_part_consumption")
              .select("part_name_snapshot, quantity, consumed_at")
              .in("preventive_id", prevIds)
              .limit(100)
          : Promise.resolve({ data: [] })
      );

      wave2Promises.push(
        crmVisitIds.length > 0
          ? supabase
              .from("crm_visit_audios")
              .select("id, duration_seconds, transcription, summary, status, visit_id, created_at")
              .in("visit_id", crmVisitIds)
          : Promise.resolve({ data: [] })
      );

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

      wave2Promises.push(
        crmVisitIds.length > 0
          ? supabase
              .from("crm_visit_checklists")
              .select("id, status, visit_id, checklist_template_id")
              .in("visit_id", crmVisitIds)
          : Promise.resolve({ data: [] })
      );

      wave2Promises.push(
        crmVisitIds.length > 0
          ? supabase
              .from("crm_visit_product_snapshots")
              .select("product_code, stage, value_estimated, probability, visit_id")
              .in("visit_id", crmVisitIds)
          : Promise.resolve({ data: [] })
      );

      const ticketIds = chamados.map((t: any) => t.id);
      wave2Promises.push(
        ticketIds.length > 0
          ? supabase
              .from("ticket_tag_links")
              .select("ticket_id, ticket_tags(name)")
              .in("ticket_id", ticketIds)
          : Promise.resolve({ data: [] })
      );

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
      const tagLinks = tagLinksRes.data || [];
      const prevChecklists = prevChecklistsRes.data || [];

      // ====== WAVE 3: NCs and actions ======
      const prevChecklistIds = prevChecklists.map((c: any) => c.id);
      let ncs: any[] = [];
      let correctiveActions: any[] = [];

      if (prevChecklistIds.length > 0) {
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

      const allTags: string[] = [];
      for (const link of tagLinks) {
        const tagName = (link as any).ticket_tags?.name;
        if (tagName) allTags.push(tagName);
      }
      const tagCounts = groupAndCount(
        allTags.map((t) => ({ label: t })),
        "label"
      );

      const recentTranscriptions = transcribedAudios
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)
        .map((a: any) => ({
          date: a.created_at?.substring(0, 10),
          text: a.transcription?.substring(0, 300),
          summary: a.summary,
        }));

      stats = {
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

      sections.push(`## Cliente\n- Nome: ${client.nome}\n- Fazenda: ${client.fazenda || "N/A"}\n- Cidade/UF: ${client.cidade || ""}/${client.estado || ""}\n- Status: ${client.status}\n- Contrato: ${client.modelo_contrato || "N/A"}\n- Ordenhas/dia: ${client.ordenhas_dia || "N/A"}\n- Pistolas: ${client.quantidade_pistolas || "N/A"}`);

      if (preventivas.length > 0) {
        sections.push(`## Preventivas (${preventivas.length} registros)\n- Por status: ${JSON.stringify(stats.preventivas_por_status)}\n- Última: ${stats.ultima_preventiva}\n- Última concluída: ${stats.ultima_concluida}\n- Top NCs: ${stats.top_nao_conformidades.map((n: any) => `${n.label} (${n.count}x)`).join(", ") || "Nenhuma"}\n- Top Ações Corretivas: ${stats.top_acoes_corretivas.map((a: any) => `${a.label} (${a.count}x)`).join(", ") || "Nenhuma"}\n- Top Peças: ${stats.top_pecas.map((p: any) => `${p.label} (${p.total}un)`).join(", ") || "Nenhuma"}`);
      }

      if (chamados.length > 0) {
        const abertos = stats.chamados_abertos;
        sections.push(`## Chamados Técnicos (${chamados.length})\n- Por status: ${JSON.stringify(stats.chamados_por_status)}\n- Prioridade: ${JSON.stringify(stats.chamados_por_prioridade)}\n- Abertos agora: ${abertos.map((c: any) => `${c.code}: "${c.title}" (${c.priority})`).join("; ") || "Nenhum"}\n- Tempo médio resolução: ${tempoMedioResolucao !== null ? tempoMedioResolucao + " dias" : "N/A"}\n- Tags: ${stats.tags_frequentes.map((t: any) => `${t.label} (${t.count})`).join(", ") || "Nenhuma"}`);
      }

      if (crmVisits.length > 0 || crmProducts.length > 0) {
        const prodLines = crmProducts.map((p: any) =>
          `  - ${PRODUCT_LABELS[p.product_code] || p.product_code}: ${STAGE_LABELS[p.stage] || p.stage}${p.value_estimated ? ` R$${p.value_estimated}` : ""}${p.probability ? ` prob=${p.probability}%` : ""}`
        );
        sections.push(`## CRM\n- Visitas: ${crmVisits.length}\n- Áudios: ${allAudios.length} gravados, ${transcribedAudios.length} transcritos\n- Produtos:\n${prodLines.join("\n")}\n- Propostas: ${JSON.stringify(stats.propostas_por_status)}\n- Ações recentes: ${stats.acoes_crm_recentes.map((a: any) => `[${a.status}] ${a.title}${a.due_at ? ` prazo:${a.due_at.substring(0, 10)}` : ""}`).join("; ")}`);
      }

      if (recentTranscriptions.length > 0) {
        const transLines = recentTranscriptions.map(
          (t: any) => `- ${t.date}: ${t.text}${t.summary ? "\n  Resumo: " + (Array.isArray(t.summary) ? t.summary.join("; ") : t.summary) : ""}`
        );
        sections.push(`## Transcrições Recentes\n${transLines.join("\n")}`);
      }

      if (pedidos.length > 0) {
        sections.push(`## Pedidos (${pedidos.length})\n- Por status: ${JSON.stringify(stats.pedidos_por_status)}\n- Pendentes: ${stats.pedidos_pendentes.length}`);
      }

      if (estoque.length > 0) {
        const estLines = estoque.map((e: any) => `- ${(e as any).produtos_quimicos?.nome || "?"}: ${e.quantidade}L, ${e.galoes_cheios} galões (${e.data_afericao})`);
        sections.push(`## Estoque Químicos\n${estLines.join("\n")}`);
      }

      if (envios.length > 0) {
        const envLines = envios.slice(0, 5).map((e: any) => `- ${e.data_envio}: ${(e as any).produtos_quimicos?.nome || "?"} ${e.quantidade}L (${e.galoes} galões)`);
        sections.push(`## Últimos Envios\n${envLines.join("\n")}`);
      }

      fullContext = sections.join("\n\n");
    }

    console.log("[client-intelligence] Context:", fullContext.length, "chars. Calling AI...");

    // ====== CALL LOVABLE AI ======
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API de IA não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userQuestion = question || (isAll ? "Faça um resumo geral de todos os clientes" : "Faça um resumo completo deste cliente");

    const systemPrompt = isAll
      ? `Você é o assistente de inteligência do RumiField — sistema de gestão de serviços técnicos e CRM para fazendas leiteiras.

MODO: Visão geral de TODOS os clientes.

CAPACIDADES:
- Analisar dados agregados: preventivas, chamados, pipeline CRM, pedidos
- Identificar clientes que precisam de atenção urgente
- Comparar métricas entre clientes

REGRAS:
- Responda SEMPRE em português brasileiro
- Use dados concretos: nomes de clientes, números, datas
- Destaque clientes com PROBLEMAS ou PENDÊNCIAS primeiro
- Seja objetivo e organize por prioridade
- Formate com markdown: ## para seções, **negrito** para destaques, listas para itens
- Máximo 800 palavras
- Vá direto ao ponto`
      : `Você é o assistente de inteligência do RumiField — sistema de gestão de serviços técnicos e CRM para fazendas leiteiras.

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
        model: model || "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Pergunta do usuário: "${userQuestion}"\n\nDados:\n\n${fullContext}`,
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
        ...(isAll ? {} : {
          client: {
            nome: stats.client_nome,
          },
        }),
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
