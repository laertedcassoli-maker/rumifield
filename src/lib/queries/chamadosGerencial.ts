import { supabase } from '@/integrations/supabase/client';

export interface ChamadosParams {
  from: string; // yyyy-MM-dd
  to: string; // yyyy-MM-dd
  tecnicoIds: string[];
  priority: 'urgente' | 'alta' | 'media' | 'baixa' | null;
}

export interface TicketRow {
  id: string;
  ticket_code: string;
  title: string;
  status: string;
  priority: string;
  client_id: string | null;
  assigned_technician_id: string | null;
  category_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ChamadosDataset {
  tickets: TicketRow[];
  /** ticket_id -> visitas corretivas (CORR) do chamado */
  visitsByTicket: Record<string, { id: string; status: string; field_technician_user_id: string | null }[]>;
  /** ticket_id -> nomes de tags de causa */
  tagsByTicket: Record<string, string[]>;
  clientNames: Record<string, string>;
  categoryNames: Record<string, string>;
}

const dayStart = (d: string) => `${d}T00:00:00`;
const dayEnd = (d: string) => `${d}T23:59:59.999`;

function applyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  params: ChamadosParams,
) {
  let q = query.gte('created_at', dayStart(params.from)).lte('created_at', dayEnd(params.to));
  if (params.tecnicoIds.length > 0) q = q.in('assigned_technician_id', params.tecnicoIds);
  if (params.priority) q = q.eq('priority', params.priority);
  return q;
}

