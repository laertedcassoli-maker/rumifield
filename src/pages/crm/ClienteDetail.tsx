import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  Phone, 
  Mail, 
  ArrowLeft,
  AlertTriangle,
  Wrench,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TimelineEventModal } from '@/components/crm/TimelineEventModal';

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

export default function ClienteDetail() {
  const { id } = useParams<{ id: string }>();
  const [filterType, setFilterType] = useState<EventType | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ['cliente-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch chamados
  const { data: chamados = [] } = useQuery({
    queryKey: ['cliente-chamados', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technical_tickets')
        .select('id, ticket_code, title, status, priority, created_at')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch preventivas
  const { data: preventivas = [] } = useQuery({
    queryKey: ['cliente-preventivas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_maintenance')
        .select('id, scheduled_date, completed_date, status, public_token')
        .eq('client_id', id)
        .order('scheduled_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch visitas corretivas with corrective_maintenance public_token
  const { data: corretivas = [] } = useQuery({
    queryKey: ['cliente-corretivas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_visits')
        .select(`
          id, 
          visit_code, 
          status, 
          planned_start_date, 
          checkin_at,
          technical_tickets!inner(client_id, title),
          corrective_maintenance(public_token)
        `)
        .eq('technical_tickets.client_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Build unified timeline
  const timeline: TimelineEvent[] = [
    ...chamados.map((c): TimelineEvent => ({
      id: c.id,
      type: 'chamado',
      title: `Chamado ${c.ticket_code}`,
      subtitle: c.title,
      date: new Date(c.created_at),
      status: getStatusLabel(c.status, 'chamado'),
      statusColor: getStatusColor(c.status, 'chamado'),
      link: `/chamados/${c.id}`,
    })),
    ...preventivas.map((p): TimelineEvent => ({
      id: p.id,
      type: 'preventiva',
      title: 'Preventiva',
      subtitle: p.completed_date 
        ? `Concluída em ${format(new Date(p.completed_date), 'dd/MM/yyyy')}`
        : `Agendada para ${format(new Date(p.scheduled_date), 'dd/MM/yyyy')}`,
      date: new Date(p.completed_date || p.scheduled_date),
      status: getStatusLabel(p.status, 'preventiva'),
      statusColor: getStatusColor(p.status, 'preventiva'),
      link: p.public_token ? `/relatorio/${p.public_token}` : undefined,
    })),
    ...corretivas.map((v): TimelineEvent => {
      // Get public_token from corrective_maintenance relation (1:1)
      const cmData = v.corrective_maintenance as { public_token: string | null } | null;
      const publicToken = cmData?.public_token;
      
      return {
        id: v.id,
        type: 'corretiva',
        title: `Visita ${v.visit_code}`,
        subtitle: (v.technical_tickets as any)?.title,
        date: new Date(v.checkin_at || v.planned_start_date || new Date()),
        status: getStatusLabel(v.status, 'corretiva'),
        statusColor: getStatusColor(v.status, 'corretiva'),
        link: publicToken 
          ? `/relatorio-corretivo/${publicToken}` 
          : `/chamados/visita/${v.id}`,
      };
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Filter timeline based on selected type
  const filteredTimeline = filterType 
    ? timeline.filter(e => e.type === filterType)
    : timeline;

  const toggleFilter = (type: EventType) => {
    setFilterType(prev => prev === type ? null : type);
  };

  if (loadingCliente) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Link to="/clientes">
          <Button variant="link">Voltar para lista</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/clientes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{cliente.nome}</h1>
          {cliente.fazenda && (
            <p className="text-muted-foreground">{cliente.fazenda}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4 mt-4">
          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Informações de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cliente.cidade && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {cliente.endereco && `${cliente.endereco}, `}
                    {cliente.cidade}
                    {cliente.estado && `, ${cliente.estado}`}
                  </span>
                </div>
              )}
              {cliente.telefone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${cliente.telefone}`} className="text-primary hover:underline">
                    {cliente.telefone}
                  </a>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${cliente.email}`} className="text-primary hover:underline">
                    {cliente.email}
                  </a>
                </div>
              )}
              {cliente.link_maps && (
                <div className="flex items-center gap-2 text-sm">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={cliente.link_maps} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Ver no Google Maps
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Farm Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalhes da Fazenda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {cliente.ordenhas_dia && (
                  <div>
                    <span className="text-muted-foreground">Ordenhas/dia:</span>
                    <span className="ml-2 font-medium">{cliente.ordenhas_dia}x</span>
                  </div>
                )}
                {cliente.quantidade_pistolas && (
                  <div>
                    <span className="text-muted-foreground">Pistolas:</span>
                    <span className="ml-2 font-medium">{cliente.quantidade_pistolas}</span>
                  </div>
                )}
                {cliente.tipo_painel && (
                  <div>
                    <span className="text-muted-foreground">Painel:</span>
                    <span className="ml-2 font-medium">{cliente.tipo_painel}</span>
                  </div>
                )}
                {cliente.modelo_contrato && (
                  <div>
                    <span className="text-muted-foreground">Contrato:</span>
                    <span className="ml-2 font-medium">{cliente.modelo_contrato}</span>
                  </div>
                )}
                {cliente.preventive_frequency_days && (
                  <div>
                    <span className="text-muted-foreground">Freq. Preventiva:</span>
                    <span className="ml-2 font-medium">{cliente.preventive_frequency_days} dias</span>
                  </div>
                )}
              </div>
              {cliente.observacoes && (
                <div className="mt-4 pt-4 border-t">
                  <span className="text-muted-foreground text-sm">Observações:</span>
                  <p className="mt-1 text-sm">{cliente.observacoes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          {/* Summary Cards - Clickable Filters */}
          <div className="grid grid-cols-3 gap-2 mb-4">
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
            <div className="flex items-center justify-between mb-3 px-1">
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
                      {/* Icon */}
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

                      {/* Content */}
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
        </TabsContent>
      </Tabs>

      <TimelineEventModal
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      />
    </div>
  );
}

function getStatusLabel(status: string, type: 'chamado' | 'preventiva' | 'corretiva'): string {
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

function getStatusColor(status: string, type: string): string {
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
