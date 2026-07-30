import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listWorkOrdersTool from "./tools/list-work-orders";
import getWorkOrderTool from "./tools/get-work-order";
import listWorkshopItemsTool from "./tools/list-workshop-items";
import listMotorReplacementsTool from "./tools/list-motor-replacements";
import listActivitiesTool from "./tools/list-activities";
import workshopTimeSummaryTool from "./tools/workshop-time-summary";
import preventiveCoverageTool from "./tools/preventive-coverage";
import ticketResolutionSplitTool from "./tools/ticket-resolution-split";
import technicianProductivityTool from "./tools/technician-productivity";
import listTablesTool from "./tools/list-tables";
import describeTableTool from "./tools/describe-table";
import executeReadonlySqlTool from "./tools/execute-readonly-sql";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rumifield-mcp",
  title: "RumiField MCP",
  version: "0.3.0",
  instructions:
    "Ferramentas SOMENTE-LEITURA do RumiField: Oficina (OS, ativos com motor, trocas, tempo gasto), Preventivas (cobertura da carteira) e Chamados (remoto vs. visita corretiva, produtividade). Para qualquer pergunta não coberta por uma ferramenta específica (volume por dia/mês, funil de status, rankings, clientes com mais chamados), use `list_tables` e `describe_table` para conferir o schema e depois `execute_readonly_sql`. Nunca invente nome de coluna: confira com `describe_table`.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listActivitiesTool,
    listWorkOrdersTool,
    getWorkOrderTool,
    listWorkshopItemsTool,
    listMotorReplacementsTool,
    workshopTimeSummaryTool,
    preventiveCoverageTool,
    ticketResolutionSplitTool,
    technicianProductivityTool,
    listTablesTool,
    describeTableTool,
    executeReadonlySqlTool,
  ],
});

