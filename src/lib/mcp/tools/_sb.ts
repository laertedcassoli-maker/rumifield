import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export function sb(ctx: ToolContext) {
  const env = (globalThis as any).process.env;
  return createClient(env.SUPABASE_URL as string, env.SUPABASE_PUBLISHABLE_KEY as string, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
