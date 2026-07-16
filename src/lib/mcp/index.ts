import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listTicketsTool from "./tools/list-tickets";
import listWorkOrdersTool from "./tools/list-work-orders";
import listPartsOrdersTool from "./tools/list-parts-orders";

// OAuth issuer must be the direct Supabase host (not the .lovable.cloud proxy).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rumifield-mcp",
  title: "RumiField MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas do RumiField (gestão de campo, oficina, chamados e pedidos de peças). Use `whoami` para testar conectividade.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listTicketsTool, listWorkOrdersTool, listPartsOrdersTool],
});
