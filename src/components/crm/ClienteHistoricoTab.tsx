import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Wrench, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TimelineEventModal } from '@/components/crm/TimelineEventModal';
import { useOffline } from '@/contexts/OfflineContext';
import { useOfflinePreventivas } from '@/hooks/useOfflinePreventivas';

type EventType = 'chamado' | 'preventiva' | 'corretiva';

interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  subtitle?: string;
  date: Date;
  status: string;
  statusColor: string;
  link?: string;
}

function getStatusLabel(status: string, type: EventType): string {
  const labels: Record<string, Record<string, string>> = {
    chamado: {
      aberto: 'Aberto',
      em_atendimento: 'Em Atendimento',
      aguardando_peca: 'Aguardando Peça',
      resolvido: 'Resolvido',
      cancelado: 'Cancelado',
    },
    preventiva: {
      agendada: 'Agendada',
      em_andamento: 'Em Andamento',
      concluida: 'Concluída',
      cancelada: 'Cancelada',
    },
    corretiva: {
      em_elaboracao: 'Em Elaboração',
      agendada: 'Agendada',
      em_deslocamento: 'Em Deslocamento',
      em_execucao: 'Em Execução',
      concluida: 'Concluída',
      cancelada: 'Cancelada',
    },
  };
  return labels[type]?.[status] || status;
}

function getStatusColor(status: string): string {
  if (['resolvido', 'concluida', 'concluído'].includes(status)) {
    return 'text-green-700 border-green-300 bg-green-50';
  }
  if (['cancelado', 'cancelada'].includes(status)) {
    return 'text-gray-500 border-gray-300 bg-gray-50';
  }
  if (['em_atendimento', 'em_andamento', 'em_execucao', 'em_deslocamento'].includes(status)) {
    return 'text-blue-700 border-blue-300 bg-blue-50';
  }
  if (['aguardando_peca'].includes(status)) {
    return 'text-amber-700 border-amber-300 bg-amber-50';
  }
  return 'text-gray-700 border-gray-300 bg-gray-50';
}

interface ClienteHistoricoTabProps {
  clientId: string;
}

