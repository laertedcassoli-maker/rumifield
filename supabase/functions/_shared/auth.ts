import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type AuthOk = {
  ok: true;
  user: { id: string; email?: string | null };
  authHeader: string;
};
export type AuthErr = { ok: false; response: Response };

/**
 * Validates the caller's JWT from Authorization: Bearer <token>.
 * Returns { ok, user } on success or { ok: false, response } (401) on failure.
 */
export async function requireUser(req: Request): Promise<AuthOk | AuthErr> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, response: jsonResponse(401, { error: "Não autenticado" }) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return { ok: false, response: jsonResponse(500, { error: "Configuração ausente" }) };
  }

  try {
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return { ok: false, response: jsonResponse(401, { error: "Não autenticado" }) };
    }
    return { ok: true, user: { id: data.user.id, email: data.user.email }, authHeader };
  } catch {
    return { ok: false, response: jsonResponse(401, { error: "Não autenticado" }) };
  }
}

/**
 * Validates the caller and ensures they have at least one of the given roles.
 * Returns { ok, user } or { ok: false, response } (401 / 403).
 */
export async function requireRole(
  req: Request,
  roles: string[],
): Promise<AuthOk | AuthErr> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, response: jsonResponse(500, { error: "Configuração ausente" }) };
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.user.id);

    if (error) {
      return { ok: false, response: jsonResponse(500, { error: "Falha ao verificar permissões" }) };
    }

    const userRoles = (data ?? []).map((r: { role: string }) => r.role);
    const allowed = userRoles.some((r) => roles.includes(r));
    if (!allowed) {
      return { ok: false, response: jsonResponse(403, { error: "Acesso negado" }) };
    }
    return auth;
  } catch {
    return { ok: false, response: jsonResponse(500, { error: "Falha ao verificar permissões" }) };
  }
}
