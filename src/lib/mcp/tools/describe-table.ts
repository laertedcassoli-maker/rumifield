import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "./_sb";

export default defineTool({
  name: "describe_table",
  title: "Descrever Tabela",
  description:
    "Retorna colunas, tipos, nulabilidade, defaults, valores de enum e chaves estrangeiras de uma tabela do aplicativo. Use antes de montar SQL em execute_readonly_sql para não adivinhar nome de coluna.",
  inputSchema: {
    table: z.string().min(1).describe("Nome da tabela em public (ver list_tables)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const { data, error } = await sb(ctx).rpc("mcp_describe_table", { p_table: input.table });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data as any };
  },
});
