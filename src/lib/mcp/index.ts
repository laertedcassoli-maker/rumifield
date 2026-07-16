import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listWorkOrdersTool from "./tools/list-work-orders";
import getWorkOrderTool from "./tools/get-work-order";
import listWorkshopItemsTool from "./tools/list-workshop-items";
import listMotorReplacementsTool from "./tools/list-motor-replacements";
import listActivitiesTool from "./tools/list-activities";
import workshopTimeSummaryTool from "./tools/workshop-time-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rumifield-mcp",
  title: "RumiField MCP - Oficina",
  version: "0.2.0",
  instructions:
    "Ferramentas SOMENTE-LEITURA da Oficina RumiField: Ordens de Serviço, ativos com motor, histórico de trocas e atividades. Use `whoami` para testar conectividade.",
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
  ],
});