export async function fetchChamadosDataset(params: ChamadosParams): Promise<ChamadosDataset> {
  const { data, error } = await applyFilters(
    supabase
      .from('technical_tickets')
      .select(
        'id, ticket_code, title, status, priority, client_id, assigned_technician_id, category_id, created_at, resolved_at',
      ),
    params,
  ).order('created_at', { ascending: false });

  if (error) throw error;
  const tickets = (data ?? []) as TicketRow[];

  const empty: ChamadosDataset = {
    tickets,
    visitsByTicket: {},
    tagsByTicket: {},
    clientNames: {},
    categoryNames: {},
  };
  if (!tickets.length) return empty;

  const ticketIds = tickets.map((t) => t.id);
  const clientIds = [...new Set(tickets.map((t) => t.client_id).filter(Boolean))] as string[];
  const categoryIds = [...new Set(tickets.map((t) => t.category_id).filter(Boolean))] as string[];

  const [visitsRes, linksRes, clientsRes, categoriesRes] = await Promise.all([
    supabase
      .from('ticket_visits')
      .select('id, ticket_id, status, field_technician_user_id')
      .in('ticket_id', ticketIds),
    supabase.from('ticket_tag_links').select('ticket_id, tag_id').in('ticket_id', ticketIds),
    clientIds.length
      ? supabase.from('clientes').select('id, nome').in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    categoryIds.length
      ? supabase.from('ticket_categories').select('id, name').in('id', categoryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (visitsRes.error) throw visitsRes.error;
  if (linksRes.error) throw linksRes.error;

  const visitsByTicket: ChamadosDataset['visitsByTicket'] = {};
  for (const v of visitsRes.data ?? []) {
    if (!v.ticket_id) continue;
    (visitsByTicket[v.ticket_id] ??= []).push({
      id: v.id,
      status: v.status as string,
      field_technician_user_id: v.field_technician_user_id,
    });
  }

  const links = linksRes.data ?? [];
  const tagIds = [...new Set(links.map((l) => l.tag_id))];
  let tagNames: Record<string, string> = {};
  if (tagIds.length) {
    const { data: tags } = await supabase.from('ticket_tags').select('id, name').in('id', tagIds);
    tagNames = Object.fromEntries((tags ?? []).map((t) => [t.id, t.name]));
  }
  const tagsByTicket: Record<string, string[]> = {};
  for (const l of links) {
    const name = tagNames[l.tag_id];
    if (!name) continue;
    (tagsByTicket[l.ticket_id] ??= []).push(name);
  }

  return {
    tickets,
    visitsByTicket,
    tagsByTicket,
    clientNames: Object.fromEntries(((clientsRes.data ?? []) as { id: string; nome: string }[]).map((c) => [c.id, c.nome])),
    categoryNames: Object.fromEntries(((categoriesRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])),
  };
}

/** Volume de chamados criados em um intervalo arbitrário (para o gráfico com toggle). */
export async function fetchVolumeChamados(
  range: { from: string; to: string },
  params: Pick<ChamadosParams, 'tecnicoIds' | 'priority'>,
): Promise<{ created_at: string }[]> {
  const { data, error } = await applyFilters(supabase.from('technical_tickets').select('created_at'), {
    ...range,
    ...params,
  });
  if (error) throw error;
  return (data ?? []) as { created_at: string }[];
}

/* =========================================================================
 * Queries nomeadas (1..10) — Chamados › Visão Gerencial
 * Todas usam Supabase.js (PostgREST) sobre technical_tickets / ticket_visits /
 * ticket_tag_links / ticket_tags / clientes / profiles.
 * ========================================================================= */

const hours = (ms: number) => ms / 3_600_000;

/** Reaproveita o dataset filtrado para evitar N requisições. */
async function ds(params: ChamadosParams) {
  return fetchChamadosDataset(params);
}

/** 1. Chamados por status. */
export async function countChamadosPorStatus(
  params: ChamadosParams,
): Promise<{ status: string; count: number }[]> {
  const { tickets } = await ds(params);
  const order = ['aberto', 'em_atendimento', 'aguardando_peca', 'resolvido', 'cancelado'];
  const map = new Map<string, number>();
  for (const t of tickets) map.set(t.status, (map.get(t.status) ?? 0) + 1);
  return order.filter((s) => map.has(s)).map((status) => ({ status, count: map.get(status)! }));
}

/** 2. Resolvidos remotamente vs. com visita corretiva. */
export async function countRemotoVsVisita(
  params: ChamadosParams,
): Promise<{ remoto_count: number; visita_corretiva_count: number; total: number }> {
  const { tickets, visitsByTicket } = await ds(params);
  const resolvidos = tickets.filter((t) => t.status === 'resolvido');
  let comVisita = 0;
  for (const t of resolvidos) if ((visitsByTicket[t.id] ?? []).length > 0) comVisita += 1;
  return {
    remoto_count: resolvidos.length - comVisita,
    visita_corretiva_count: comVisita,
    total: resolvidos.length,
  };
}

/** 3. Volume por mês (default: últimos 6 meses do range informado). */
export async function volumePorMes(
  params: ChamadosParams,
): Promise<{ mes: number; ano: number; count: number }[]> {
  const rows = await fetchVolumeChamados(
    { from: params.from, to: params.to },
    { tecnicoIds: params.tecnicoIds, priority: params.priority },
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => {
      const [ano, mes] = key.split('-').map(Number);
      return { ano, mes, count };
    })
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
}

/** 4. Volume por dia (últimos 14 dias). */
export async function volumePorDia(
  params: Pick<ChamadosParams, 'tecnicoIds' | 'priority'>,
  dias = 14,
): Promise<{ data: string; dia_da_semana: string; count: number }[]> {
  const to = new Date();
  const from = new Date(to.getTime() - (dias - 1) * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const rows = await fetchVolumeChamados({ from: iso(from), to: iso(to) }, params);

  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.created_at.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const semana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const out: { data: string; dia_da_semana: string; count: number }[] = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(from.getTime() + i * 86_400_000);
    const key = iso(d);
    out.push({ data: key, dia_da_semana: semana[d.getDay()], count: map.get(key) ?? 0 });
  }
  return out;
}

/** 5. Top motivos (tags de causa). */
export async function topMotivos(
  params: ChamadosParams,
  limit = 10,
): Promise<{ tag: string; count: number }[]> {
  const { tagsByTicket } = await ds(params);
  const map = new Map<string, number>();
  for (const tags of Object.values(tagsByTicket))
    for (const tag of tags) map.set(tag, (map.get(tag) ?? 0) + 1);
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** 6. Clientes com mais chamados (recorrência). */
export async function clientesRecorrentes(
  params: ChamadosParams,
  limit = 10,
): Promise<{ cliente_id: string; nome: string; count: number }[]> {
  const { tickets, clientNames } = await ds(params);
  const map = new Map<string, number>();
  for (const t of tickets) {
    if (!t.client_id) continue;
    map.set(t.client_id, (map.get(t.client_id) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([cliente_id, count]) => ({ cliente_id, nome: clientNames[cliente_id] ?? '—', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** 7. Produtividade por técnico. */
export async function produtividadePorTecnico(params: ChamadosParams): Promise<
  {
    tecnico_id: string;
    nome: string;
    chamados_atendidos: number;
    visitas_corretivas: number;
    tempo_medio_horas: number | null;
    pct_remoto: number | null;
  }[]
> {
  const { tickets, visitsByTicket } = await ds(params);
  const acc = new Map<
    string,
    { chamados: number; visitas: number; resolvidos: number; remotos: number; somaMs: number; comTempo: number }
  >();

  for (const t of tickets) {
    const id = t.assigned_technician_id;
    if (!id) continue;
    const a =
      acc.get(id) ?? { chamados: 0, visitas: 0, resolvidos: 0, remotos: 0, somaMs: 0, comTempo: 0 };
    a.chamados += 1;
    const visitas = (visitsByTicket[t.id] ?? []).length;
    a.visitas += visitas;
    if (t.status === 'resolvido') {
      a.resolvidos += 1;
      if (visitas === 0) a.remotos += 1;
      if (t.resolved_at) {
        a.somaMs += new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
        a.comTempo += 1;
      }
    }
    acc.set(id, a);
  }

  const ids = [...acc.keys()];
  let nomes: Record<string, string> = {};
  if (ids.length) {
    const { data } = await supabase.from('profiles').select('id, nome').in('id', ids);
    nomes = Object.fromEntries(((data ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]));
  }

  return ids
    .map((id) => {
      const a = acc.get(id)!;
      return {
        tecnico_id: id,
        nome: nomes[id] ?? '—',
        chamados_atendidos: a.chamados,
        visitas_corretivas: a.visitas,
        tempo_medio_horas: a.comTempo ? hours(a.somaMs / a.comTempo) : null,
        pct_remoto: a.resolvidos ? (a.remotos / a.resolvidos) * 100 : null,
      };
    })
    .sort((x, y) => y.chamados_atendidos - x.chamados_atendidos);
}

/** 8. Chamados mais antigos em aberto. */
export async function chamadosMaisAntigosAbertos(
  params: ChamadosParams,
  limit = 5,
): Promise<{ codigo: string; titulo: string; status: string; dias_em_aberto: number }[]> {
  const { tickets } = await ds(params);
  const now = Date.now();
  return tickets
    .filter((t) => ['aberto', 'em_atendimento', 'aguardando_peca'].includes(t.status))
    .map((t) => ({
      codigo: t.ticket_code,
      titulo: t.title,
      status: t.status,
      dias_em_aberto: Math.floor((now - new Date(t.created_at).getTime()) / 86_400_000),
    }))
    .sort((a, b) => b.dias_em_aberto - a.dias_em_aberto)
    .slice(0, limit);
}

/** 9. Tempo médio de atendimento (created_at → resolved_at). */
export async function tempoMedioAtendimento(
  params: ChamadosParams,
): Promise<{ tempo_medio_horas: number | null; tempo_medio_minutos: number | null }> {
  const { tickets } = await ds(params);
  const durs = tickets
    .filter((t) => t.status === 'resolvido' && t.resolved_at)
    .map((t) => new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime())
    .filter((ms) => ms >= 0);
  if (!durs.length) return { tempo_medio_horas: null, tempo_medio_minutos: null };
  const media = durs.reduce((s, v) => s + v, 0) / durs.length;
  return { tempo_medio_horas: hours(media), tempo_medio_minutos: media / 60_000 };
}

/** 10. Chamados abertos há mais de N dias. */
export async function countAbertosMaisDeNDias(
  params: ChamadosParams,
  diasLimite = 5,
): Promise<{ count: number }> {
  const limite = new Date(Date.now() - diasLimite * 86_400_000).toISOString();
  let q = supabase
    .from('technical_tickets')
    .select('id', { count: 'exact', head: true })
    .in('status', ['aberto', 'em_atendimento', 'aguardando_peca'])
    .gte('created_at', dayStart(params.from))
    .lte('created_at', limite);
  if (params.tecnicoIds.length > 0) q = q.in('assigned_technician_id', params.tecnicoIds);
  if (params.priority) q = q.eq('priority', params.priority);
  const { count, error } = await q;
  if (error) throw error;
  return { count: count ?? 0 };
}
