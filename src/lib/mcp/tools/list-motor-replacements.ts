import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "./_sb";

export default defineTool({
  name: "list_motor_replacements",
  title: "Histórico de Trocas de Motor",
  description: "Últimas trocas de motor. Filtros opcionais por intervalo de datas (replaced_at) e workshop_item_id.",
  inputSchema: {
    workshop_item_id: z.string().uuid().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = sb(ctx)
      .from("motor_replacement_history")
      .select("id, workshop_item_id, old_motor_code, new_motor_code, motor_hours_used, replaced_at, work_order_id")
      .order("replaced_at", { ascending: false })
      .limit(input.limit ?? 20);
    if (input.workshop_item_id) q = q.eq("workshop_item_id", input.workshop_item_id);
    if (input.date_from) q = q.gte("replaced_at", input.date_from);
    if (input.date_to) q = q.lte("replaced_at", input.date_to);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { replacements: data ?? [] } };
  },
});
