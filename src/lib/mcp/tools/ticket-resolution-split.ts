import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "./_sb";

export default defineTool({
  name: "ticket_resolution_split",
  title: "Chamados: Remoto vs. Visita Corretiva",
  description:
    "Divide os chamados RESOLVIDOS no período entre resolvidos remotamente e escalados para visita corretiva (existe ticket_visits.ticket_id apontando para o chamado). Retorna sempre contagem absoluta junto do percentual e o tamanho da base.",
  inputSchema: {
    date_from: z.string().optional().describe("ISO date (resolved_at >=)"),
    date_to: z.string().optional().describe("ISO date (resolved_at <=)"),
    technician_user_id: z.string().uuid().optional().describe("technical_tickets.assigned_technician_id"),
    priority: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const client = sb(ctx);

    let q = client
      .from("technical_tickets")
      .select("id, ticket_code, client_id, assigned_technician_id, priority, status, created_at, resolved_at")
      .eq("status", "resolvido")
      .limit(5000);
    if (input.date_from) q = q.gte("resolved_at", input.date_from);
    if (input.date_to) q = q.lte("resolved_at", input.date_to);
    if (input.technician_user_id) q = q.eq("assigned_technician_id", input.technician_user_id);
    if (input.priority) q = q.eq("priority", input.priority);

    const { data: tickets, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const ids = (tickets ?? []).map((t: any) => t.id);
    let escalatedIds = new Set<string>();
    if (ids.length) {
      const { data: visits, error: e2 } = await client
        .from("ticket_visits")
        .select("ticket_id")
        .in("ticket_id", ids);
      if (e2) return { content: [{ type: "text", text: e2.message }], isError: true };
      escalatedIds = new Set((visits ?? []).map((v: any) => v.ticket_id).filter(Boolean));
    }

    const base = ids.length;
    const comVisita = ids.filter((id) => escalatedIds.has(id)).length;
    const remoto = base - comVisita;
    const pct = (n: number) => (base ? +((n / base) * 100).toFixed(1) : 0);

    const result = {
      denominador: "chamados com status = 'resolvido' no período (technical_tickets.resolved_at)",
      tamanho_da_base: base,
      base_pequena: base < 100,
      aviso_amostra:
        base < 100
          ? `Base de ${base} chamados. Percentuais sobre amostra pequena têm margem de erro alta — leia as contagens absolutas.`
          : null,
      resolvido_remotamente: { quantidade: remoto, de: base, percentual: pct(remoto), texto: `${remoto} de ${base} (${pct(remoto)}%)` },
      escalado_visita_corretiva: { quantidade: comVisita, de: base, percentual: pct(comVisita), texto: `${comVisita} de ${base} (${pct(comVisita)}%)` },
      filtros: {
        date_from: input.date_from ?? null,
        date_to: input.date_to ?? null,
        technician_user_id: input.technician_user_id ?? null,
        priority: input.priority ?? null,
      },
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
  },
});
