import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AgendaGrupo = 'novas_instalacoes' | 'instalacoes_existentes';

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

const TIPO_LABELS: Record<string, string> = {
  pre_instalacao: 'Pré Instalação',
  instalacao: 'Instalação',
  visita_corretiva: 'Visita Corretiva',
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

// O ícone de grupo é renderizado no evento/legenda da página (AgendaOperacoes.tsx);
// o título do evento fica livre de prefixos, pois o FullCalendar é customizado lá.
function tituloEvento(clienteNome: string, fazenda: string | null, tecnicoNome: string | null) {
  return buildTitulo(clienteNome, fazenda, tecnicoNome);
}

/**
 * Agenda de Operações — agregação somente leitura dos agendamentos de campo.
 * Nenhuma mutação; a RLS de leitura de cada tabela continua valendo.
 */
export function useAgendaOperacoes() {
  const instalacoes = useQuery({
    queryKey: ['agenda-operacoes', 'instalacoes'],
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
      const rows = ((data ?? []) as any[]).filter(r => !!r.technician_user_id);
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
          grupo: 'novas_instalacoes' as const,
          tipo: r.stage as string,
          linkTo: `/instalacoes/etapa/${r.id}`,
        };
      });
    },
  });

  const visitas = useQuery({
    queryKey: ['agenda-operacoes', 'visitas'],
    queryFn: async (): Promise<AgendaEvento[]> => {
      const { data, error } = await supabase
        .from('ticket_visits')
        .select('id, client_id, field_technician_user_id, planned_start_date, status')
        .not('planned_start_date', 'is', null)
        .neq('status', 'cancelada');
      if (error) throw error;
      const rows = data ?? [];
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
          grupo: 'instalacoes_existentes' as const,
          tipo: 'visita_corretiva',
          linkTo: `/chamados/visita/${r.id}`,
        };
      });
    },
  });

  const preventivas = useQuery({
    queryKey: ['agenda-operacoes', 'preventivas'],
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

      return rows
        .map(r => {
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
            grupo: 'instalacoes_existentes' as const,
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

export { TIPO_LABELS as AGENDA_TIPO_LABELS };
