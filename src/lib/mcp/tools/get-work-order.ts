import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "./_sb";

export default defineTool({
  name: "get_work_order",
  title: "Detalhar OS",
  description: "Retorna detalhes de uma OS: itens, peças usadas e apontamentos de tempo.",
  inputSchema: {
    id: z.string().uuid().optional(),
    code: z.string().optional().describe("Código da OS (work_orders.code), ex.: OS-2026-00037."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, code }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    if (!id && !code) return { content: [{ type: "text", text: "Informe id ou code." }], isError: true };
    const client = sb(ctx);
    let q = client
      .from("work_orders")
      .select("*, clientes:cliente_id(nome), activities:activity_id(name), work_order_items(*), work_order_parts_used(*), work_order_time_entries(*)")
      .limit(1);
    if (id) q = q.eq("id", id); else if (code) q = q.eq("code", code);
    const { data, error } = await q.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "OS não encontrada." }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { work_order: data } };
  },
});
