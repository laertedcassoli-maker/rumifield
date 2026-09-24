import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireRole } from "../_shared/auth.ts";

type Conta = "principal" | "futurecow";
const CONTAS: Conta[] = ["principal", "futurecow"];
const CHAVES: Record<Conta, [string, string]> = {
  principal: ["omie_app_key", "omie_app_secret"],
  futurecow: ["omie_futurecow_app_key", "omie_futurecow_app_secret"],
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireRole(req, ["admin", "coordenador_servicos", "coordenador_logistica"]);
  if (!auth.ok) return auth.response;

  let body: { pedidoId?: unknown; nf?: unknown; dataReferencia?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: "Corpo inválido" }); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Credenciais
  const { data: cfg, error: cfgErr } = await admin.from("configuracoes").select("chave, valor")
    .in("chave", Object.values(CHAVES).flat());
  if (cfgErr) return json(500, { error: "Falha ao ler configurações" });
  const creds: Partial<Record<Conta, { app_key: string; app_secret: string }>> = {};
  for (const c of CONTAS) {
    const k = cfg?.find((x) => x.chave === CHAVES[c][0])?.valor?.trim();
    const s = cfg?.find((x) => x.chave === CHAVES[c][1])?.valor?.trim();
    if (k && s) creds[c] = { app_key: k, app_secret: s };
  }
  const contasAtivas = CONTAS.filter((c) => creds[c]);
  if (contasAtivas.length === 0) return json(400, { error: "Nenhuma conta Omie configurada" });

  // Entrada
  let nfsBrutas: string[] = [];
  let dataRef: Date;
  let pedidoCode: string | null = null;
  if (typeof body.pedidoId === "string" && body.pedidoId) {
    const { data: p, error } = await admin.from("pedidos")
      .select("id, pedido_code, omie_nf_numero, omie_nf_numero_2, omie_data_faturamento, created_at")
      .eq("id", body.pedidoId).maybeSingle();
    if (error || !p) return json(404, { error: "Pedido não encontrado" });
    pedidoCode = p.pedido_code;
    nfsBrutas = [p.omie_nf_numero, p.omie_nf_numero_2].filter((x): x is string => !!x && !!x.trim());
    dataRef = parseISO(String(p.omie_data_faturamento || p.created_at)) ?? new Date();
  } else if (typeof body.nf === "string" && body.nf.trim()) {
    nfsBrutas = [body.nf];
    const dr = typeof body.dataReferencia === "string" ? parseISO(body.dataReferencia) : null;
    if (body.dataReferencia && !dr) return json(400, { error: "dataReferencia deve ser YYYY-MM-DD" });
    const now = new Date();
    dataRef = dr ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  } else {
    return json(400, { error: "Informe pedidoId ou nf" });
  }
  if (nfsBrutas.length === 0) return json(200, { success: true, pedidoCode, resultados: [], mensagem: "Pedido sem NF" });

  const ini = new Date(dataRef.getTime() - 20 * 86400000);
  const fim = new Date(dataRef.getTime() + 5 * 86400000);

  // Chamadas Omie: cache (evita consumo redundante), ~1s entre chamadas, retry
  const cache = new Map<string, Promise<{ ok: boolean; data?: any; fault?: string }>>();
  let lastCall = 0;
  const omie = (conta: Conta, path: string, call: string, param: Record<string, unknown>) => {
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

  return json(200, { success: true, pedidoCode, dataReferencia: dataRef.toISOString().slice(0, 10), resultados });
});