export function ClienteHistoricoTab({ clientId }: ClienteHistoricoTabProps) {
  const [filterType, setFilterType] = useState<EventType | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const { isOnline } = useOffline();

  // Offline hook (preventivas only — chamados/corretivas são 100% online)
  const { preventivas: allOfflinePreventivas } = useOfflinePreventivas();

  const offlinePreventivas = useMemo(() =>
    allOfflinePreventivas.filter(p => p.client_id === clientId).slice(0, 20),
    [allOfflinePreventivas, clientId]
  );

  // Online queries (chamados/corretivas: online-only; preventivas: fallback offline)
  const { data: onlineChamados = [] } = useQuery({
    queryKey: ['cliente-chamados', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technical_tickets')
        .select('id, ticket_code, title, status, priority, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: onlinePreventivas = [] } = useQuery({
    queryKey: ['cliente-preventivas', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_maintenance')
        .select('id, scheduled_date, completed_date, status, public_token')
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && isOnline,
  });

  const { data: onlineCorretivas = [] } = useQuery({
    queryKey: ['cliente-corretivas', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_visits')
        .select(`
          id, visit_code, status, planned_start_date, checkin_at,
          technical_tickets!inner(client_id, title),
          corrective_maintenance(public_token)
        `)
        .eq('technical_tickets.client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const chamados = onlineChamados;
  const preventivas = isOnline ? onlinePreventivas : offlinePreventivas.map(p => ({
    id: p.id, scheduled_date: p.scheduled_date, completed_date: p.completed_date,
    status: p.status, public_token: p.public_token,
  }));
  const corretivas = onlineCorretivas;

  // Build unified timeline
  const timeline: TimelineEvent[] = [
    ...chamados.map((c): TimelineEvent => ({
      id: c.id, type: 'chamado',
      title: `Chamado ${c.ticket_code}`, subtitle: c.title,
      date: new Date(c.created_at),
      status: getStatusLabel(c.status, 'chamado'),
      statusColor: getStatusColor(c.status),
      link: `/chamados/${c.id}`,
    })),
    ...preventivas.map((p): TimelineEvent => ({
      id: p.id, type: 'preventiva',
      title: 'Preventiva',
      subtitle: p.completed_date
        ? `Concluída em ${format(new Date(p.completed_date), 'dd/MM/yyyy')}`
        : `Agendada para ${format(new Date(p.scheduled_date), 'dd/MM/yyyy')}`,
      date: new Date(p.completed_date || p.scheduled_date),
      status: getStatusLabel(p.status, 'preventiva'),
      statusColor: getStatusColor(p.status),
      link: p.public_token ? `/relatorio/${p.public_token}` : undefined,
    })),
    ...corretivas.map((v): TimelineEvent => {
      const cmData = v.corrective_maintenance as { public_token: string | null } | null;
      const publicToken = cmData?.public_token;
      return {
        id: v.id, type: 'corretiva',
        title: `Visita ${v.visit_code}`,
        subtitle: (v.technical_tickets as any)?.title,
        date: new Date(v.checkin_at || v.planned_start_date || new Date()),
        status: getStatusLabel(v.status, 'corretiva'),
        statusColor: getStatusColor(v.status),
        link: publicToken ? `/relatorio-corretivo/${publicToken}` : undefined,
      };
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const filteredTimeline = filterType
    ? timeline.filter(e => e.type === filterType)
    : timeline;

  const toggleFilter = (type: EventType) => {
    setFilterType(prev => prev === type ? null : type);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02]",
            filterType === 'chamado'
              ? "ring-2 ring-orange-500 bg-orange-100 dark:bg-orange-900/40"
              : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
          )}
          onClick={() => toggleFilter('chamado')}
        >
          <CardContent className="py-3 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-orange-600" />
            <p className="text-lg font-bold mt-1">{chamados.length}</p>
            <p className="text-xs text-muted-foreground">Chamados</p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02]",
            filterType === 'preventiva'
              ? "ring-2 ring-green-500 bg-green-100 dark:bg-green-900/40"
              : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          )}
          onClick={() => toggleFilter('preventiva')}
        >
          <CardContent className="py-3 text-center">
            <Calendar className="h-5 w-5 mx-auto text-green-600" />
            <p className="text-lg font-bold mt-1">{preventivas.length}</p>
            <p className="text-xs text-muted-foreground">Preventivas</p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02]",
            filterType === 'corretiva'
              ? "ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/40"
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          )}
          onClick={() => toggleFilter('corretiva')}
        >
          <CardContent className="py-3 text-center">
            <Wrench className="h-5 w-5 mx-auto text-blue-600" />
            <p className="text-lg font-bold mt-1">{corretivas.length}</p>
            <p className="text-xs text-muted-foreground">Corretivas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter indicator */}
      {filterType && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">
            Mostrando apenas: <span className="font-medium capitalize">{filterType}s</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setFilterType(null)}>
            Limpar filtro
          </Button>
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Linha do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTimeline.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {filterType ? 'Nenhum registro encontrado para este filtro' : 'Nenhum atendimento registrado'}
            </p>
          ) : (
            <div className="space-y-4">
              {filteredTimeline.slice(0, 20).map((event) => (
                <div
                  key={`${event.type}-${event.id}`}
                  className="flex gap-3 cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    event.type === 'chamado'
                      ? 'bg-orange-100 dark:bg-orange-900/30'
                      : event.type === 'preventiva'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-blue-100 dark:bg-blue-900/30'
                  }`}>
                    {event.type === 'chamado' && <AlertTriangle className="h-4 w-4 text-orange-600" />}
                    {event.type === 'preventiva' && <Calendar className="h-4 w-4 text-green-600" />}
                    {event.type === 'corretiva' && <Wrench className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{event.title}</span>
                      <Badge variant="outline" className={event.statusColor}>
                        {event.status}
                      </Badge>
                    </div>
                    {event.subtitle && (
                      <p className="text-sm text-muted-foreground truncate">{event.subtitle}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(event.date, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TimelineEventModal
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      />
    </div>
  );
}
