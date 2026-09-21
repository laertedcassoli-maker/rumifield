import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AgendaGrupo = 'instalacao' | 'corretiva' | 'preventiva';

export interface AgendaEvento {
  id: string;
  titulo: string;
  data: string;
  tecnicoNome: string | null;
  clienteNome: string;
  fazenda: string | null;
  grupo: AgendaGrupo;
  tipo: string;
  linkTo: string;
}

export interface AgendaAusencia {
  id: string;
  technician_user_id: string;
  description: string;
  start_date: string;
  end_date: string;
  tecnicoNome: string | null;
}

const TIPO_LABELS: Record<string, string> = {
  pre_instalacao: 'Pré Instalação',
  instalacao: 'Instalação',
  visita_corretiva: 'Visita Corretiva',
  preventiva: 'Preventiva',
};

export const AGENDA_GRUPO_LABELS: Record<AgendaGrupo, string> = {
  instalacao: 'Instalação',
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
};

async function fetchProfilesMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.from('profiles').select('id, nome').in('id', unique);
  return new Map<string, string>((data ?? []).map(p => [p.id as string, p.nome as string]));
}

async function fetchClientesMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, { nome: string; fazenda: string | null }>();
  const { data } = await supabase.from('clientes').select('id, nome, fazenda').in('id', unique);
  return new Map((data ?? []).map(c => [c.id, { nome: c.nome, fazenda: c.fazenda ?? null }]));
}

function buildTitulo(clienteNome: string, fazenda: string | null, tecnicoNome: string | null) {
  const base = fazenda || clienteNome; // fazenda; se não houver, cai pro nome do cliente
  return tecnicoNome ? `${base} — ${tecnicoNome}` : base;
}

// O ícone de categoria é renderizado no evento/legenda da página (AgendaOperacoes.tsx);
// o título do evento fica livre de prefixos, pois o FullCalendar é customizado lá.
function tituloEvento(clienteNome: string, fazenda: string | null, tecnicoNome: string | null) {
  return buildTitulo(clienteNome, fazenda, tecnicoNome);
}

/**
 * Agenda de Operações — agregação somente leitura dos agendamentos de campo.
 * Nenhuma mutação; a RLS de leitura de cada tabela continua valendo.
 * Técnicos (campo/oficina) só veem os próprios compromissos; demais papéis veem tudo.
 */
