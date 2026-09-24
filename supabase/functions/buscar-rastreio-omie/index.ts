import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as baseCors, requireRole } from "../_shared/auth.ts";
const corsHeaders = { ...baseCors, "Access-Control-Allow-Headers": `${baseCors["Access-Control-Allow-Headers"]}, x-sync-secret` };

type Conta = "principal" | "futurecow";
const CONTAS: Conta[] = ["principal", "futurecow"];
const CHAVES: Record<Conta, [string, string]> = {
  principal: ["OMIE_APP_KEY", "OMIE_APP_SECRET"],
  futurecow: ["OMIE_FUTURECOW_APP_KEY", "OMIE_FUTURECOW_APP_SECRET"],
};

type Status = "encontrado" | "sem_rastreio" | "nf_nao_encontrada" | "ambigua" | "multiplos_codigos" | "erro";
interface ResultadoNF {
  nf: string;
  conta: Conta | null;
  documento: "remessa" | "pedido_venda" | null;
  numeroDocumento: string | null;
  dataEmissaoNF: string | null;
  codigos: string[];
  status: Status;
  mensagem: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RASTREIO_RE = /\b[A-Z]{2}\s?\d{9}\s?BR\b/gi;

function extrairCodigos(texto: string): string[] {
  const out = new Set<string>();
  for (const m of texto.matchAll(RASTREIO_RE)) out.add(m[0].replace(/\s+/g, "").toUpperCase());
  return [...out];
}

const fmtBR = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
function parseBR(s: string | undefined | null): Date | null {
  const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}
function parseISO(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

type Creds = Partial<Record<Conta, { app_key: string; app_secret: string }>>;

function criarOmie(creds: Creds) {
  // Chamadas Omie: cache (evita consumo redundante), ~1s entre chamadas, retry
  const cache = new Map<string, Promise<{ ok: boolean; data?: any; fault?: string }>>();
  let lastCall = 0;
  return (conta: Conta, path: string, call: string, param: Record<string, unknown>) => {
    const key = `${conta}|${path}|${call}|${JSON.stringify(param)}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const p = (async () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const wait = 1000 - (Date.now() - lastCall);
        if (wait > 0) await sleep(wait);
        lastCall = Date.now();
        const res = await fetch(`https://app.omie.com.br/api/v1/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ call, ...creds[conta], param: [param] }),
        });
        const raw = await res.text();
        if (/REDUNDANT|Consumo redundante|BLOQUEADO|LOCKED/i.test(raw) && attempt < 5) {
          const m = raw.match(/Aguarde\s+(\d+)\s+segundos/i);
          await sleep((m ? Number(m[1]) + 2 : attempt * 5) * 1000);
          continue;
        }
        let data: any = null;
        try { data = JSON.parse(raw); } catch { /* ignore */ }
        if (data?.faultstring) return { ok: false, fault: String(data.faultstring), data };
        if (!res.ok) return { ok: false, fault: `HTTP ${res.status}`, data };
        return { ok: true, data };
      }
      return { ok: false, fault: "Limite de consumo do Omie persistiu" };
    })();
    cache.set(key, p);
    return p;
  };

}

