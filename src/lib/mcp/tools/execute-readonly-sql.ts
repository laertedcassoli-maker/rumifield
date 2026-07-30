import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "./_sb";

export default defineTool({
  name: "execute_readonly_sql",
  title: "SQL Somente-Leitura",
  description:
    "Executa uma consulta SELECT (ou WITH ... SELECT) somente-leitura no banco do RumiField, com a identidade do usuário logado (a RLS continua valendo). Escrita e DDL são recusadas por filtro E pela transação read-only do Postgres. Timeout de 10s, teto de 5.000 linhas, toda consulta é auditada. Use list_tables/describe_table antes para conferir nomes de colunas.",
  inputSchema: {
    sql: z.string().min(1).describe("Uma única consulta SELECT ou WITH ... SELECT, sem ponto e vírgula extra"),
    limit: z.number().int().min(1).max(5000).optional().describe("Teto de linhas. Padrão e máximo: 5000"),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const { data, error } = await sb(ctx).rpc("mcp_readonly_query", {
      p_sql: input.sql,
      p_limit: input.limit ?? 5000,
    });
    if (error) {
      return { content: [{ type: "text", text: `Consulta não executada: ${error.message}` }], isError: true };
    }
    const rows = ((data ?? []) as any[]).map((r) => (typeof r === "string" ? JSON.parse(r) : r));
    const result = {
      row_count: rows.length,
      truncated: rows.length >= (input.limit ?? 5000),
      rows,
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
  },
});
