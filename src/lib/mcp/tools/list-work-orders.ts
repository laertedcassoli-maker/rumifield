import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "./_sb";

export default defineTool({
  name: "list_work_orders",
  title: "Listar OS da Oficina",
  description:
    "Lista Ordens de Serviço da oficina visíveis ao usuário (respeita RLS). Filtros por status, cliente, atividade e intervalo de datas (created_at).",
  inputSchema: {
    status: z.enum(["aguardando", "em_manutencao", "concluido"]).optional(),
    cliente_id: z.string().uuid().optional(),
    activity_id: z.string().uuid().optional(),
    date_from: z.string().optional().describe("ISO date (inclusive) para created_at."),
    date_to: z.string().optional().describe("ISO date (inclusive) para created_at."),
    limit: z.number().int().min(1).max(100).optional().describe("Padrão 20, máx 100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = sb(ctx)
      .from("work_orders")
      .select("id, os_code, status, cliente_id, activity_id, created_at, start_time, end_time, total_time_seconds, has_motor, clientes:cliente_id(nome), activities:activity_id(name)")
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 20);
    if (input.status) q = q.eq("status", input.status);
    if (input.cliente_id) q = q.eq("cliente_id", input.cliente_id);
    if (input.activity_id) q = q.eq("activity_id", input.activity_id);
    if (input.date_from) q = q.gte("created_at", input.date_from);
    if (input.date_to) q = q.lte("created_at", input.date_to);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const enriched = (data ?? []).map((r: any) => {
      const s = r.total_time_seconds ?? 0;
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return { ...r, total_time_hours: +(s / 3600).toFixed(2), total_time_hms: `${h}h${m.toString().padStart(2, "0")}` };
    });
    return { content: [{ type: "text", text: JSON.stringify(enriched, null, 2) }], structuredContent: { work_orders: enriched } };
  },
});
