import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "./_sb";

/**
 * IMPORTANTE — duas populações distintas (verificado no banco):
 *  - Consultor R+ : responsabilidade pela carteira (clientes.consultor_rplus_id)
 *  - Técnico campo: execução (preventive_routes.field_technician_user_id,
 *                   ticket_visits.field_technician_user_id)
 * Não há sobreposição hoje, e os números NÃO são somados: cada frente aparece
 * em colunas próprias.
 *
 * NÃO existe "tempo médio por visita preventiva": preventive_route_items tem
 * checkin_at mas não checkout_at. KPI removido da especificação por decisão do
 * usuário (30/07/2026).
 */
export default defineTool({
  name: "technician_productivity",
  title: "Produtividade por Técnico/Consultor",
  description:
    "Produtividade unificada por pessoa nas três frentes: preventiva (responsabilidade de carteira e execução de rotas), corretiva (chamados e visitas) e oficina (tempo em OS). Sem tempo médio por visita preventiva (não calculável: falta checkout_at).",
  inputSchema: {
    date_from: z.string().optional().describe("ISO date"),
    date_to: z.string().optional().describe("ISO date"),
    scope: z.enum(["preventiva", "corretiva", "oficina", "todas"]).optional().describe("Padrão: todas"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const client = sb(ctx);
    const scope = input.scope ?? "todas";
    const from = input.date_from;
    const to = input.date_to;

    const { data: profiles, error: eP } = await client
      .from("profiles")
      .select("id, nome, email, is_active")
      .eq("is_active", true);
    if (eP) return { content: [{ type: "text", text: eP.message }], isError: true };

    const acc = new Map<string, any>();
    for (const p of profiles ?? []) {
      acc.set((p as any).id, { user_id: (p as any).id, nome: (p as any).nome });
    }
    const touch = (id: string | null) => (id && acc.has(id) ? acc.get(id) : null);

    // ---------- PREVENTIVA ----------
    if (scope === "preventiva" || scope === "todas") {
      // responsabilidade: carteira + fazendas atrasadas (regra via get_client_preventive_status)
      const sql = `
        select c.consultor_rplus_id, s.preventive_status
        from clientes c
        cross join lateral get_client_preventive_status(c.id, c.preventive_frequency_days) s
        where c.status = 'ativo' and c.consultor_rplus_id is not null
      `;
      const { data: cov, error: eC } = await client.rpc("mcp_readonly_query", { p_sql: sql, p_limit: 5000 });
      if (eC) return { content: [{ type: "text", text: eC.message }], isError: true };
      for (const raw of (cov ?? []) as any[]) {
        const r = typeof raw === "string" ? JSON.parse(raw) : raw;
        const t = touch(r.consultor_rplus_id);
        if (!t) continue;
        t.carteira_fazendas = (t.carteira_fazendas ?? 0) + 1;
        if (r.preventive_status === "atrasada") t.carteira_fazendas_atrasadas = (t.carteira_fazendas_atrasadas ?? 0) + 1;
      }

      // execução: rotas finalizadas + itens executados
      let rq = client
        .from("preventive_routes")
        .select("id, field_technician_user_id, status, created_at")
        .eq("status", "finalizada")
        .limit(5000);
      if (from) rq = rq.gte("created_at", from);
      if (to) rq = rq.lte("created_at", to);
      const { data: routes, error: eR } = await rq;
      if (eR) return { content: [{ type: "text", text: eR.message }], isError: true };

      const routeOwner = new Map<string, string>();
      for (const r of routes ?? []) {
        const t = touch((r as any).field_technician_user_id);
        routeOwner.set((r as any).id, (r as any).field_technician_user_id);
        if (!t) continue;
        t.rotas_finalizadas = (t.rotas_finalizadas ?? 0) + 1;
      }
      const routeIds = [...routeOwner.keys()];
      if (routeIds.length) {
        const { data: items, error: eI } = await client
          .from("preventive_route_items")
          .select("route_id, status")
          .in("route_id", routeIds)
          .eq("status", "executado");
        if (eI) return { content: [{ type: "text", text: eI.message }], isError: true };
        for (const it of items ?? []) {
          const t = touch(routeOwner.get((it as any).route_id) ?? null);
          if (!t) continue;
          t.fazendas_visitadas = (t.fazendas_visitadas ?? 0) + 1;
        }
      }
    }

    // ---------- CORRETIVA ----------
    if (scope === "corretiva" || scope === "todas") {
      let tq = client
        .from("technical_tickets")
        .select("id, assigned_technician_id, status, created_at, resolved_at")
        .limit(5000);
      if (from) tq = tq.gte("created_at", from);
      if (to) tq = tq.lte("created_at", to);
      const { data: tickets, error: eT } = await tq;
      if (eT) return { content: [{ type: "text", text: eT.message }], isError: true };

      const ids = (tickets ?? []).map((t: any) => t.id);
      let visitTicketIds = new Set<string>();
      if (ids.length) {
        const { data: visits, error: eV } = await client
          .from("ticket_visits")
          .select("ticket_id, field_technician_user_id")
          .in("ticket_id", ids);
        if (eV) return { content: [{ type: "text", text: eV.message }], isError: true };
        for (const v of visits ?? []) {
          if ((v as any).ticket_id) visitTicketIds.add((v as any).ticket_id);
          const t = touch((v as any).field_technician_user_id);
          if (t) t.visitas_corretivas = (t.visitas_corretivas ?? 0) + 1;
        }
      }

      for (const tk of tickets ?? []) {
        const t = touch((tk as any).assigned_technician_id);
        if (!t) continue;
        t.chamados_atribuidos = (t.chamados_atribuidos ?? 0) + 1;
        if ((tk as any).status === "resolvido") {
          t.chamados_resolvidos = (t.chamados_resolvidos ?? 0) + 1;
          if (!visitTicketIds.has((tk as any).id)) t.chamados_resolvidos_remoto = (t.chamados_resolvidos_remoto ?? 0) + 1;
          if ((tk as any).resolved_at && (tk as any).created_at) {
            const h = (new Date((tk as any).resolved_at).getTime() - new Date((tk as any).created_at).getTime()) / 36e5;
            t._resolucao_horas = (t._resolucao_horas ?? 0) + h;
            t._resolucao_n = (t._resolucao_n ?? 0) + 1;
          }
        }
      }
    }

    // ---------- OFICINA ---------- (mesma lógica de workshop-time-summary)
    if (scope === "oficina" || scope === "todas") {
      let wq = client
        .from("work_orders")
        .select("id, status, created_at")
        .eq("status", "concluido")
        .limit(5000);
      if (from) wq = wq.gte("created_at", from);
      if (to) wq = wq.lte("created_at", to);
      const { data: wos, error: eW } = await wq;
      if (eW) return { content: [{ type: "text", text: eW.message }], isError: true };
      const woIds = (wos ?? []).map((w: any) => w.id);
      if (woIds.length) {
        const { data: entries, error: eE } = await client
          .from("work_order_time_entries")
          .select("work_order_id, user_id, duration_seconds")
          .in("work_order_id", woIds);
        if (eE) return { content: [{ type: "text", text: eE.message }], isError: true };
        const osByUser = new Map<string, Set<string>>();
        for (const e of entries ?? []) {
          const t = touch((e as any).user_id);
          if (!t) continue;
          t.oficina_segundos = (t.oficina_segundos ?? 0) + ((e as any).duration_seconds ?? 0);
          const set = osByUser.get((e as any).user_id) ?? new Set<string>();
          set.add((e as any).work_order_id);
          osByUser.set((e as any).user_id, set);
        }
        for (const [uid, set] of osByUser) {
          const t = touch(uid);
          if (t) t.oficina_os = set.size;
        }
      }
    }

    const rows = [...acc.values()]
      .map((t) => {
        const out: any = {
          nome: t.nome,
          user_id: t.user_id,
          // responsabilidade (consultor R+)
          carteira_fazendas: t.carteira_fazendas ?? 0,
          carteira_fazendas_atrasadas: t.carteira_fazendas_atrasadas ?? 0,
          // execução preventiva (técnico de campo)
          rotas_finalizadas: t.rotas_finalizadas ?? 0,
          fazendas_visitadas: t.fazendas_visitadas ?? 0,
          // corretiva
          chamados_atribuidos: t.chamados_atribuidos ?? 0,
          chamados_resolvidos: t.chamados_resolvidos ?? 0,
          chamados_resolvidos_remoto: t.chamados_resolvidos_remoto ?? 0,
          percentual_remoto:
            t.chamados_resolvidos ? +(((t.chamados_resolvidos_remoto ?? 0) / t.chamados_resolvidos) * 100).toFixed(1) : null,
          visitas_corretivas: t.visitas_corretivas ?? 0,
          tempo_medio_resolucao_horas: t._resolucao_n ? +(t._resolucao_horas / t._resolucao_n).toFixed(1) : null,
          // oficina
          oficina_os: t.oficina_os ?? 0,
          oficina_horas: +(((t.oficina_segundos ?? 0) / 3600).toFixed(2)),
        };
        out._peso =
          out.carteira_fazendas + out.rotas_finalizadas + out.chamados_atribuidos + out.visitas_corretivas + out.oficina_os;
        return out;
      })
      .filter((r) => r._peso > 0)
      .sort((a, b) => b._peso - a._peso)
      .map(({ _peso, ...r }) => r);

    const result = {
      scope,
      periodo: { date_from: from ?? null, date_to: to ?? null },
      nota:
        "Consultor R+ e técnico de campo são populações distintas neste projeto: carteira/atrasos vêm de clientes.consultor_rplus_id (responsabilidade); rotas e fazendas visitadas vêm de preventive_routes.field_technician_user_id (execução). Colunas não são somadas. 'Tempo médio por visita preventiva' não existe: preventive_route_items não tem checkout_at.",
      linhas: rows,
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
  },
});
