/**
 * Queries de leitura para "Manutenção Preventiva › Visão Gerencial".
 *
 * Todas as funções são somente leitura (SELECT) e recebem os mesmos parâmetros
 * de filtro da tela: período (date range), técnicos (opcional) e status (opcional).
 *
 * Observações de modelagem:
 * - O status da fazenda NÃO existe em coluna: é derivado de
 *   `clientes.preventive_frequency_days` (default 90) vs. a última
 *   `preventive_maintenance.completed_date` com status = 'concluida'.
 * - Regras: atrasada (dias restantes < 0), elegível (<= 30), em dia (> 30),
 *   sem histórico (nunca teve preventiva concluída).
 * - Tempo médio por visita vem de `preventive_checklists.started_at/completed_at`.
 */
import { supabase } from '@/integrations/supabase/client';

/** Evita parsing type-level das select strings (performance de typecheck). */
const sel = (s: string): string => s;

export const DEFAULT_FREQUENCY_DAYS = 90;
export const ELEGIVEL_THRESHOLD_DAYS = 30;

export type FarmStatus = 'em_dia' | 'elegivel' | 'atrasada' | 'sem_historico';

export interface GerencialParams {
  /** yyyy-MM-dd */
  from: string;
  /** yyyy-MM-dd */
  to: string;
  /** ids de técnicos de campo; vazio = todos */
  tecnicoIds?: string[];
  /** filtro de status da fazenda; null = todos */
  status?: FarmStatus | null;
}

export interface PeriodPair {
  atual: { from: string; to: string };
  anterior: { from: string; to: string };
}

const daysBetween = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / 86_400_000);

const toDate = (iso: string) => new Date(`${iso}T00:00:00`);

/** Última preventiva concluída por cliente + técnico que executou. */
async function fetchLastPreventivas(tecnicoIds?: string[]) {
  let q = supabase
    .from('preventive_maintenance')
    .select(sel('client_id, completed_date, technician_user_id'))
    .eq('status', 'concluida')
    .not('completed_date', 'is', null)
    .order('completed_date', { ascending: false });
  if (tecnicoIds?.length) q = q.in('technician_user_id', tecnicoIds);

  const { data, error } = await q.returns<
    { client_id: string; completed_date: string; technician_user_id: string | null }[]
  >();
  if (error) throw error;

  const map = new Map<string, { completed_date: string; technician_user_id: string | null }>();
  (data ?? []).forEach((r) => {
    if (!map.has(r.client_id)) map.set(r.client_id, r);
  });
  return map;
}

export interface FarmStatusRow {
  cliente_id: string;
  nome: string;
  fazenda: string | null;
  frequencia_dias: number;
  ultima_preventiva: string | null;
  dias_desde_ultima: number | null;
  dias_restantes: number | null;
  dias_atraso: number;
  status: FarmStatus;
  tecnico_atribuido: string | null;
}

/** Carteira com status derivado por fazenda (base das queries 1 e 3). */
export async function fetchCarteiraStatus(params: GerencialParams): Promise<FarmStatusRow[]> {
  const [clientesRes, lastMap, vinculosRes] = await Promise.all([
    supabase
      .from('clientes')
      .select(sel('id, nome, fazenda, preventive_frequency_days, status'))
      .order('nome')
      .returns<
        {
          id: string;
          nome: string;
          fazenda: string | null;
          preventive_frequency_days: number | null;
          status: string | null;
        }[]
      >(),
    fetchLastPreventivas(),
    supabase
      .from('tecnico_clientes')
      .select(sel('tecnico_id, cliente_id'))
      .returns<{ tecnico_id: string; cliente_id: string }[]>(),
  ]);

  if (clientesRes.error) throw clientesRes.error;
  if (vinculosRes.error) throw vinculosRes.error;

  const vinculo = new Map<string, string>();
  (vinculosRes.data ?? []).forEach((v) => {
    if (!vinculo.has(v.cliente_id)) vinculo.set(v.cliente_id, v.tecnico_id);
  });

  const today = new Date();
  const rows: FarmStatusRow[] = (clientesRes.data ?? [])
    .filter((c) => (c.status ?? 'ativo') !== 'inativo')
    .map((c) => {
      const last = lastMap.get(c.id) ?? null;
      const freq = c.preventive_frequency_days ?? DEFAULT_FREQUENCY_DAYS;
      const diasDesde = last ? daysBetween(today, toDate(last.completed_date)) : null;
      const diasRestantes = diasDesde === null ? null : freq - diasDesde;
      const status: FarmStatus =
        diasRestantes === null
          ? 'sem_historico'
          : diasRestantes < 0
            ? 'atrasada'
            : diasRestantes <= ELEGIVEL_THRESHOLD_DAYS
              ? 'elegivel'
              : 'em_dia';
      return {
        cliente_id: c.id,
        nome: c.nome,
        fazenda: c.fazenda,
        frequencia_dias: freq,
        ultima_preventiva: last?.completed_date ?? null,
        dias_desde_ultima: diasDesde,
        dias_restantes: diasRestantes,
        dias_atraso: diasRestantes !== null && diasRestantes < 0 ? Math.abs(diasRestantes) : 0,
        status,
        tecnico_atribuido: last?.technician_user_id ?? vinculo.get(c.id) ?? null,
      };
    });

  const byTech = params.tecnicoIds?.length
    ? rows.filter((r) => r.tecnico_atribuido && params.tecnicoIds!.includes(r.tecnico_atribuido))
    : rows;

  return params.status ? byTech.filter((r) => r.status === params.status) : byTech;
}

