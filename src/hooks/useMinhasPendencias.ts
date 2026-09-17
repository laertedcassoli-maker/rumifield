import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PendenciaPreventiva {
  id: string;
  routeId: string;
  routeCode: string | null;
  clienteNome: string;
  fazenda: string | null;
  plannedDate: string | null;
  status: string;
}

export interface PendenciaVisita {
  id: string;
  visitCode: string | null;
  ticketCode: string | null;
  clienteNome: string;
  fazenda: string | null;
  plannedDate: string | null;
  status: string;
}

export interface PendenciaPedido {
  id: string;
  pedidoCode: string | null;
  clienteNome: string;
  fazenda: string | null;
  createdAt: string;
  status: string;
}

const ROUTE_ITEM_PENDING = ['planejado', 'reagendado'] as const;
const ROUTE_PENDING = ['planejada', 'em_execucao'] as const;
const VISIT_PENDING = ['em_elaboracao', 'planejada', 'em_execucao'] as const;
const ENVIO_FINALIZADOS = ['faturado', 'enviado', 'entregue'] as const;

async function fetchClientesMap(ids: string[]) {
  if (!ids.length) return new Map<string, { nome: string; fazenda: string | null }>();
  const { data } = await supabase
    .from('clientes')
    .select('id, nome, fazenda')
    .in('id', ids);
  return new Map((data ?? []).map(c => [c.id, { nome: c.nome, fazenda: c.fazenda ?? null }]));
}

/**
 * Pendências pessoais do usuário logado, agregadas a partir dos domínios existentes.
 * Somente leitura — nenhuma mutação. RLS de cada tabela continua valendo.
 */
export function useMinhasPendencias() {
  const { user } = useAuth();
  const uid = user?.id;

  const preventivas = useQuery({
    queryKey: ['my-preventive-routes', 'pendencias', uid],
    enabled: !!uid,
    queryFn: async (): Promise<PendenciaPreventiva[]> => {
      const { data: routes, error: routesError } = await supabase
        .from('preventive_routes')
        .select('id, route_code, status')
        .eq('field_technician_user_id', uid!)
        .in('status', ROUTE_PENDING as unknown as string[]);
      if (routesError) throw routesError;
      if (!routes?.length) return [];

      const { data: items, error: itemsError } = await supabase
        .from('preventive_route_items')
        .select('id, route_id, client_id, planned_date, status, order_index')
        .in('route_id', routes.map(r => r.id))
        .in('status', ROUTE_ITEM_PENDING as unknown as string[])
        .order('planned_date', { ascending: true })
        .order('order_index', { ascending: true });
      if (itemsError) throw itemsError;
      if (!items?.length) return [];

      const routesMap = new Map(routes.map(r => [r.id, r]));
      const clientesMap = await fetchClientesMap([...new Set(items.map(i => i.client_id).filter(Boolean) as string[])]);

      return items.map(i => {
        const cliente = i.client_id ? clientesMap.get(i.client_id) : undefined;
        return {
          id: i.id,
          routeId: i.route_id,
          routeCode: routesMap.get(i.route_id)?.route_code ?? null,
          clienteNome: cliente?.nome ?? 'Cliente',
          fazenda: cliente?.fazenda ?? null,
          plannedDate: i.planned_date,
          status: i.status as string,
        };
      });
    },
  });

  const visitas = useQuery({
    queryKey: ['my-corrective-visits', 'pendencias', uid],
    enabled: !!uid,
    queryFn: async (): Promise<PendenciaVisita[]> => {
      const { data: visits, error } = await supabase
        .from('ticket_visits')
        .select('id, visit_code, ticket_id, client_id, planned_start_date, status')
        .eq('field_technician_user_id', uid!)
        .in('status', VISIT_PENDING as unknown as string[])
        .order('planned_start_date', { ascending: true });
      if (error) throw error;
      if (!visits?.length) return [];

      const ticketIds = [...new Set(visits.map(v => v.ticket_id).filter(Boolean) as string[])];
      const [{ data: tickets }, clientesMap] = await Promise.all([
        ticketIds.length
          ? supabase.from('technical_tickets').select('id, ticket_code').in('id', ticketIds)
          : Promise.resolve({ data: [] as Array<{ id: string; ticket_code: string | null }> }),
        fetchClientesMap([...new Set(visits.map(v => v.client_id).filter(Boolean) as string[])]),
      ]);
      const ticketsMap = new Map((tickets ?? []).map(t => [t.id, t.ticket_code ?? null]));

      return visits.map(v => {
        const cliente = v.client_id ? clientesMap.get(v.client_id) : undefined;
        return {
          id: v.id,
          visitCode: v.visit_code,
          ticketCode: v.ticket_id ? ticketsMap.get(v.ticket_id) ?? null : null,
          clienteNome: cliente?.nome ?? 'Cliente',
          fazenda: cliente?.fazenda ?? null,
          plannedDate: v.planned_start_date,
          status: v.status as string,
        };
      });
    },
  });

  const coletaReversa = useQuery({
    queryKey: ['pedidos', 'pendencias-coleta', uid],
    enabled: !!uid,
    queryFn: async (): Promise<PendenciaPedido[]> => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, pedido_code, status, created_at, cliente_id, clientes(nome, fazenda)')
        .eq('tipo_solicitacao', 'coleta_reversa')
        .eq('status', 'pendente')
        .or(`tecnico_responsavel_user_id.eq.${uid},csm_responsavel_user_id.eq.${uid},and(tipo_coleta.eq.correios,solicitante_id.eq.${uid})`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(p => ({
        id: p.id,
        pedidoCode: p.pedido_code,
        clienteNome: (p as any).clientes?.nome ?? 'Cliente',
        fazenda: (p as any).clientes?.fazenda ?? null,
        createdAt: p.created_at,
        status: p.status as string,
      }));
    },
  });

  const envios = useQuery({
    queryKey: ['pedidos', 'pendencias-envio', uid],
    enabled: !!uid,
    queryFn: async (): Promise<PendenciaPedido[]> => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, pedido_code, status, created_at, cliente_id, clientes(nome, fazenda)')
        .eq('tipo_solicitacao', 'envio')
        .eq('tecnico_responsavel_user_id', uid!)
        .not('status', 'in', `(${ENVIO_FINALIZADOS.join(',')})`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(p => ({
        id: p.id,
        pedidoCode: p.pedido_code,
        clienteNome: (p as any).clientes?.nome ?? 'Cliente',
        fazenda: (p as any).clientes?.fazenda ?? null,
        createdAt: p.created_at,
        status: p.status as string,
      }));
    },
  });

  const total =
    (preventivas.data?.length ?? 0) +
    (visitas.data?.length ?? 0) +
    (coletaReversa.data?.length ?? 0) +
    (envios.data?.length ?? 0);

  return {
    preventivas,
    visitas,
    coletaReversa,
    envios,
    total,
    isLoading:
      preventivas.isLoading || visitas.isLoading || coletaReversa.isLoading || envios.isLoading,
  };
}

/** Soma total das pendências dos 4 domínios (para o badge do menu). */
export function useMinhasPendenciasCount() {
  return useMinhasPendencias().total;
}