async function consultarNFs(
  omie: ReturnType<typeof criarOmie>, contasAtivas: Conta[], nfsBrutas: string[], dataRef: Date, pedidoCode: string | null,
): Promise<ResultadoNF[]> {
  const ini = new Date(dataRef.getTime() - 20 * 86400000);
  const fim = new Date(dataRef.getTime() + 5 * 86400000);
  const resultados: ResultadoNF[] = [];
  for (const bruto of nfsBrutas) {
    const nf = bruto.replace(/\s+/g, "").replace(/^0+(?=\d)/, "");
    const base: ResultadoNF = { nf, conta: null, documento: null, numeroDocumento: null, dataEmissaoNF: null, codigos: [], status: "erro", mensagem: "" };
    if (!/^\d+$/.test(nf)) { resultados.push({ ...base, nf: bruto, mensagem: "NF em formato inválido" }); continue; }

    try {
      // b) candidatas nas contas, dentro da janela
      type Cand = { conta: Conta; nIdPedido: string; emissao: Date; emissaoStr: string };
      const cands: Cand[] = [];
      const erros: string[] = [];
      for (const conta of contasAtivas) {
        const r = await omie(conta, "produtos/nfconsultar/", "ListarNF", {
          pagina: 1, registros_por_pagina: 20, apenas_importado_api: "N",
          nNFInicial: nf, nNFFinal: nf, tpNF: "1", dEmiInicial: fmtBR(ini), dEmiFinal: fmtBR(fim),
        });
        if (!r.ok) {
          if (!/n[aã]o (existem|foram encontrad)|nenhum/i.test(r.fault ?? "")) erros.push(`${conta}: ${r.fault}`);
          continue;
        }
        for (const n of (r.data?.nfCadastro ?? []) as any[]) {
          if (n?.ide?.dCan) continue;
          if (String(n?.ide?.nNF ?? "").replace(/^0+(?=\d)/, "") !== nf) continue;
          const em = parseBR(n?.ide?.dEmi);
          if (!em || em < ini || em > fim) continue; // nunca aceitar fora da janela
          const id = n?.compl?.nIdPedido;
          if (!id) continue;
          cands.push({ conta, nIdPedido: String(id), emissao: em, emissaoStr: n.ide.dEmi });
        }
      }
      if (cands.length === 0) {
        resultados.push(erros.length
          ? { ...base, status: "erro", mensagem: erros.join("; ") }
          : { ...base, status: "nf_nao_encontrada", mensagem: `NF não encontrada entre ${fmtBR(ini)} e ${fmtBR(fim)}` });
        continue;
      }

      // c/d) documento de origem de cada candidata
      type Det = Cand & { documento: "remessa" | "pedido_venda" | null; numero: string | null; texto: string; codigos: string[]; erro?: string };
      const dets: Det[] = [];
      for (const c of cands) {
        const rem = await omie(c.conta, "produtos/remessa/", "ConsultarRemessa", { nCodRem: Number(c.nIdPedido) });
        if (rem.ok) {
          const texto = `${rem.data?.infAdic?.cDadosAdic ?? ""}\n${rem.data?.obs?.cObs ?? ""}`.replace(/\|/g, "\n");
          const numero = rem.data?.cabec?.cNumeroRemessa ?? rem.data?.cNumeroRemessa ?? null;
          dets.push({ ...c, documento: "remessa", numero: numero != null ? String(numero) : null, texto, codigos: extrairCodigos(texto) });
        } else if (/n[aã]o cadastrad/i.test(rem.fault ?? "")) {
          const pv = await omie(c.conta, "produtos/pedido/", "ConsultarPedido", { codigo_pedido: Number(c.nIdPedido) });
          if (pv.ok) {
            const pvp = pv.data?.pedido_venda_produto ?? {};
            const texto = JSON.stringify(pv.data);
            const cods = new Set(extrairCodigos(String(pvp?.frete?.codigo_rastreio ?? "")));
            extrairCodigos(texto).forEach((x) => cods.add(x));
            const numero = pvp?.cabecalho?.numero_pedido ?? null;
            dets.push({ ...c, documento: "pedido_venda", numero: numero != null ? String(numero) : null, texto, codigos: [...cods] });
          } else {
            dets.push({ ...c, documento: null, numero: null, texto: "", codigos: [], erro: pv.fault });
          }
        } else {
          dets.push({ ...c, documento: null, numero: null, texto: "", codigos: [], erro: rem.fault });
        }
      }

      // e) escolher
      let escolhido: Det | null = null;
      if (dets.length === 1) escolhido = dets[0];
      else {
        const dist = (d: Det) => Math.abs(d.emissao.getTime() - dataRef.getTime());
        const min = Math.min(...dets.map(dist));
        let top = dets.filter((d) => dist(d) === min);
        if (top.length > 1 && pedidoCode) {
          const code = pedidoCode.toUpperCase();
          const comCode = top.filter((d) => d.texto.toUpperCase().includes(code));
          if (comCode.length === 1) top = comCode;
        }
        if (top.length === 1) escolhido = top[0];
      }
      if (!escolhido) {
        resultados.push({ ...base, status: "ambigua", mensagem: `${dets.length} NFs candidatas sem critério de desempate` });
        continue;
      }
      const r: ResultadoNF = {
        nf, conta: escolhido.conta, documento: escolhido.documento, numeroDocumento: escolhido.numero,
        dataEmissaoNF: escolhido.emissaoStr, codigos: escolhido.codigos, status: "erro", mensagem: "",
      };
      if (escolhido.erro) { r.status = "erro"; r.mensagem = `Falha ao consultar documento: ${escolhido.erro}`; }
      else if (r.codigos.length === 0) { r.status = "sem_rastreio"; r.mensagem = "Documento sem código de rastreio"; }
      else if (r.codigos.length > 1) { r.status = "multiplos_codigos"; r.mensagem = "Mais de um código encontrado"; }
      else { r.status = "encontrado"; r.mensagem = "Código encontrado"; }
      resultados.push(r);
    } catch (e) {
      resultados.push({ ...base, status: "erro", mensagem: e instanceof Error ? e.message : "Erro desconhecido" });
    }
  }

  return resultados;
}