/** 1. Contagem de fazendas por status. */
export async function fetchFazendasPorStatus(
  params: GerencialParams,
): Promise<{ status: FarmStatus; count: number }[]> {
  const rows = await fetchCarteiraStatus(params);
  const order: FarmStatus[] = ['em_dia', 'elegivel', 'atrasada', 'sem_historico'];
  return order.map((status) => ({ status, count: rows.filter((r) => r.status === status).length }));
}

/** 2. Rotas concluídas por mês no período. */
export async function fetchRotasConcluidasPorMes(
  params: GerencialParams,
): Promise<{ mes: number; ano: number; count: number }[]> {
  let q = supabase
    .from('preventive_routes')
    .select(sel('id, created_at, start_date, status, field_technician_user_id'))
    .eq('status', 'finalizada')
    .gte('start_date', params.from)
    .lte('start_date', params.to);
  if (params.tecnicoIds?.length) q = q.in('field_technician_user_id', params.tecnicoIds);

  const { data, error } = await q.returns<{ created_at: string; start_date: string }[]>();
  if (error) throw error;

  const map = new Map<string, number>();
  (data ?? []).forEach((r) => {
    const d = toDate(r.start_date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([key, count]) => {
      const [ano, mes] = key.split('-').map(Number);
      return { ano, mes, count };
    })
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
}

/** 3. Top fazendas mais atrasadas. */
export async function fetchTopFazendasAtrasadas(
  params: GerencialParams,
  limit = 10,
): Promise<{ cliente_id: string; nome: string; dias_atraso: number; tecnico_atribuido: string | null }[]> {
  const rows = await fetchCarteiraStatus({ ...params, status: params.status ?? 'atrasada' });
  return rows
    .slice()
    .sort((a, b) => b.dias_atraso - a.dias_atraso)
    .slice(0, limit)
    .map((r) => ({
      cliente_id: r.cliente_id,
      nome: r.fazenda ? `${r.nome} · ${r.fazenda}` : r.nome,
      dias_atraso: r.dias_atraso,
      tecnico_atribuido: r.tecnico_atribuido,
    }));
}

export interface ProdutividadeRow {
  tecnico_id: string;
  rotas_concluidas: number;
  rotas_total: number;
  fazendas_visitadas: number;
  tempo_medio_minutos: number | null;
  em_atraso_count: number;
}

/** 4. Produtividade por técnico no período. */
export async function fetchProdutividadeTecnicos(
  params: GerencialParams,
): Promise<ProdutividadeRow[]> {
  let routesQ = supabase
    .from('preventive_routes')
    .select(
      sel('id, status, start_date, end_date, field_technician_user_id, preventive_route_items(id, client_id, status)'),
    )
    .gte('start_date', params.from)
    .lte('start_date', params.to);
  if (params.tecnicoIds?.length) routesQ = routesQ.in('field_technician_user_id', params.tecnicoIds);

  const routesRes = await routesQ.returns<
    {
      id: string;
      status: string;
      start_date: string;
      end_date: string;
      field_technician_user_id: string;
      preventive_route_items: { id: string; client_id: string; status: string }[] | null;
    }[]
  >();
  if (routesRes.error) throw routesRes.error;
  const routes = routesRes.data ?? [];

  // Tempo por visita: checklists concluídos das preventivas do período.
  let pmQ = supabase
    .from('preventive_maintenance')
    .select(sel('id, technician_user_id, completed_date, preventive_checklists(started_at, completed_at)'))
    .eq('status', 'concluida')
    .gte('completed_date', params.from)
    .lte('completed_date', params.to);
  if (params.tecnicoIds?.length) pmQ = pmQ.in('technician_user_id', params.tecnicoIds);

  const pmRes = await pmQ.returns<
    {
      id: string;
      technician_user_id: string | null;
      preventive_checklists: { started_at: string | null; completed_at: string | null }[] | null;
    }[]
  >();
  if (pmRes.error) throw pmRes.error;

  const tempo = new Map<string, { total: number; n: number }>();
  (pmRes.data ?? []).forEach((pm) => {
    if (!pm.technician_user_id) return;
    (pm.preventive_checklists ?? []).forEach((ck) => {
      if (!ck.started_at || !ck.completed_at) return;
      const mins = (new Date(ck.completed_at).getTime() - new Date(ck.started_at).getTime()) / 60_000;
      if (mins <= 0 || mins > 24 * 60) return; // descarta outliers/registros abertos
      const cur = tempo.get(pm.technician_user_id!) ?? { total: 0, n: 0 };
      cur.total += mins;
      cur.n += 1;
      tempo.set(pm.technician_user_id!, cur);
    });
  });

  const today = new Date().toISOString().slice(0, 10);
  const agg = new Map<string, ProdutividadeRow>();
  routes.forEach((r) => {
    const cur =
      agg.get(r.field_technician_user_id) ??
      ({
        tecnico_id: r.field_technician_user_id,
        rotas_concluidas: 0,
        rotas_total: 0,
        fazendas_visitadas: 0,
        tempo_medio_minutos: null,
        em_atraso_count: 0,
      } as ProdutividadeRow);
    cur.rotas_total += 1;
    if (r.status === 'finalizada') cur.rotas_concluidas += 1;
    if (r.status !== 'finalizada' && r.end_date < today) cur.em_atraso_count += 1;
    cur.fazendas_visitadas += (r.preventive_route_items ?? []).filter((i) => i.status === 'executado').length;
    agg.set(r.field_technician_user_id, cur);
  });

  return Array.from(agg.values())
    .map((row) => {
      const t = tempo.get(row.tecnico_id);
      return { ...row, tempo_medio_minutos: t && t.n > 0 ? Math.round(t.total / t.n) : null };
    })
    .sort((a, b) => b.rotas_concluidas - a.rotas_concluidas);
}

export interface AderenciaResult {
  concluidas_atual: number;
  planejadas_atual: number;
  concluidas_anterior: number;
  planejadas_anterior: number;
}

/** 5. Aderência de rotas: período atual vs. anterior. */
export async function fetchAderenciaRotas(
  periods: PeriodPair,
  tecnicoIds?: string[],
): Promise<AderenciaResult> {
  const build = (from: string, to: string) => {
    let q = supabase
      .from('preventive_routes')
      .select(sel('id, status'))
      .gte('start_date', from)
      .lte('start_date', to);
    if (tecnicoIds?.length) q = q.in('field_technician_user_id', tecnicoIds);
    return q.returns<{ id: string; status: string }[]>();
  };

  const [atual, anterior] = await Promise.all([
    build(periods.atual.from, periods.atual.to),
    build(periods.anterior.from, periods.anterior.to),
  ]);
  if (atual.error) throw atual.error;
  if (anterior.error) throw anterior.error;

  const a = atual.data ?? [];
  const b = anterior.data ?? [];
  return {
    concluidas_atual: a.filter((r) => r.status === 'finalizada').length,
    planejadas_atual: a.length,
    concluidas_anterior: b.filter((r) => r.status === 'finalizada').length,
    planejadas_anterior: b.length,
  };
}
