import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_tickets",
  title: "Listar chamados técnicos",
  description:
    "Lista chamados técnicos visíveis ao usuário autenticado. Filtros opcionais por status e limite.",
  inputSchema: {
    status: z
      .enum(["aberto", "em_atendimento", "resolvido", "cancelado"])
      .optional()
      .describe("Filtro opcional de status do chamado."),
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de chamados (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const client = sb(ctx);
    let q = client
      .from("tickets")
      .select("id, ticket_code, title, status, priority, created_at, cliente_id")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { tickets: data ?? [] },
    };
  },
});