export function useAgendaOperacoes() {
  const { user, role } = useAuth();
  const uid = user?.id ?? null;
  const somenteMeus = role === 'tecnico_campo' || role === 'tecnico_oficina';
  const escopo = somenteMeus ? `meus:${uid ?? 'anon'}` : 'todos';

  const instalacoes = useQuery({
    queryKey: ['agenda-operacoes', 'instalacoes', escopo],
    queryFn: async (): Promise<AgendaEvento[]> => {
      const { data, error } = await (supabase as any)
        .from('installation_stages')
        .select(
          'id, stage, status, planned_date, technician_user_id, csm_user_id, installations(cliente_id, clientes(nome, fazenda))'
        )
        .not('planned_date', 'is', null)
        .in('stage', ['pre_instalacao', 'instalacao']);
      if (error) throw error;
      // Só compromissos de técnico de campo: etapa atribuída apenas a um CSM não entra na agenda.
      let rows = ((data ?? []) as any[]).filter(r => !!r.technician_user_id);
      if (somenteMeus) rows = rows.filter(r => r.technician_user_id === uid);
      if (!rows.length) return [];

      const profiles = await fetchProfilesMap(
        rows.flatMap(r => [r.technician_user_id, r.csm_user_id]).filter(Boolean)
      );

      return rows.map(r => {
        const cliente = r.installations?.clientes;
        const clienteNome = cliente?.nome ?? 'Cliente';
        const fazenda = cliente?.fazenda ?? null;
        const respId = r.technician_user_id ?? r.csm_user_id ?? null;
        const tecnicoNome = respId ? profiles.get(respId) ?? null : null;
        return {
          id: `stage-${r.id}`,
          titulo: tituloEvento(clienteNome, fazenda, tecnicoNome),
          data: r.planned_date as string,
          tecnicoNome,
          clienteNome,
          fazenda,
          grupo: 'instalacao' as const,
          tipo: r.stage as string,
          linkTo: `/instalacoes/etapa/${r.id}`,
        };
      });
    },
  });

  const visitas = useQuery({
    queryKey: ['agenda-operacoes', 'visitas', escopo],
    queryFn: async (): Promise<AgendaEvento[]> => {
      const { data, error } = await supabase
        .from('ticket_visits')
        .select('id, client_id, field_technician_user_id, planned_start_date, status')
        .not('planned_start_date', 'is', null)
        .neq('status', 'cancelada');
      if (error) throw error;
      let rows = data ?? [];
      if (somenteMeus) rows = rows.filter(r => r.field_technician_user_id === uid);
      if (!rows.length) return [];

      const [profiles, clientes] = await Promise.all([
        fetchProfilesMap(rows.map(r => r.field_technician_user_id).filter(Boolean) as string[]),
        fetchClientesMap(rows.map(r => r.client_id).filter(Boolean) as string[]),
      ]);

      return rows.map(r => {
        const cliente = r.client_id ? clientes.get(r.client_id) : undefined;
        const clienteNome = cliente?.nome ?? 'Cliente';
        const fazenda = cliente?.fazenda ?? null;
        const tecnicoNome = r.field_technician_user_id
          ? profiles.get(r.field_technician_user_id) ?? null
          : null;
        return {
          id: `visita-${r.id}`,
          titulo: tituloEvento(clienteNome, fazenda, tecnicoNome),
          data: r.planned_start_date as string,
          tecnicoNome,
          clienteNome,
          fazenda,
          grupo: 'corretiva' as const,
          tipo: 'visita_corretiva',
          linkTo: `/chamados/visita/${r.id}`,
        };
      });
    },
  });

  const preventivas = useQuery({
    queryKey: ['agenda-operacoes', 'preventivas', escopo],
    queryFn: async (): Promise<AgendaEvento[]> => {
      const { data, error } = await supabase
        .from('preventive_route_items')
        .select('id, route_id, client_id, planned_date, status')
        .not('planned_date', 'is', null)
        .neq('status', 'cancelado');
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) return [];

      const routeIds = [...new Set(rows.map(r => r.route_id).filter(Boolean))];
      const { data: routes } = await supabase
        .from('preventive_routes')
        .select('id, field_technician_user_id, status')
        .in('id', routeIds);
      const routesMap = new Map((routes ?? []).map(r => [r.id, r]));

      const [profiles, clientes] = await Promise.all([
        fetchProfilesMap((routes ?? []).map(r => r.field_technician_user_id).filter(Boolean) as string[]),
        fetchClientesMap(rows.map(r => r.client_id).filter(Boolean) as string[]),
      ]);

      const visiveis = somenteMeus
        ? rows.filter(r => routesMap.get(r.route_id)?.field_technician_user_id === uid)
        : rows;

      return visiveis.map(r => {
        const cliente = r.client_id ? clientes.get(r.client_id) : undefined;
        const clienteNome = cliente?.nome ?? 'Cliente';
        const fazenda = cliente?.fazenda ?? null;
        const techId = routesMap.get(r.route_id)?.field_technician_user_id ?? null;
        const tecnicoNome = techId ? profiles.get(techId) ?? null : null;
        return {
          id: `preventiva-${r.id}`,
          titulo: tituloEvento(clienteNome, fazenda, tecnicoNome),
          data: r.planned_date as string,
          tecnicoNome,
          clienteNome,
          fazenda,
          grupo: 'preventiva' as const,
          tipo: 'preventiva',
          linkTo: `/preventivas/execucao/${r.route_id}/atendimento/${r.id}`,
        };
      });
    },
  });

  const eventos: AgendaEvento[] = [
    ...(instalacoes.data ?? []),
    ...(visitas.data ?? []),
    ...(preventivas.data ?? []),
  ];

  return {
    eventos,
    isLoading: instalacoes.isLoading || visitas.isLoading || preventivas.isLoading,
    error: instalacoes.error || visitas.error || preventivas.error,
  };
}

/**
 * Ausências (férias/folga) — camada visual independente dos eventos da agenda.
 * Leitura para todos que acessam a agenda; criação/remoção só admin/coordenador de serviços (RLS).
 */
export function useAgendaAusencias() {
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const uid = user?.id ?? null;
  const somenteMeus = role === 'tecnico_campo' || role === 'tecnico_oficina';

  const ausencias = useQuery({
    queryKey: ['agenda-ausencias'],
    queryFn: async (): Promise<AgendaAusencia[]> => {
      const { data, error } = await (supabase as any)
        .from('technician_absences')
        .select('id, technician_user_id, description, start_date, end_date')
        .order('start_date', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      if (!rows.length) return [];
      const profiles = await fetchProfilesMap(rows.map(r => r.technician_user_id));
      return rows.map(r => ({
        id: r.id as string,
        technician_user_id: r.technician_user_id as string,
        description: r.description as string,
        start_date: r.start_date as string,
        end_date: r.end_date as string,
        tecnicoNome: profiles.get(r.technician_user_id) ?? null,
      }));
    },
  });

  const criar = useMutation({
    mutationFn: async (input: {
      technician_user_id: string;
      description: string;
      start_date: string;
      end_date: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from('technician_absences')
        .insert({ ...input, created_by_user_id: uid })
        .select('id')
        .single();
      if (error) throw error;
      if (!data?.id) throw new Error('Não foi possível salvar a ausência.');
      return data.id as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agenda-ausencias'] }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from('technician_absences')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Não foi possível remover a ausência (sem permissão).');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agenda-ausencias'] }),
  });

  const lista = (ausencias.data ?? []).filter(a => !somenteMeus || a.technician_user_id === uid);

  return { ausencias: lista, isLoading: ausencias.isLoading, criar, remover };
}

export { TIPO_LABELS as AGENDA_TIPO_LABELS };
