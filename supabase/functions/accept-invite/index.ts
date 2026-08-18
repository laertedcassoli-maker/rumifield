import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    let payload: { token?: unknown; password?: unknown };
    try {
      payload = await req.json();
    } catch {
      return json(400, { error: "Requisição inválida" });
    }

    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";

    if (!token) return json(400, { error: "Token inválido" });
    if (password.length < 6) {
      return json(400, { error: "Senha deve ter no mínimo 6 caracteres" });
    }

    const { data: invite, error: inviteError } = await admin
      .from("user_invites")
      .select("id, email, nome, role, cidade_base, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      console.error("Falha ao buscar convite");
      return json(500, { error: "Falha ao validar convite" });
    }
    if (!invite) return json(400, { error: "Convite não encontrado" });
    if (invite.used_at) return json(400, { error: "Este convite já foi utilizado" });
    if (new Date(invite.expires_at) < new Date()) {
      return json(400, { error: "Este convite expirou" });
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { nome: invite.nome },
    });

    if (createError) {
      const msg = (createError.message ?? "").toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already been registered") ||
        msg.includes("already exists") ||
        createError.status === 422
      ) {
        return json(409, { error: "Email já cadastrado" });
      }
      console.error("Falha ao criar usuário:", createError.message);
      return json(500, { error: "Falha ao criar usuário" });
    }

    const userId = created?.user?.id;
    if (!userId) return json(500, { error: "Falha ao criar usuário" });

    const { error: acceptError } = await admin.rpc("accept_invite", {
      _invite_id: invite.id,
      _user_id: userId,
      _role: invite.role,
      _cidade_base: invite.cidade_base ?? null,
    });

    if (acceptError) {
      console.error("Falha ao aplicar convite:", acceptError.message);
      return json(500, { error: "Conta criada, mas houve falha ao aplicar o convite. Contate o administrador." });
    }

    return json(200, { success: true });
  } catch (e) {
    console.error("Erro inesperado em accept-invite:", e instanceof Error ? e.message : "unknown");
    return json(500, { error: "Erro inesperado" });
  }
});
