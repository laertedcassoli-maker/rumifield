import { supabase } from '@/integrations/supabase/client';

export interface ChamadosParams {
  from: string; // yyyy-MM-dd
  to: string; // yyyy-MM-dd
  tecnicoIds: string[];
  priority: string | null;
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
