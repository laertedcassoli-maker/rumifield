import { supabase } from "@/integrations/supabase/client";

export interface RelatorioOSParams {
  dataConclusaoDe: Date;
  dataConclusaoAte: Date;
  clienteIds?: string[];
  activityIds?: string[];
}

export interface AtivoAtendido {
  workshop_item_id: string | null;
  unique_code: string | null;
  peca_codigo: string | null;
  peca_nome: string | null;
}

export interface OrdemConcluida {
  id: string;
  code: string;
  status: string;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
  total_time_seconds: number;
  notes: string | null;
  cliente_id: string | null;
  cliente_nome: string;
  activity_id: string;
  activity_nome: string | null;
  activity_execution_type: string | null;
  assigned_to_user_id: string | null;
  assigned_to_nome: string | null;
  concluded_by_user_id: string | null;
  concluded_by_nome: string | null;
  created_by_user_id: string | null;
  created_by_nome: string | null;
  ativos: AtivoAtendido[];
  lead_time_seconds: number | null;
}

export interface PecaUsada {
  id: string;
  work_order_id: string;
  created_at: string;
  quantity: number;
  notes: string | null;
  motor_code_installed: string | null;
  motor_code_removed: string | null;
  added_by_user_id: string | null;
  added_by_nome: string | null;
  omie_product_id: string;
  peca_codigo: string | null;
  peca_nome: string | null;
  peca_familia: string | null;
  peca_classificacao_of: string | null;
  peca_classificacao_jv: string | null;
  peca_is_asset: boolean | null;
  // dados denormalizados da OS
  os_code: string;
  os_end_time: string | null;
  os_created_at: string;
  os_total_time_seconds: number;
  cliente_id: string | null;
  cliente_nome: string;
  activity_nome: string | null;
  activity_execution_type: string | null;
  assigned_to_nome: string | null;
  concluded_by_nome: string | null;
  ativos_codigos: string;
}

export interface RelatorioOSConcluidas {
  ordens: OrdemConcluida[];
  pecasUsadas: PecaUsada[];
}

const SEM_CLIENTE = "(sem cliente)";
const PAGE_SIZE = 1000;
const IN_BATCH = 200;

