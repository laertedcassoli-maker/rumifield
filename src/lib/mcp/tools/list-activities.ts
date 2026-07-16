import { defineTool } from "@lovable.dev/mcp-js";
import { sb } from "./_sb";

export default defineTool({
  name: "list_activities",
  title: "Listar Atividades da Oficina",
  description: "Lista tipos de atividade cadastrados (para uso como filtro em outras ferramentas).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const { data, error } = await sb(ctx).from("activities").select("id, name").order("name");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { activities: data ?? [] } };
  },
});
