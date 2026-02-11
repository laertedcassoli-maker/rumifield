import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Base64url encode
function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function textToBase64url(text: string): string {
  return base64url(new TextEncoder().encode(text));
}

// Import PEM private key for RS256 signing
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

// Create and sign JWT for Google service account
async function createSignedJWT(
  email: string,
  privateKey: string,
  scope: string
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
    })
  );

  const unsignedToken = `${header}.${payload}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${base64url(new Uint8Array(signature))}`;
}

// Exchange JWT for access token
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

  const data = await res.json();
  return data.access_token;
}

// Read data from Google Sheets
async function readSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Sheets API error (${res.status}): ${err}`);
  }

  return await res.json();
}

// Get spreadsheet metadata (sheet names, etc.)
async function getSpreadsheetInfo(
  accessToken: string,
  spreadsheetId: string
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Sheets API error (${res.status}): ${err}`);
  }

  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const credentialJson = Deno.env.get("CREDENCIAL_GOOGLE");
    if (!credentialJson) {
      throw new Error("CREDENCIAL_GOOGLE secret not configured");
    }

    const spreadsheetId = Deno.env.get("CHAVE_GOOGLE_SHEET_TABELA_BOARD");
    if (!spreadsheetId) {
      throw new Error("CHAVE_GOOGLE_SHEET_TABELA_BOARD secret not configured");
    }

    // Clean the credential JSON - handle cases where it might have surrounding quotes
    // or escaped characters from secret storage
    let cleanedJson = credentialJson.trim();
    // Remove surrounding single quotes if present
    if (cleanedJson.startsWith("'") && cleanedJson.endsWith("'")) {
      cleanedJson = cleanedJson.slice(1, -1);
    }
    
    let credential;
    try {
      credential = JSON.parse(cleanedJson);
    } catch (parseErr) {
      // If direct parse fails, try replacing literal \n with actual newlines in the private key area
      // This handles cases where the JSON was stored with escaped newlines
      throw new Error(`Failed to parse CREDENCIAL_GOOGLE as JSON: ${(parseErr as Error).message}`);
    }
    
    const { client_email, private_key } = credential;

    if (!client_email || !private_key) {
      throw new Error("Invalid service account credentials: missing client_email or private_key");
    }

    const body = await req.json();
    const { action, range } = body;

    // Generate JWT and get access token
    const jwt = await createSignedJWT(
      client_email,
      private_key,
      "https://www.googleapis.com/auth/spreadsheets.readonly"
    );
    const accessToken = await getAccessToken(jwt);

    if (action === "test") {
      // Test connection by fetching spreadsheet metadata
      const info = await getSpreadsheetInfo(accessToken, spreadsheetId);
      return new Response(
        JSON.stringify({
          success: true,
          spreadsheet_title: info.properties?.title,
          sheets: info.sheets?.map((s: any) => s.properties?.title) || [],
          spreadsheet_id: spreadsheetId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "read") {
      if (!range) {
        throw new Error("Parameter 'range' is required for read action");
      }

      const data = await readSheet(accessToken, spreadsheetId, range);
      return new Response(
        JSON.stringify({
          success: true,
          range: data.range,
          values: data.values || [],
          rows_count: (data.values || []).length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: '${action}'. Use 'test' or 'read'.`);
  } catch (error: unknown) {
    console.error("Google Sheets function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
