import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export function sb(ctx: ToolContext) {
  const env = (globalThis as any).process.env;
  const key = (env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY) as string;
  return createClient(env.SUPABASE_URL as string, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
