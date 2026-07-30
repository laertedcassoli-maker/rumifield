import { defineTool } from "@lovable.dev/mcp-js";
import { sb } from "./_sb";

export default defineTool({
  name: "list_tables",
  title: "Listar Tabelas",
  description:
    "Lista as tabelas do aplicativo (schema public, whitelist) com contagem aproximada de linhas e se têm RLS. Tabelas internas, de auditoria e de outros schemas (auth, storage) nunca são expostas.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const { data, error } = await sb(ctx).rpc("mcp_list_tables");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { tables: data ?? [] } };
  },
});
