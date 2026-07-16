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
  name: "list_work_orders",
  title: "Listar Ordens de Serviço da Oficina",
  description:
    "Lista OS da oficina visíveis ao usuário. Filtros opcionais por status e limite.",
  inputSchema: {
    status: z
      .enum(["aguardando", "em_manutencao", "concluido"])
      .optional()
      .describe("Filtro opcional de status da OS."),
    limit: z.number().int().min(1).max(50).optional().describe("Máximo (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const client = sb(ctx);
    let q = client
      .from("work_orders")
      .select("id, os_code, status, cliente_id, created_at, end_time, total_time_seconds")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { work_orders: data ?? [] },
    };
  },
});