type Resumo = "preenchido" | "ja_tinha_codigo" | "sem_rastreio" | "nao_encontrado" | "ambiguo" | "multiplos_codigos" | "erro" | "consulta";

async function processarPedido(
  admin: any, omie: ReturnType<typeof criarOmie>, contasAtivas: Conta[], pedidoId: string, dryRun: boolean,
) {
  const { data: p, error } = await admin.from("pedidos")
    .select("id, pedido_code, codigo_rastreio, omie_nf_numero, omie_nf_numero_2, omie_data_faturamento, created_at")
    .eq("id", pedidoId).maybeSingle();
  if (error || !p) return { pedidoId, pedidoCode: null, resultado: "erro" as Resumo, codigo: null, resultados: [], mensagem: "Pedido não encontrado" };
  const nfsBrutas = [p.omie_nf_numero, p.omie_nf_numero_2].filter((x: unknown): x is string => typeof x === "string" && !!x.trim());
  const dataRef = parseISO(String(p.omie_data_faturamento || p.created_at)) ?? new Date();
  const base = { pedidoId, pedidoCode: p.pedido_code as string, dataReferencia: dataRef.toISOString().slice(0, 10) };
  if (p.codigo_rastreio) {
    return { ...base, resultado: "ja_tinha_codigo" as Resumo, codigo: p.codigo_rastreio, resultados: [], mensagem: "Pedido já tem código de rastreio; nada alterado" };
  }
  if (nfsBrutas.length === 0) return { ...base, resultado: "nao_encontrado" as Resumo, codigo: null, resultados: [], mensagem: "Pedido sem NF" };

  const resultados = await consultarNFs(omie, contasAtivas, nfsBrutas, dataRef, p.pedido_code);
  const codigos = new Set<string>();
  for (const r of resultados) if (r.status === "encontrado") r.codigos.forEach((c) => codigos.add(c));
  const st = resultados.map((r) => r.status);

  let resultado: Resumo;
  let codigo: string | null = null;
  let mensagem = "";
  if (codigos.size > 1 || st.includes("multiplos_codigos")) { resultado = "multiplos_codigos"; mensagem = "NFs trazem códigos diferentes; nada gravado"; }
  else if (codigos.size === 1) {
    codigo = [...codigos][0];
    if (dryRun) { resultado = "consulta"; mensagem = "Código encontrado (consulta, nada gravado)"; }
    else {
      const { data: upd, error: ue } = await admin.from("pedidos")
        .update({ codigo_rastreio: codigo, codigo_rastreio_origem: "omie", codigo_rastreio_atualizado_em: new Date().toISOString() })
        .eq("id", pedidoId).is("codigo_rastreio", null).select("id");
      if (ue) { resultado = "erro"; mensagem = ue.message; }
      else if (!upd || upd.length === 0) { resultado = "ja_tinha_codigo"; mensagem = "Pedido recebeu código por outra via; nada alterado"; }
      else { resultado = "preenchido"; mensagem = "Código gravado"; }
    }
  }
  else if (st.includes("ambigua")) { resultado = "ambiguo"; mensagem = "NF ambígua"; }
  else if (st.includes("erro")) { resultado = "erro"; mensagem = resultados.filter((r) => r.status === "erro").map((r) => r.mensagem).join("; "); }
  else if (st.includes("sem_rastreio")) { resultado = "sem_rastreio"; mensagem = "Documento sem código de rastreio"; }
  else { resultado = "nao_encontrado"; mensagem = "NF não encontrada no Omie"; }
  return { ...base, resultado, codigo, resultados, mensagem };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const provided = req.headers.get("x-sync-secret");
  let secretOk = false;
  if (provided) {
    const { data } = await admin.rpc("check_sync_omie_rastreio_secret", { p_secret: provided });
    secretOk = data === true;
  }
  if (!secretOk) {
    const auth = await requireRole(req, ["admin", "coordenador_servicos", "coordenador_logistica"]);
    if (!auth.ok) return auth.response;
  }

  let body: { pedidoId?: unknown; nf?: unknown; dataReferencia?: unknown; dryRun?: unknown; lote?: unknown } = {};
  try { body = await req.json(); } catch { if (!secretOk) return json(400, { error: "Corpo inválido" }); body = { lote: true }; }
  const dryRun = body.dryRun === true;
  const creds: Creds = {};
  for (const c of CONTAS) {
    const k = Deno.env.get(CHAVES[c][0])?.trim();
    const s = Deno.env.get(CHAVES[c][1])?.trim();
    if (k && s) creds[c] = { app_key: k, app_secret: s };
  }
  const contasAtivas = CONTAS.filter((c) => creds[c]);
  if (contasAtivas.length === 0) return json(400, { error: "Nenhuma conta Omie configurada" });
  const omie = criarOmie(creds);

  // Modo lote
  if (body.lote === true) {
    const desde = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
    const { data: pedidos, error } = await admin.from("pedidos")
      .select("id")
      .eq("tipo_logistica", "correios").in("status", ["faturado", "enviado"])
      .is("codigo_rastreio", null).not("omie_nf_numero", "is", null).neq("omie_nf_numero", "")
      .gte("omie_data_faturamento", desde)
      .order("omie_data_faturamento", { ascending: false }).limit(25);
    if (error) return json(500, { error: error.message });
    const inicio = Date.now();
    const resumo = { success: true, dryRun, processados: 0, preenchidos: 0, sem_rastreio: 0, nao_encontrados: 0, ambiguos: 0, erros: 0, restantes: 0, detalhes: [] as unknown[] };
    for (const [i, p] of (pedidos ?? []).entries()) {
      if (Date.now() - inicio > 110_000) { resumo.restantes = (pedidos ?? []).length - i; break; }
      const r = await processarPedido(admin, omie, contasAtivas, p.id, dryRun);
      resumo.processados++;
      if (r.resultado === "preenchido" || r.resultado === "consulta") resumo.preenchidos++;
      else if (r.resultado === "sem_rastreio") resumo.sem_rastreio++;
      else if (r.resultado === "nao_encontrado") resumo.nao_encontrados++;
      else if (r.resultado === "ambiguo" || r.resultado === "multiplos_codigos") resumo.ambiguos++;
      else if (r.resultado === "erro") resumo.erros++;
      resumo.detalhes.push({ pedidoId: r.pedidoId, pedidoCode: r.pedidoCode, resultado: r.resultado, codigo: r.codigo, mensagem: r.mensagem });
    }
    return json(200, resumo);
  }

  if (typeof body.pedidoId === "string" && body.pedidoId) {
    const r = await processarPedido(admin, omie, contasAtivas, body.pedidoId, dryRun);
    if (!r.pedidoCode && r.resultado === "erro") return json(404, { error: r.mensagem });
    return json(200, { success: true, dryRun, ...r });
  }

  if (typeof body.nf === "string" && body.nf.trim()) {
    const dr = typeof body.dataReferencia === "string" ? parseISO(body.dataReferencia) : null;
    if (body.dataReferencia && !dr) return json(400, { error: "dataReferencia deve ser YYYY-MM-DD" });
    const now = new Date();
    const dataRef = dr ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const resultados = await consultarNFs(omie, contasAtivas, [body.nf], dataRef, null);
    return json(200, { success: true, dryRun: true, pedidoCode: null, dataReferencia: dataRef.toISOString().slice(0, 10), resultados });
  }
  return json(400, { error: "Informe pedidoId, nf ou lote" });
});
