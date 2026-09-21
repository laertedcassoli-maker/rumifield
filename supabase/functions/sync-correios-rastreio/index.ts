import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const DEFAULT_FOLDER_ID = "19tlXF8v27ZgA5OavuTW3ZCLvFcAViI9_";
const TRACKING_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ---------- Google service account auth (same pattern as google-sheets) ---------- */

function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function textToBase64url(text: string): string {
  return base64url(new TextEncoder().encode(text));
}

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
    ["sign"],
  );
}

async function createSignedJWT(email: string, privateKey: string, scope: string): Promise<string> {
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
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

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
    throw new Error(`Google OAuth error (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

function parseCredential(): { client_email: string; private_key: string } {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || Deno.env.get("CREDENCIAL_GOOGLE");
  if (!raw) throw new Error("Credencial Google não configurada");
  let cleaned = raw.trim();
  if (
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('"') && cleaned.endsWith('"'))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    const fixed = cleaned.replace(
      /(-----BEGIN [A-Z ]+-----)([\s\S]*?)(-----END [A-Z ]+-----)/g,
      (_m, begin, middle, end) => begin + middle.replace(/\n/g, "\\n") + end,
    );
    return JSON.parse(fixed);
  }
}

/* ---------- Google Drive ---------- */

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
}

async function listFolderFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: "1000",
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Google Drive API error (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    files.push(...((data.files ?? []) as DriveFile[]));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files.filter((f) => /\.html?$/i.test(f.name ?? ""));
}

async function downloadFileAsWindows1252(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo (${res.status}): ${await res.text()}`);
  }
  const buffer = new Uint8Array(await res.arrayBuffer());
  return new TextDecoder("windows-1252").decode(buffer);
}

/* ---------- Extração NF + rastreio ---------- */

/**
 * O HTML dos relatórios é malformado (tabelas aninhadas sem fechamento),
 * então a extração é feita por varredura de células com regex.
 * Em cada linha de remessa, a coluna "N.Fiscal" é numérica e a coluna
 * "Qtd./Reg." traz o código de rastreio (ex.: AD932482771BR).
 */
