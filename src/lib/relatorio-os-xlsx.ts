import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  RelatorioOSConcluidas,
  OrdemConcluida,
  PecaUsada,
} from "@/hooks/useRelatorioOSConcluidas";

export interface RelatorioMeta {
  dataConclusaoDe: Date;
  dataConclusaoAte: Date;
  filtroClientes?: string[];
  filtroAtividades?: string[];
  geradoPor?: string;
}

const SEM_PECA = "(sem peça registrada)";

const fmtDateTime = (v: string | null | undefined) =>
  v ? format(new Date(v), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "";

const competencia = (v: string | null | undefined) =>
  v ? format(new Date(v), "yyyy-MM") : "";

const round = (n: number, d: number) => Number(n.toFixed(d));

const simNao = (v: boolean | null | undefined) => (v === null || v === undefined ? "" : v ? "Sim" : "Não");

function addSheet(
  wb: XLSX.WorkBook,
  name: string,
  headers: string[],
  rows: (string | number | null)[][],
  widths: number[],
  opts?: { autoFilter?: boolean; boldRows?: number[] }
) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map((r) => r.map((c) => (c === null ? "" : c)))]);
  ws["!cols"] = widths.map((w) => ({ wch: w }));
  if (opts?.autoFilter) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range(
        { r: 0, c: 0 },
        { r: rows.length, c: Math.max(0, headers.length - 1) }
      ),
    };
  }
  for (const r of opts?.boldRows ?? []) {
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = (ws as any)[addr];
      if (cell) cell.s = { ...(cell.s ?? {}), font: { bold: true } };
    }
  }
  ws["!freeze"] = { xSplit: "0", ySplit: "1" } as any;
  ws["!panes"] = [{ pane: "bottomLeft", ySplit: 1, state: "frozen" }] as any;
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export function gerarPlanilhaOSConcluidas(
  dados: RelatorioOSConcluidas,
  meta: RelatorioMeta
) {
  const { ordens, pecasUsadas } = dados;

  const pecasPorOS = new Map<string, PecaUsada[]>();
  for (const p of pecasUsadas) {
    const arr = pecasPorOS.get(p.work_order_id) ?? [];
    arr.push(p);
    pecasPorOS.set(p.work_order_id, arr);
  }

  const ativoCodigo = (o: OrdemConcluida) =>
    o.ativos.map((a) => a.unique_code).filter(Boolean).join(", ");
  const ativoProduto = (o: OrdemConcluida) =>
    o.ativos.map((a) => a.peca_nome).filter(Boolean).join(", ");

  // ---------- Aba 1: Peças utilizadas ----------
  const headers1 = [
    "Código OS",
    "Nº da peça na OS",
    "Linha principal da OS",
    "Data conclusão",
    "Mês competência",
    "Cliente",
    "Atividade",
    "Tipo de execução",
    "Ativo atendido (código)",
    "Ativo atendido (produto)",
    "Código da peça",
    "Peça",
    "Família",
    "Quantidade",
    "Classificação OF",
    "Classificação JV",
    "É ativo",
    "Motor removido",
    "Motor instalado",
    "Observação da peça",
    "Registrado por",
    "Data do registro",
    "Técnico responsável",
    "Concluído por",
    "Tempo trabalhado (h) — não somar",
    "ID da OS",
  ];

  const rows1: (string | number | null)[][] = [];
  let semPecaCount = 0;
  let semClassifOF = 0;

  for (const o of ordens) {
    const pecas = (pecasPorOS.get(o.id) ?? []).slice();
    const tempoH = round((o.total_time_seconds ?? 0) / 3600, 2);
    const base = [
      o.code,
      fmtDateTime(o.end_time),
      competencia(o.end_time),
      o.cliente_nome,
      o.activity_nome ?? "",
      o.activity_execution_type ?? "",
      ativoCodigo(o),
      ativoProduto(o),
    ];

    if (pecas.length === 0) {
      semPecaCount++;
      rows1.push([
        base[0],
        1,
        "Sim",
        base[1],
        base[2],
        base[3],
        base[4],
        base[5],
        base[6],
        base[7],
        SEM_PECA,
        SEM_PECA,
        SEM_PECA,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        o.assigned_to_nome ?? "",
        o.concluded_by_nome ?? "",
        tempoH,
        o.id,
      ]);
      continue;
    }

    pecas.forEach((p, i) => {
      if (!p.peca_classificacao_of) semClassifOF++;
      rows1.push([
        base[0],
        i + 1,
        i === 0 ? "Sim" : "Não",
        base[1],
        base[2],
        base[3],
        base[4],
        base[5],
        base[6],
        base[7],
        p.peca_codigo ?? "",
        p.peca_nome ?? "",
        p.peca_familia ?? "",
        typeof p.quantity === "number" ? p.quantity : "",
        p.peca_classificacao_of ?? "",
        p.peca_classificacao_jv ?? "",
        simNao(p.peca_is_asset),
        p.motor_code_removed ?? "",
        p.motor_code_installed ?? "",
        p.notes ?? "",
        p.added_by_nome ?? "",
        fmtDateTime(p.created_at),
        o.assigned_to_nome ?? "",
        o.concluded_by_nome ?? "",
        tempoH,
        o.id,
      ]);
    });
  }

  // ---------- Aba 2: OS concluídas ----------
  const headers2 = [
    "Código OS",
    "ID da OS",
    "Cliente",
    "Atividade",
    "Tipo de execução",
    "Ativo atendido (código)",
    "Ativo atendido (produto)",
    "Data de abertura",
    "Início",
    "Conclusão",
    "Mês competência",
    "Lead time (dias)",
    "Tempo trabalhado (h)",
    "Técnico",
    "Criado por",
    "Concluído por",
    "Nº de linhas de peça",
    "Qtd total de peças",
    "Tem peça registrada",
    "Observações da OS",
  ];

  const rows2 = ordens.map((o) => {
    const pecas = pecasPorOS.get(o.id) ?? [];
    const leadDias =
      o.end_time && o.created_at
        ? round(
            (new Date(o.end_time).getTime() - new Date(o.created_at).getTime()) /
              86400000,
            1
          )
        : "";
    return [
      o.code,
      o.id,
      o.cliente_nome,
      o.activity_nome ?? "",
      o.activity_execution_type ?? "",
      ativoCodigo(o),
      ativoProduto(o),
      fmtDateTime(o.created_at),
      fmtDateTime(o.start_time),
      fmtDateTime(o.end_time),
      competencia(o.end_time),
      leadDias,
      round((o.total_time_seconds ?? 0) / 3600, 2),
      o.assigned_to_nome ?? "",
      o.created_by_nome ?? "",
      o.concluded_by_nome ?? "",
      pecas.length,
      pecas.reduce((s, p) => s + (p.quantity ?? 0), 0),
      pecas.length > 0 ? "Sim" : "Não",
      o.notes ?? "",
    ] as (string | number)[];
  });

  // ---------- Aba 3: Resumo por peça ----------
  const resumo = new Map<
    string,
    {
      codigo: string;
      nome: string;
      familia: string;
      of: string;
      jv: string;
      os: Set<string>;
      qtd: number;
    }
  >();
  for (const p of pecasUsadas) {
    const key = p.peca_codigo ?? p.omie_product_id;
    const cur =
      resumo.get(key) ??
      {
        codigo: p.peca_codigo ?? "",
        nome: p.peca_nome ?? "",
        familia: p.peca_familia ?? "",
        of: p.peca_classificacao_of ?? "",
        jv: p.peca_classificacao_jv ?? "",
        os: new Set<string>(),
        qtd: 0,
      };
    cur.os.add(p.work_order_id);
    cur.qtd += p.quantity ?? 0;
    resumo.set(key, cur);
  }

  const rows3 = Array.from(resumo.values())
    .sort((a, b) => b.qtd - a.qtd)
    .map((r) => [r.codigo, r.nome, r.familia, r.of, r.jv, r.os.size, r.qtd] as (string | number)[]);

  const osDistintasGlobal = new Set(pecasUsadas.map((p) => p.work_order_id)).size;
  const qtdTotalGlobal = pecasUsadas.reduce((s2, p) => s2 + (p.quantity ?? 0), 0);
  rows3.push(["TOTAL", "", "", "", "", osDistintasGlobal, qtdTotalGlobal]);

  // ---------- Aba 4: Parâmetros ----------
  const rows4: (string | number)[][] = [
    ["Relatório", "OS concluídas · Oficina RumiField"],
    ["Gerado em", format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })],
    ["Gerado por", meta.geradoPor ?? ""],
    [
      "Período (data de conclusão) De",
      format(meta.dataConclusaoDe, "dd/MM/yyyy", { locale: ptBR }),
    ],
    ["Até", format(meta.dataConclusaoAte, "dd/MM/yyyy", { locale: ptBR })],
    [
      "Filtro de clientes",
      meta.filtroClientes?.length ? meta.filtroClientes.join(", ") : "Todos",
    ],
    [
      "Filtro de atividades",
      meta.filtroAtividades?.length ? meta.filtroAtividades.join(", ") : "Todas",
    ],
    ["Total de OS concluídas", ordens.length],
    ["Total de linhas de peça", pecasUsadas.length],
    ["OS sem peça registrada", semPecaCount],
    ["Linhas com peça sem Classificação OF", semClassifOF],
    [
      "Grão da aba Peças utilizadas",
      "Uma linha por peça consumida. Os dados da OS se repetem em cada linha. Para somar tempo ou contar OS, use a aba OS concluídas ou filtre Linha principal da OS = Sim.",
    ],
    [
      "Grão da aba OS concluídas",
      "Uma linha por OS. Use esta aba para tempo, lead time e contagem de OS.",
    ],
    [
      "Observação",
      "Esta planilha não contém valores financeiros. O catálogo de peças do RumiField não armazena preço. Período filtrado pela data de conclusão da OS.",
    ],
  ];

  const wb = XLSX.utils.book_new();
  addSheet(wb, "Peças utilizadas", headers1, rows1, [
    12, 8, 10, 17, 10, 28, 24, 14, 20, 26, 14, 34, 18, 11, 24, 24, 8, 16, 16, 30, 22, 17, 22, 22, 14, 38,
  ], { autoFilter: true });
  addSheet(wb, "OS concluídas", headers2, rows2, [
    12, 38, 28, 24, 14, 20, 26, 17, 17, 17, 10, 13, 14, 22, 22, 22, 12, 12, 12, 40,
  ], { autoFilter: true });
  addSheet(wb, "Resumo por peça", ["Código da peça", "Peça", "Família", "Classificação OF", "Classificação JV", "Nº de OS distintas", "Quantidade total"], rows3, [
    14, 34, 18, 24, 24, 14, 14,
  ], { boldRows: [rows3.length] });
  addSheet(wb, "Parâmetros", ["Rótulo", "Valor"], rows4, [36, 90]);

  const fileName = `RumiField_OS_Concluidas_${format(
    meta.dataConclusaoDe,
    "yyyy-MM-dd"
  )}_a_${format(meta.dataConclusaoAte, "yyyy-MM-dd")}.xlsx`;

  XLSX.writeFile(wb, fileName);
  return fileName;
}
