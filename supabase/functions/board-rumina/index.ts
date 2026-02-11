import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── In-memory cache (60s TTL) ──────────────────────────────────────
interface CacheEntry {
  data: unknown;
  ts: number;
}
const CACHE_TTL_MS = 60_000;
const cache: Record<string, CacheEntry> = {};

function getCached(key: string): unknown | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  return null;
}
function setCache(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() };
}

// ── Base64url helpers ──────────────────────────────────────────────
function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function textToBase64url(text: string): string {
  return base64url(new TextEncoder().encode(text));
}

// ── RSA key import ────────────────────────────────────────────────
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

// ── JWT creation ──────────────────────────────────────────────────
async function createSignedJWT(
  email: string,
  privateKey: string,
  scope: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = textToBase64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = textToBase64url(
    JSON.stringify({
      iss: email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsignedToken = `${header}.${payload}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  );
  return `${unsignedToken}.${base64url(new Uint8Array(signature))}`;
}

// ── OAuth2 token exchange ─────────────────────────────────────────
async function getAccessToken(jwt: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google OAuth error (${res.status}): ${err}`);
  }
  return (await res.json()).access_token;
}

// ── Google Sheets read ────────────────────────────────────────────
async function readSheet(accessToken: string, spreadsheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 403) {
    const err = await res.text();
    throw { status: 403, message: `Planilha não compartilhada com a service account. Compartilhe com permissão de leitura. Detalhe: ${err}` };
  }
  if (res.status === 400) {
    const err = await res.text();
    if (err.includes("Unable to parse range")) {
      throw { status: 404, message: `Aba 'contratosativos' não encontrada na planilha.` };
    }
    throw { status: 400, message: `Erro na requisição: ${err}` };
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Sheets API error (${res.status}): ${err}`);
  }
  return await res.json();
}

// ── Parse credential JSON (handles escaped newlines) ──────────────
function parseCredential(raw: string): { client_email: string; private_key: string } {
  let cleaned = raw.trim();
  // Remove surrounding quotes (single or double)
  if ((cleaned.startsWith("'") && cleaned.endsWith("'")) || (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
    cleaned = cleaned.slice(1, -1);
  }

  console.log("Credential length:", cleaned.length, "starts with:", cleaned.substring(0, 20));

  let credential;
  try {
    credential = JSON.parse(cleaned);
  } catch (e1) {
    console.log("Direct JSON parse failed:", (e1 as Error).message);
    try {
      // Fix real newlines inside PEM blocks
      const fixed = cleaned.replace(
        /(-----BEGIN [A-Z ]+-----)([\s\S]*?)(-----END [A-Z ]+-----)/g,
        (_m, begin, middle, end) => begin + middle.replace(/\n/g, "\\n") + end,
      );
      credential = JSON.parse(fixed);
    } catch (e2) {
      console.log("Fixed JSON parse also failed:", (e2 as Error).message);
      // Last resort: try replacing all literal newlines with nothing except in private_key
      try {
        const noNewlines = cleaned.replace(/\r?\n/g, "");
        credential = JSON.parse(noNewlines);
      } catch (e3) {
        console.error("All parse attempts failed:", (e3 as Error).message);
        console.error("First 200 chars:", cleaned.substring(0, 200));
        throw new Error("Falha ao parsear GOOGLE_SERVICE_ACCOUNT_JSON. Verifique o formato do secret.");
      }
    }
  }

  console.log("Parsed credential keys:", Object.keys(credential));

  if (!credential.client_email || !credential.private_key) {
    throw new Error(`Credencial inválida: faltam client_email ou private_key. Keys encontradas: ${Object.keys(credential).join(", ")}`);
  }
  return credential;
}

// ── Main handler ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const credentialJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!credentialJson) {
      return new Response(
        JSON.stringify({ success: false, error: "Secret GOOGLE_SERVICE_ACCOUNT_JSON não configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const spreadsheetId = Deno.env.get("GOOGLE_SHEET_KEY");
    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({ success: false, error: "Secret GOOGLE_SHEET_KEY não configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action !== "clientes-ativos") {
      return new Response(
        JSON.stringify({ success: false, error: `Ação desconhecida: '${action}'. Use 'clientes-ativos'.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check cache
    const cacheKey = `contratosativos_${spreadsheetId}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({ ...(cached as object), cached: true, timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth & fetch
    const { client_email, private_key } = parseCredential(credentialJson);
    const jwt = await createSignedJWT(client_email, private_key, "https://www.googleapis.com/auth/spreadsheets.readonly");
    const accessToken = await getAccessToken(jwt);

    const range = "contratosativos!A:ZZ";
    const data = await readSheet(accessToken, spreadsheetId, range);

    const allRows: string[][] = data.values || [];
    const headers = allRows.length > 0 ? allRows[0] : [];
    const rows = allRows.length > 1 ? allRows.slice(1) : [];

    const result = {
      success: true,
      spreadsheetKey: spreadsheetId,
      sheet: "contratosativos",
      headers,
      rows,
      rows_count: rows.length,
      cached: false,
    };

    setCache(cacheKey, result);

    return new Response(
      JSON.stringify({ ...result, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("board-rumina error:", error);

    // Structured error with status
    if (typeof error === "object" && error !== null && "status" in error && "message" in error) {
      const e = error as { status: number; message: string };
      return new Response(
        JSON.stringify({ success: false, error: e.message }),
        { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const status = message.includes("OAuth") ? 500 : 400;
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
