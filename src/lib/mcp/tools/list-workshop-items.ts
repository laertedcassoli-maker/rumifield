import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "./_sb";

export default defineTool({
  name: "list_workshop_items",
  title: "Ativos da Oficina (Saúde de Motores)",
  description:
    "Lista ativos (workshop_items). Com only_with_motor=true, retorna apenas ativos com motor vinculado e calcula horas de uso do motor atual (meter_hours_last - motor_replaced_at_meter_hours).",
  inputSchema: {
    only_with_motor: z.boolean().optional(),
    min_motor_hours: z.number().optional().describe("Filtra motores com horas de uso >= este valor."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_with_motor, min_motor_hours, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = sb(ctx)
      .from("workshop_items")
      .select("id, unique_code, current_motor_code, meter_hours_last, meter_hours_updated_at, motor_replaced_at_meter_hours, status")
      .limit(limit ?? 100);
    if (only_with_motor) q = q.not("current_motor_code", "is", null);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const enriched = (data ?? []).map((r: any) => {
      const usage = (r.meter_hours_last ?? 0) - (r.motor_replaced_at_meter_hours ?? 0);
      // Alinhado com a tela SaudeAtivosMotores.tsx: >=1500 crítico, >=1000 atenção
      const health = usage >= 1500 ? "critico" : usage >= 1000 ? "atencao" : "ok";
      return { ...r, motor_hours_usage: usage, health };
    }).filter((r: any) => min_motor_hours == null || r.motor_hours_usage >= min_motor_hours);
    return { content: [{ type: "text", text: JSON.stringify(enriched, null, 2) }], structuredContent: { items: enriched } };
  },
});