export function extrairPares(html: string): Array<{ nf: string; rastreio: string }> {
  const pares: Array<{ nf: string; rastreio: string }> = [];
  const seen = new Set<string>();

  // Quebra em "linhas" lógicas: cada <tr> ou, na ausência, cada bloco entre códigos de rastreio.
  const rows = html.split(/<\s*tr[^>]*>/i);

  for (const row of rows) {
    const cells = row
      .split(/<\s*\/?\s*t[dh][^>]*>/i)
      .map((c) =>
        c
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;?/gi, " ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((c) => c.length > 0);

    const rastreios = cells.filter((c) => TRACKING_RE.test(c));
    if (rastreios.length === 0) continue;

    // A NF da remessa é a célula imediatamente seguinte ao código de rastreio
    // (ordem fixa das colunas do relatório: Qtd./Reg. vem antes de N.Fiscal).
    for (const rastreio of rastreios) {
      const idxRastreio = cells.indexOf(rastreio);
      const nfCell = cells[idxRastreio + 1];
      if (!nfCell || !/^\d{1,12}$/.test(nfCell)) continue;
      const nf = nfCell.replace(/^0+/, "");
      if (!nf) continue;
      const key = `${nf}|${rastreio}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pares.push({ nf, rastreio });
    }
  }

  return pares;
}

/* ---------- Handler ---------- */

const ALLOWED_ROLES = ["admin", "coordenador_servicos", "coordenador_logistica"];

async function isAuthorizedUser(req: Request, admin: ReturnType<typeof createClient>): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return false;
    const { data: roles, error: rolesError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    if (rolesError) return false;
    return (roles ?? []).some((r: { role: string }) => ALLOWED_ROLES.includes(r.role));
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { success: false, error: "Configuração do backend ausente" });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const expectedSecret = Deno.env.get("SYNC_CORREIOS_SECRET");
  const providedSecret = req.headers.get("x-sync-secret");
  const secretOk = !!expectedSecret && !!providedSecret && providedSecret === expectedSecret;
  if (!secretOk && !(await isAuthorizedUser(req, admin))) {
    return json(401, { success: false, error: "Não autorizado" });
  }

  let folderId = DEFAULT_FOLDER_ID;
  let storagePath: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.folderId === "string" && body.folderId.trim()) {
      folderId = body.folderId.trim();
    }
    if (body && typeof body.storagePath === "string" && body.storagePath.trim()) {
      storagePath = body.storagePath.trim();
    }
  } catch (_e) {
    // corpo vazio (chamada do cron) — usa o default
  }

  const resumo = {
    success: true,
    arquivos_processados: 0,
    arquivos_com_erro: [] as Array<{ arquivo: string; erro: string }>,
    pares_encontrados: 0,
    codigos_preenchidos: 0,
    nfs_atualizadas: [] as string[],
    nfs_sem_pedido: [] as string[],
    nfs_ja_preenchidas: [] as string[],
    nfs_ambiguas: [] as string[],
  };

  try {
    const processados = new Map<string, string>(); // nf -> rastreio

    if (storagePath) {
      // Modo upload manual: lê o relatório do bucket privado correios-relatorios
      const { data: blob, error: downloadError } = await admin.storage
        .from("correios-relatorios")
        .download(storagePath);
      if (downloadError || !blob) {
        throw new Error(`Falha ao baixar o arquivo enviado: ${downloadError?.message ?? "arquivo não encontrado"}`);
      }
      const html = new TextDecoder("windows-1252").decode(new Uint8Array(await blob.arrayBuffer()));
      const pares = extrairPares(html);
      resumo.arquivos_processados += 1;
      resumo.pares_encontrados += pares.length;
      for (const { nf, rastreio } of pares) {
        if (!processados.has(nf)) processados.set(nf, rastreio);
      }
    } else {
      // Modo Google Drive (mantido para quando o acesso ao Google Cloud for liberado)
      const { client_email, private_key } = parseCredential();
      if (!client_email || !private_key) {
        throw new Error("Credencial da conta de serviço inválida");
      }
      const jwt = await createSignedJWT(
        client_email,
        private_key,
        "https://www.googleapis.com/auth/drive.readonly",
      );
      const accessToken = await getAccessToken(jwt);

      const files = await listFolderFiles(accessToken, folderId);
      console.log(`Arquivos .htm/.html encontrados na pasta: ${files.length}`);

      for (const file of files) {
        try {
          const html = await downloadFileAsWindows1252(accessToken, file.id);
          const pares = extrairPares(html);
          resumo.arquivos_processados += 1;
          resumo.pares_encontrados += pares.length;
          for (const { nf, rastreio } of pares) {
            if (!processados.has(nf)) processados.set(nf, rastreio);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro desconhecido";
          console.error(`Falha ao processar ${file.name}: ${msg}`);
          resumo.arquivos_com_erro.push({ arquivo: file.name, erro: msg });
        }
      }
    }


    // Índice em memória de NF -> pedidos. Os campos omie_nf_numero/omie_nf_numero_2
    // são texto livre digitado pela logística e podem vir com zeros à esquerda
    // ("000002974"), então normalizamos os dois lados e comparamos por igualdade
    // exata (nunca por sufixo, para não colar rastreio em pedido errado).
    const normalizarNf = (valor: string | null): string | null => {
      const limpo = (valor ?? "").trim().replace(/^0+/, "");
      return limpo.length > 0 ? limpo : null;
    };

    const indiceNf = new Map<string, { id: string; codigo_rastreio: string | null }[]>();
    {
      const { data: pedidosNf, error: indiceError } = await admin
        .from("pedidos")
        .select("id, codigo_rastreio, omie_nf_numero, omie_nf_numero_2")
        .or("omie_nf_numero.not.is.null,omie_nf_numero_2.not.is.null");

      if (indiceError) throw indiceError;

      for (const pedido of pedidosNf ?? []) {
        const registro = { id: pedido.id as string, codigo_rastreio: (pedido.codigo_rastreio ?? null) as string | null };
        const chaves = new Set(
          [normalizarNf(pedido.omie_nf_numero as string | null), normalizarNf(pedido.omie_nf_numero_2 as string | null)]
            .filter((k): k is string => !!k),
        );
        for (const chave of chaves) {
          const lista = indiceNf.get(chave);
          if (lista) lista.push(registro);
          else indiceNf.set(chave, [registro]);
        }
      }
    }

    for (const [nf, rastreio] of processados) {
      try {
        const encontrados = indiceNf.get(nf) ?? [];
        if (encontrados.length === 0) {
          resumo.nfs_sem_pedido.push(nf);
          continue;
        }
        if (encontrados.length > 1) {
          resumo.nfs_ambiguas.push(nf);
          continue;
        }


        const pedido = encontrados[0];
        if (pedido.codigo_rastreio) {
          resumo.nfs_ja_preenchidas.push(nf);
          continue;
        }

        const { data: updated, error: updateError } = await admin
          .from("pedidos")
          .update({ codigo_rastreio: rastreio })
          .eq("id", pedido.id)
          .is("codigo_rastreio", null)
          .select("id");

        if (updateError) throw updateError;
        if (updated && updated.length > 0) {
          resumo.codigos_preenchidos += 1;
          resumo.nfs_atualizadas.push(nf);
        } else {
          resumo.nfs_ja_preenchidas.push(nf);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "erro desconhecido";
        console.error(`Falha ao tratar NF ${nf}: ${msg}`);
        resumo.arquivos_com_erro.push({ arquivo: `NF ${nf}`, erro: msg });
      }
    }

    console.log(
      `Resumo: ${resumo.arquivos_processados} arquivo(s), ${resumo.codigos_preenchidos} código(s) preenchido(s), ${resumo.nfs_sem_pedido.length} NF(s) sem pedido, ${resumo.nfs_ambiguas.length} ambígua(s)`,
    );

    return json(200, resumo);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("sync-correios-rastreio falhou:", message);
    return json(500, { success: false, error: message, resumo });
  }
});
