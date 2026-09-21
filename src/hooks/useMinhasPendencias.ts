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

export interface PendenciaChamado {
  id: string;
  ticketCode: string | null;
  clienteNome: string;
  fazenda: string | null;
  createdAt: string;
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

export interface PendenciaInstalacao {
  id: string;
  installationId: string;
  stage: string;
  clienteNome: string;
  fazenda: string | null;
  plannedDate: string | null;
  status: string;
}

const CHAMADO_PENDING = ['aberto', 'em_atendimento', 'aguardando_peca'] as const;
const ROUTE_ITEM_PENDING = ["planejado", "reagendado"] as const;
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
  const { user, role } = useAuth();
  const uid = user?.id;
  const canApproveInstalacao = role === 'coordenador_servicos' || role === 'admin';

  const preventivas = useQuery({
    queryKey: ['my-preventive-routes', 'pendencias', uid],
    enabled: !!uid,
    queryFn: async (): Promise<PendenciaPreventiva[]> => {
      const { data: routes, error: routesError } = await supabase
        .from('preventive_routes')
        .select('id, route_code, status')
        .eq('field_technician_user_id', uid!)
        .in('status', ROUTE_PENDING);
      if (routesError) throw routesError;
      if (!routes?.length) return [];

      const { data: items, error: itemsError } = await supabase
        .from('preventive_route_items')
        .select('id, route_id, client_id, planned_date, status, order_index')
        .in('route_id', routes.map(r => r.id))
        .in('status', ROUTE_ITEM_PENDING)
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
        .in('status', VISIT_PENDING)
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

  const chamados = useQuery({
    queryKey: ['technical_tickets', 'pendencias', uid],
    enabled: !!uid,
    queryFn: async (): Promise<PendenciaChamado[]> => {
      const { data, error } = await supabase
        .from('technical_tickets')
        .select('id, ticket_code, client_id, status, created_at')
        .eq('assigned_technician_id', uid!)
        .in('status', CHAMADO_PENDING)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];
      const clientesMap = await fetchClientesMap([...new Set(data.map(t => t.client_id).filter(Boolean) as string[])]);
      return data.map(t => {
        const cliente = t.client_id ? clientesMap.get(t.client_id) : undefined;
        return {
          id: t.id,
          ticketCode: t.ticket_code,
          clienteNome: cliente?.nome ?? 'Cliente',
          fazenda: cliente?.fazenda ?? null,
          createdAt: t.created_at,
          status: t.status as string,
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

  const mapInstalacaoRows = (rows: any[]): PendenciaInstalacao[] =>
    rows.map(s => ({
      id: s.id,
      installationId: s.installation_id,
      stage: s.stage as string,
      clienteNome: s.installations?.clientes?.nome ?? 'Cliente',
      fazenda: s.installations?.clientes?.fazenda ?? null,
      plannedDate: s.planned_date,
      status: s.status as string,
    }));

  const STAGE_SELECT =
    'id, installation_id, stage, status, planned_date, installations(clientes(nome, fazenda))';

  const instalacoes = useQuery({
    queryKey: ['installations', 'pendencias', uid],
    enabled: !!uid,
    queryFn: async (): Promise<PendenciaInstalacao[]> => {
      const { data, error } = await (supabase as any)
        .from('installation_stages')
        .select(STAGE_SELECT)
        .or(`technician_user_id.eq.${uid},csm_user_id.eq.${uid}`)
        .in('status', ['planejado', 'em_andamento'])
        .order('planned_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return mapInstalacaoRows(data ?? []);
    },
  });

  const aprovacoesInstalacao = useQuery({
    queryKey: ['installations', 'pendencias-aprovacao', uid],
    enabled: !!uid && canApproveInstalacao,
    queryFn: async (): Promise<PendenciaInstalacao[]> => {
      const { data, error } = await (supabase as any)
        .from('installation_stages')
        .select(STAGE_SELECT)
        .eq('stage', 'pre_instalacao')
        .eq('status', 'aguardando_aprovacao')
        .order('planned_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return mapInstalacaoRows(data ?? []);
    },
  });

  const treinamentos = useQuery({
    queryKey: ['training-visits', 'pendencias', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_visits')
        .select('id, cliente_id, status, planned_date')
        .or(`technician_user_id.eq.${uid},csm_user_id.eq.${uid}`)
        .eq('status', 'pendente')
        .order('planned_date', { ascending: true });
      if (error) throw error;
      const clientesMap = await fetchClientesMap([...new Set((data ?? []).map(t => t.cliente_id).filter(Boolean) as string[])]);
      return (data ?? []).map(t => ({
        id: t.id,
        clienteNome: clientesMap.get(t.cliente_id)?.nome ?? 'Cliente',
        fazenda: clientesMap.get(t.cliente_id)?.fazenda ?? null,
        plannedDate: t.planned_date,
        status: t.status,
      }));
    },
  });

  const ordensServico = useQuery({
    queryKey: ['work-orders', 'pendencias', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, code, status, created_at, activities(name)')
        .eq('assigned_to_user_id', uid!)
        .neq('status', 'concluido')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(o => ({
        id: o.id,
        code: o.code,
        atividade: (o as any).activities?.name ?? null,
        createdAt: o.created_at,
        status: o.status,
      }));
    },
  });

  const total =
    (preventivas.data?.length ?? 0) +
    (visitas.data?.length ?? 0) +
    (chamados.data?.length ?? 0) +
    (coletaReversa.data?.length ?? 0) +
    (envios.data?.length ?? 0) +
    (instalacoes.data?.length ?? 0) +
    (treinamentos.data?.length ?? 0) +
    (ordensServico.data?.length ?? 0) +
    (aprovacoesInstalacao.data?.length ?? 0);

  return {
    preventivas,
    visitas,
    chamados,
    coletaReversa,
    envios,
    instalacoes,
    treinamentos,
    ordensServico,
    aprovacoesInstalacao,
    canApproveInstalacao,
    total,
    isLoading:
      preventivas.isLoading ||
      visitas.isLoading ||
      chamados.isLoading ||
      coletaReversa.isLoading ||
      envios.isLoading ||
      instalacoes.isLoading ||
      treinamentos.isLoading ||
      ordensServico.isLoading ||
      (canApproveInstalacao && aprovacoesInstalacao.isLoading),
  };
}

/** Soma total das pendências dos 4 domínios (para o badge do menu). */
export function useMinhasPendenciasCount() {
  return useMinhasPendencias().total;
}