/** Executa uma query paginada via .range() até a última página incompleta. */
async function fetchAllPaged<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await buildQuery(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function startOfDayISO(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function endOfDayISO(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

export async function fetchRelatorioOSConcluidas(
  params: RelatorioOSParams
): Promise<RelatorioOSConcluidas> {
  const { dataConclusaoDe, dataConclusaoAte, clienteIds, activityIds } = params;

  // (a) Ordens de serviço concluídas
  const ordensRaw = await fetchAllPaged<any>((from, to) => {
    let q = supabase
      .from("work_orders")
      .select(
        `
        id, code, status, created_at, start_time, end_time, total_time_seconds, notes,
        cliente_id, activity_id, assigned_to_user_id, concluded_by_user_id, created_by_user_id,
        clientes:cliente_id ( id, nome ),
        activities:activity_id ( id, name, execution_type ),
        work_order_items (
          workshop_item_id,
          omie_product_id,
          workshop_items:workshop_item_id (
            unique_code,
            pecas:omie_product_id ( codigo, nome )
          )
        )
      `
      )
      .eq("status", "concluido")
      .gte("end_time", startOfDayISO(dataConclusaoDe))
      .lte("end_time", endOfDayISO(dataConclusaoAte))
      .order("end_time", { ascending: true })
      .range(from, to);

    if (clienteIds?.length) q = q.in("cliente_id", clienteIds);
    if (activityIds?.length) q = q.in("activity_id", activityIds);
    return q as unknown as PromiseLike<{ data: any[] | null; error: any }>;
  });

  const osIds = ordensRaw.map((o) => o.id);

  // (b) Peças usadas nessas OS (em lotes de 200 ids)
  let pecasRaw: any[] = [];
  for (const batch of chunk(osIds, IN_BATCH)) {
    const rows = await fetchAllPaged<any>(
      (from, to) =>
        supabase
          .from("work_order_parts_used")
          .select(
            `
            id, work_order_id, created_at, quantity, notes,
            motor_code_installed, motor_code_removed, added_by_user_id, omie_product_id,
            pecas:omie_product_id ( id, codigo, nome, familia, classificacao_of, classificacao_jv, is_asset )
          `
          )
          .in("work_order_id", batch)
          .order("created_at", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: any[] | null; error: any }>
    );
    pecasRaw = pecasRaw.concat(rows);
  }
  pecasRaw.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  // (c) Perfis referenciados
  const userIds = Array.from(
    new Set(
      [
        ...ordensRaw.flatMap((o) => [
          o.assigned_to_user_id,
          o.concluded_by_user_id,
          o.created_by_user_id,
        ]),
        ...pecasRaw.map((p) => p.added_by_user_id),
      ].filter((v): v is string => !!v)
    )
  );

  const nomePorUser = new Map<string, string>();
  for (const batch of chunk(userIds, IN_BATCH)) {
    const rows = await fetchAllPaged<any>(
      (from, to) =>
        supabase
          .from("profiles")
          .select("id, nome")
          .in("id", batch)
          .range(from, to) as unknown as PromiseLike<{ data: any[] | null; error: any }>
    );
    rows.forEach((r) => nomePorUser.set(r.id, r.nome ?? ""));
  }

  const nome = (id: string | null) => (id ? nomePorUser.get(id) ?? null : null);

  const ordens: OrdemConcluida[] = ordensRaw.map((o) => {
    const ativos: AtivoAtendido[] = (o.work_order_items ?? []).map((it: any) => ({
      workshop_item_id: it.workshop_item_id ?? null,
      unique_code: it.workshop_items?.unique_code ?? null,
      peca_codigo: it.workshop_items?.pecas?.codigo ?? null,
      peca_nome: it.workshop_items?.pecas?.nome ?? null,
    }));

    const leadTime =
      o.end_time && o.created_at
        ? Math.max(
            0,
            Math.round(
              (new Date(o.end_time).getTime() - new Date(o.created_at).getTime()) / 1000
            )
          )
        : null;

    return {
      id: o.id,
      code: o.code,
      status: o.status,
      created_at: o.created_at,
      start_time: o.start_time ?? null,
      end_time: o.end_time ?? null,
      total_time_seconds: o.total_time_seconds ?? 0,
      notes: o.notes ?? null,
      cliente_id: o.cliente_id ?? null,
      cliente_nome: o.clientes?.nome ?? SEM_CLIENTE,
      activity_id: o.activity_id,
      activity_nome: o.activities?.name ?? null,
      activity_execution_type: o.activities?.execution_type ?? null,
      assigned_to_user_id: o.assigned_to_user_id ?? null,
      assigned_to_nome: nome(o.assigned_to_user_id ?? null),
      concluded_by_user_id: o.concluded_by_user_id ?? null,
      concluded_by_nome: nome(o.concluded_by_user_id ?? null),
      created_by_user_id: o.created_by_user_id ?? null,
      created_by_nome: nome(o.created_by_user_id ?? null),
      ativos,
      lead_time_seconds: leadTime,
    };
  });

  const osPorId = new Map(ordens.map((o) => [o.id, o]));

  const pecasUsadas: PecaUsada[] = pecasRaw.map((p) => {
    const os = osPorId.get(p.work_order_id);
    return {
      id: p.id,
      work_order_id: p.work_order_id,
      created_at: p.created_at,
      quantity: p.quantity ?? 0,
      notes: p.notes ?? null,
      motor_code_installed: p.motor_code_installed ?? null,
      motor_code_removed: p.motor_code_removed ?? null,
      added_by_user_id: p.added_by_user_id ?? null,
      added_by_nome: nome(p.added_by_user_id ?? null),
      omie_product_id: p.omie_product_id,
      peca_codigo: p.pecas?.codigo ?? null,
      peca_nome: p.pecas?.nome ?? null,
      peca_familia: p.pecas?.familia ?? null,
      peca_classificacao_of: p.pecas?.classificacao_of ?? null,
      peca_classificacao_jv: p.pecas?.classificacao_jv ?? null,
      peca_is_asset: p.pecas?.is_asset ?? null,
      os_code: os?.code ?? "",
      os_end_time: os?.end_time ?? null,
      os_created_at: os?.created_at ?? "",
      os_total_time_seconds: os?.total_time_seconds ?? 0,
      cliente_id: os?.cliente_id ?? null,
      cliente_nome: os?.cliente_nome ?? SEM_CLIENTE,
      activity_nome: os?.activity_nome ?? null,
      activity_execution_type: os?.activity_execution_type ?? null,
      assigned_to_nome: os?.assigned_to_nome ?? null,
      concluded_by_nome: os?.concluded_by_nome ?? null,
      ativos_codigos: (os?.ativos ?? [])
        .map((a) => a.unique_code)
        .filter(Boolean)
        .join(", "),
    };
  });

  return { ordens, pecasUsadas };
}
