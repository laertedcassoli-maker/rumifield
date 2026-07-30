import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "./_sb";

/**
 * Regra de status (Em dia / Elegível / Atrasada / Sem histórico):
 * implementada na função Postgres get_client_preventive_status, que replica
 * exatamente a regra usada hoje no front (frequência = preventive_frequency_days
 * ou 90; days_until_due = frequência - dias desde a última preventiva concluída;
 * < 0 atrasada, <= 30 elegível, senão em dia; sem conclusão = sem histórico).
 *
 * DÍVIDA TÉCNICA REGISTRADA: as 7 telas do front recalculam essa regra em
 * TypeScript e NÃO consomem esta função. Hoje concordam com ela por disciplina,
 * não por construção. Em algum momento vale as telas passarem a consumi-la.
 *
 * get_client_preventive_status é SECURITY DEFINER (ignora RLS ao ler
 * preventive_maintenance). Por isso a listagem parte SEMPRE de `clientes`,
 * onde a RLS vale, e a função só é chamada em LATERAL para os clientes que o
 * usuário já enxerga — nunca com um UUID vindo direto da entrada do usuário.
 */
export default defineTool({
  name: "preventive_coverage",
  title: "Cobertura de Preventivas",
  description:
    "Cobertura da carteira de preventivas por status (em_dia, elegivel, atrasada, sem_historico). Carteira = clientes.consultor_rplus_id. Retorna contagem por status, % em dia, média de dias de atraso e as fazendas mais atrasadas.",
  inputSchema: {
    consultor_rplus_id: z.string().uuid().optional().describe("Filtra pela carteira do consultor R+ (clientes.consultor_rplus_id)"),
    status: z.enum(["em_dia", "elegivel", "atrasada", "sem_historico"]).optional(),
    limit: z.number().int().min(1).max(500).optional().describe("Tamanho da lista detalhada. Padrão: 20"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const client = sb(ctx);

    const where = [`c.status = 'ativo'`];
    if (input.consultor_rplus_id) where.push(`c.consultor_rplus_id = '${input.consultor_rplus_id}'::uuid`);

    const sql = `
      select c.id as client_id, c.nome as cliente, c.fazenda, c.cidade, c.estado,
             c.preventive_frequency_days, c.consultor_rplus_id,
             p.nome as consultor,
             s.last_preventive_date, s.days_since_last, s.days_until_due, s.preventive_status
      from clientes c
      left join profiles p on p.id = c.consultor_rplus_id
      cross join lateral get_client_preventive_status(c.id, c.preventive_frequency_days) s
      where ${where.join(" and ")}
    `;

    const { data, error } = await client.rpc("mcp_readonly_query", { p_sql: sql, p_limit: 5000 });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = ((data ?? []) as any[]).map((r) => (typeof r === "string" ? JSON.parse(r) : r));

    const counts = { em_dia: 0, elegivel: 0, atrasada: 0, sem_historico: 0 } as Record<string, number>;
    for (const r of rows) counts[r.preventive_status] = (counts[r.preventive_status] ?? 0) + 1;

    const total = rows.length;
    const atrasadas = rows.filter((r) => r.preventive_status === "atrasada");
    const avgOverdue = atrasadas.length
      ? Math.round(atrasadas.reduce((s, r) => s + Math.abs(r.days_until_due ?? 0), 0) / atrasadas.length)
      : 0;

    const filtered = input.status ? rows.filter((r) => r.preventive_status === input.status) : rows;
    const detail = [...filtered]
      .sort((a, b) => (a.days_until_due ?? 99999) - (b.days_until_due ?? 99999))
      .slice(0, input.limit ?? 20)
      .map((r) => ({
        cliente: r.cliente,
        fazenda: r.fazenda,
        cidade: r.cidade,
        estado: r.estado,
        consultor_responsavel: r.consultor ?? "— (sem consultor)",
        frequencia_dias: r.preventive_frequency_days ?? 90,
        ultima_preventiva: r.last_preventive_date,
        dias_vencidos: r.days_until_due != null && r.days_until_due < 0 ? Math.abs(r.days_until_due) : 0,
        dias_ate_vencer: r.days_until_due,
        status: r.preventive_status,
      }));

    const result = {
      base_total_clientes_ativos: total,
      contagem_por_status: counts,
      percentual_em_dia: total ? +((counts.em_dia / total) * 100).toFixed(1) : 0,
      media_dias_atraso: avgOverdue,
      filtro_status: input.status ?? "todos",
      lista: detail,
      nota: "Regra de status vem de get_client_preventive_status (mesma do front). Clientes listados respeitam a RLS de `clientes`.",
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
  },
});
