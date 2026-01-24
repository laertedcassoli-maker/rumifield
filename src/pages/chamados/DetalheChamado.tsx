import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, 
  Loader2, 
  Building2,
  User,
  Clock,
  AlertTriangle,
  Package,
  CheckCircle,
  XCircle,
  MapPin,
  Plus,
  Eye,
  CalendarPlus,
  MessageSquare,
  History,
  ShoppingCart,
  Phone,
  FileText,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TicketPartsRequestPanel from '@/components/chamados/TicketPartsRequestPanel';
import NovaVisitaDialog from '@/components/chamados/NovaVisitaDialog';
import NovaInteracaoDialog from '@/components/chamados/NovaInteracaoDialog';

// Interaction type config
const interactionTypeConfig = {
  system: { icon: Settings, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  call: { icon: Phone, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  message: { icon: MessageSquare, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  waiting: { icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  note: { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
};

const statusConfig = {
  aberto: { label: 'Aberto', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock },
  em_atendimento: { label: 'Em Atendimento', color: 'bg-warning/10 text-warning border-warning/20', icon: AlertTriangle },
  aguardando_peca: { label: 'Aguardando Peça', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: Package },
  resolvido: { label: 'Resolvido', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle },
  cancelado: { label: 'Cancelado', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

const priorityConfig = {
  baixa: { label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  media: { label: 'Média', color: 'bg-blue-500/10 text-blue-600' },
  alta: { label: 'Alta', color: 'bg-warning/10 text-warning' },
  urgente: { label: 'Urgente', color: 'bg-destructive/10 text-destructive' },
};

const visitStatusConfig = {
  em_elaboracao: { label: 'Em Elaboração', color: 'bg-slate-500/10 text-slate-600' },
  planejada: { label: 'Planejada', color: 'bg-blue-500/10 text-blue-600' },
  em_execucao: { label: 'Em Execução', color: 'bg-warning/10 text-warning' },
  finalizada: { label: 'Finalizada', color: 'bg-green-500/10 text-green-600' },
  cancelada: { label: 'Cancelada', color: 'bg-muted text-muted-foreground' },
};

export default function DetalheChamado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showPartsPanel, setShowPartsPanel] = useState(false);
  const [showNovaVisita, setShowNovaVisita] = useState(false);
  const [showNovaInteracao, setShowNovaInteracao] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch ticket details
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technical_tickets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch client
  const { data: client } = useQuery({
    queryKey: ['ticket-client', ticket?.client_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado, link_maps')
        .eq('id', ticket!.client_id)
        .single();
      return data;
    },
    enabled: !!ticket?.client_id,
  });

  // Fetch assigned technician
  const { data: technician } = useQuery({
    queryKey: ['ticket-technician', ticket?.assigned_technician_id],
    queryFn: async () => {
      if (!ticket?.assigned_technician_id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('id', ticket.assigned_technician_id)
        .single();
      return data;
    },
    enabled: !!ticket?.assigned_technician_id,
  });

  // Fetch visits
  const { data: visits } = useQuery({
    queryKey: ['ticket-visits', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_visits')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Fetch technician names
      const techIds = [...new Set(data?.map(v => v.field_technician_user_id))] as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', techIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.id, p.nome]) || []);

      return data?.map(v => ({
        ...v,
        technician_name: profilesMap.get(v.field_technician_user_id) || 'Desconhecido',
      })) || [];
    },
    enabled: !!id,
  });

  // Fetch parts requests linked to ticket
  const { data: partsRequests } = useQuery({
    queryKey: ['ticket-parts-requests', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_parts_requests')
        .select(`
          id,
          pedido_id,
          created_at,
          pedidos!inner(
            id,
            status,
            cliente_id,
            created_at,
            pedido_itens(
              id,
              quantidade,
              pecas(codigo, nome)
            )
          )
        `)
        .eq('ticket_id', id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch timeline
  const { data: timeline } = useQuery({
    queryKey: ['ticket-timeline', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_timeline')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      const userIds = [...new Set(data?.map(t => t.user_id))] as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', userIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.id, p.nome]) || []);

      return data?.map(t => ({
        ...t,
        user_name: profilesMap.get(t.user_id) || 'Usuário',
      })) || [];
    },
    enabled: !!id,
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const updates: any = { status: newStatus };
      
      if (newStatus === 'resolvido') {
        updates.resolution_summary = resolutionSummary || null;
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by_user_id = user!.id;
      }

      const { error } = await supabase
        .from('technical_tickets')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;

      // Add timeline entry
      await supabase.from('ticket_timeline').insert({
        ticket_id: id,
        user_id: user!.id,
        event_type: 'status_changed',
        event_description: `Status alterado para: ${statusConfig[newStatus as keyof typeof statusConfig]?.label || newStatus}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['ticket-timeline', id] });
      toast({ title: 'Status atualizado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  // Update technician mutation
  const updateTechnician = useMutation({
    mutationFn: async (technicianId: string) => {
      const { error } = await supabase
        .from('technical_tickets')
        .update({ assigned_technician_id: technicianId || null })
        .eq('id', id);
      
      if (error) throw error;

      await supabase.from('ticket_timeline').insert({
        ticket_id: id,
        user_id: user!.id,
        event_type: 'technician_assigned',
        event_description: technicianId 
          ? 'Técnico de campo atribuído' 
          : 'Técnico de campo removido',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['ticket-timeline', id] });
      toast({ title: 'Técnico atualizado!' });
    },
  });

  // Fetch available technicians for assignment
  const { data: availableTechnicians } = useQuery({
    queryKey: ['field-technicians'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'tecnico_campo');
      
      if (!roles?.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', roles.map(r => r.user_id))
        .order('nome');
      
      return profiles || [];
    },
    enabled: isAdminOrCoordinator,
  });

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} text-base px-3 py-1`}>
        <Icon className="mr-1 h-4 w-4" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Chamado não encontrado</h2>
        <Button className="mt-4" asChild>
          <Link to="/chamados">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/chamados">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{ticket.ticket_code}</h1>
              {renderStatusBadge(ticket.status)}
            </div>
            <p className="text-muted-foreground">{ticket.title}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPartsPanel(true)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Solicitar Peças
          </Button>
          {isAdminOrCoordinator && (
            <Button onClick={() => setShowNovaVisita(true)}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Agendar Visita
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem Description */}
          <Card>
            <CardHeader>
              <CardTitle>Descrição do Problema</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{ticket.description || 'Sem descrição detalhada.'}</p>
            </CardContent>
          </Card>

          {/* Visits */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Visitas Corretivas</CardTitle>
                <CardDescription>{visits?.length || 0} visita(s) registrada(s)</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {visits?.length ? (
                <div className="space-y-3">
                  {visits.map(visit => (
                    <div 
                      key={visit.id} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium">{visit.technician_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {visit.planned_start_date 
                              ? format(new Date(visit.planned_start_date), "dd/MM/yyyy", { locale: ptBR })
                              : 'Data não definida'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={visitStatusConfig[visit.status as keyof typeof visitStatusConfig]?.color}>
                          {visitStatusConfig[visit.status as keyof typeof visitStatusConfig]?.label}
                        </Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/chamados/visita/${visit.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <CalendarPlus className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>Nenhuma visita agendada</p>
                  {isAdminOrCoordinator && (
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowNovaVisita(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Agendar Visita
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parts Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Solicitações de Peças
              </CardTitle>
            </CardHeader>
            <CardContent>
              {partsRequests?.length ? (
                <div className="space-y-3">
                  {partsRequests.map(pr => (
                    <div key={pr.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(pr.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                        <Badge variant="outline">
                          {(pr.pedidos as any)?.status || 'Pendente'}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {(pr.pedidos as any)?.pedido_itens?.map((item: any) => (
                          <div key={item.id} className="text-sm flex items-center gap-2">
                            <span className="font-mono text-xs bg-muted px-1 rounded">
                              {item.pecas?.codigo}
                            </span>
                            <span>{item.pecas?.nome}</span>
                            <span className="text-muted-foreground">×{item.quantidade}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>Nenhuma solicitação de peças</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowPartsPanel(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Solicitar Peças
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline / Interações */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico e Interações
                </CardTitle>
                <CardDescription>
                  Registro cronológico de eventos e interações
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowNovaInteracao(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Interação
              </Button>
            </CardHeader>
            <CardContent>
              {timeline?.length ? (
                <div className="space-y-4">
                  {timeline.map((entry, index) => {
                    const typeConfig = interactionTypeConfig[(entry.interaction_type as keyof typeof interactionTypeConfig) || 'system'] || interactionTypeConfig.system;
                    const Icon = typeConfig.icon;
                    const isManualInteraction = entry.interaction_type && entry.interaction_type !== 'system';
                    
                    return (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${typeConfig.bgColor}`}>
                            <Icon className={`h-4 w-4 ${typeConfig.color}`} />
                          </div>
                          {index < timeline.length - 1 && (
                            <div className="w-px flex-1 bg-border min-h-[16px]" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          {isManualInteraction && entry.notes ? (
                            <>
                              <p className="text-sm font-medium">{entry.event_description}</p>
                              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{entry.notes}</p>
                            </>
                          ) : (
                            <p className="text-sm">{entry.event_description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {entry.user_name} • {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>Nenhum evento registrado</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowNovaInteracao(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Interação
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="font-medium">{client?.nome}</div>
                {client?.fazenda && (
                  <div className="text-sm text-muted-foreground">{client.fazenda}</div>
                )}
              </div>
              {(client?.cidade || client?.estado) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {[client.cidade, client.estado].filter(Boolean).join(' - ')}
                </div>
              )}
              {client?.link_maps && (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <a href={client.link_maps} target="_blank" rel="noopener noreferrer">
                    <MapPin className="mr-2 h-4 w-4" />
                    Ver no Maps
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Status & Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Priority */}
              <div>
                <div className="text-sm font-medium mb-2">Prioridade</div>
                <Badge 
                  variant="outline" 
                  className={priorityConfig[ticket.priority as keyof typeof priorityConfig]?.color}
                >
                  {priorityConfig[ticket.priority as keyof typeof priorityConfig]?.label}
                </Badge>
              </div>

              <Separator />

              {/* Status */}
              {isAdminOrCoordinator && ticket.status !== 'resolvido' && ticket.status !== 'cancelado' && (
                <div>
                  <div className="text-sm font-medium mb-2">Alterar Status</div>
                  <Select 
                    value={ticket.status} 
                    onValueChange={(v) => updateStatus.mutate(v)}
                    disabled={updateStatus.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                      <SelectItem value="aguardando_peca">Aguardando Peça</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Resolve */}
              {isAdminOrCoordinator && ticket.status !== 'resolvido' && ticket.status !== 'cancelado' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" variant="default">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Marcar como Resolvido
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Resolver Chamado</AlertDialogTitle>
                      <AlertDialogDescription>
                        Descreva a resolução do problema antes de fechar o chamado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Resumo da resolução..."
                      rows={4}
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => updateStatus.mutate('resolvido')}>
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <Separator />

              {/* Technician Assignment */}
              {isAdminOrCoordinator && (
                <div>
                  <div className="text-sm font-medium mb-2">Técnico de Campo</div>
                  <Select 
                    value={ticket.assigned_technician_id || ''} 
                    onValueChange={(v) => updateTechnician.mutate(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTechnicians?.map(tech => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!isAdminOrCoordinator && technician && (
                <div>
                  <div className="text-sm font-medium mb-2">Técnico Responsável</div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{technician.nome}</span>
                  </div>
                </div>
              )}

              {/* Resolution Summary */}
              {ticket.status === 'resolvido' && ticket.resolution_summary && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm font-medium mb-2">Resolução</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {ticket.resolution_summary}
                    </p>
                    {ticket.resolved_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Resolvido em {format(new Date(ticket.resolved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardContent className="pt-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span>{format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última atualização</span>
                <span>{format(new Date(ticket.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Parts Request Panel */}
      <TicketPartsRequestPanel
        open={showPartsPanel}
        onOpenChange={setShowPartsPanel}
        ticketId={id!}
        clientId={ticket.client_id}
      />

      {/* Nova Visita Dialog */}
      <NovaVisitaDialog
        open={showNovaVisita}
        onOpenChange={setShowNovaVisita}
        ticketId={id!}
        clientId={ticket.client_id}
      />

      {/* Nova Interação Dialog */}
      <NovaInteracaoDialog
        open={showNovaInteracao}
        onOpenChange={setShowNovaInteracao}
        ticketId={id!}
      />
    </div>
  );
}
