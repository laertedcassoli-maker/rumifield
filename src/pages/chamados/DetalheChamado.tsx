import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, 
  Loader2, 
  Building2,
  User,
  Clock,
  MapPin,
  Plus,
  Eye,
  Truck,
  CalendarPlus,
  MessageSquare,
  History,
  ShoppingCart,
  Phone,
  FileText,
  Settings,
  Package,
  CheckCircle2,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Helper function to calculate duration in days
const calculateDurationDays = (createdAt: string, resolvedAt?: string | null): number => {
  const startDate = new Date(createdAt);
  const endDate = resolvedAt ? new Date(resolvedAt) : new Date();
  return differenceInDays(endDate, startDate);
};
import TicketPartsRequestPanel from '@/components/chamados/TicketPartsRequestPanel';
import NovaVisitaDialog from '@/components/chamados/NovaVisitaDialog';
import NovaInteracaoDialog from '@/components/chamados/NovaInteracaoDialog';
import TicketStatusStepper from '@/components/chamados/TicketStatusStepper';
import FinalizarChamadoDialog from '@/components/chamados/FinalizarChamadoDialog';

// Interaction type config
const interactionTypeConfig = {
  system: { icon: Settings, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  call: { icon: Phone, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  message: { icon: MessageSquare, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  waiting: { icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  note: { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  visit: { icon: Truck, color: 'text-white', bgColor: 'bg-indigo-600 dark:bg-indigo-500' },
};

const statusConfig = {
  aberto: { label: 'Aberto', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  em_atendimento: { label: 'Em Atendimento', color: 'bg-warning/10 text-warning border-warning/20' },
  resolvido: { label: 'Resolvido', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  cancelado: { label: 'Cancelado', color: 'bg-muted text-muted-foreground' },
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
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();

  const [showPartsPanel, setShowPartsPanel] = useState(false);
  const [showNovaVisita, setShowNovaVisita] = useState(false);
  const [showNovaInteracao, setShowNovaInteracao] = useState(false);
  const [showFinalizar, setShowFinalizar] = useState(false);

  // Inline editing states
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editingPriority, setEditingPriority] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (location.state?.openVisita) {
      setShowNovaVisita(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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

  const isEditable = ticket?.status === 'aberto' || ticket?.status === 'em_atendimento';

  // Fetch all active tags for editing
  const { data: allActiveTags } = useQuery({
    queryKey: ['ticket-tags-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_tags')
        .select('*')
        .eq('is_active', true)
        .order('order_index')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: editingTags,
  });

  // Update description mutation
  const updateDescription = useMutation({
    mutationFn: async (newDescription: string) => {
      const { error } = await supabase
        .from('technical_tickets')
        .update({ description: newDescription })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', id] });
      setEditingDescription(false);
      toast({ title: 'Descrição atualizada!' });
    },
  });

  // Update priority mutation
  const updatePriority = useMutation({
    mutationFn: async (newPriority: string) => {
      const { error } = await supabase
        .from('technical_tickets')
        .update({ priority: newPriority as any })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', id] });
      setEditingPriority(false);
      toast({ title: 'Prioridade atualizada!' });
    },
  });

  // Update tags mutation (diff pattern: insert missing, delete removed)
  const updateTags = useMutation({
    mutationFn: async (tagIds: string[]) => {
      // 1. Fetch current tag links
      const { data: currentLinks, error: fetchError } = await supabase
        .from('ticket_tag_links')
        .select('tag_id')
        .eq('ticket_id', id!);
      if (fetchError) throw fetchError;

      const currentIds = (currentLinks || []).map(l => l.tag_id);

      // 2. Compute diffs
      const toAdd = tagIds.filter(t => !currentIds.includes(t));
      const toRemove = currentIds.filter(t => !tagIds.includes(t));

      // 3. Insert new links (if any)
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('ticket_tag_links')
          .insert(toAdd.map(tag_id => ({ ticket_id: id!, tag_id })));
        if (addError) throw addError;
      }

      // 4. Remove obsolete links (if any)
      if (toRemove.length > 0) {
        const { error: remError } = await supabase
          .from('ticket_tag_links')
          .delete()
          .eq('ticket_id', id!)
          .in('tag_id', toRemove);
        if (remError) throw remError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-tags', id] });
      setEditingTags(false);
      toast({ title: 'Tags atualizadas!' });
    },
  });
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

  // Fetch category
  const { data: category } = useQuery({
    queryKey: ['ticket-category', (ticket as any)?.category_id],
    queryFn: async () => {
      if (!(ticket as any)?.category_id) return null;
      const { data } = await supabase
        .from('ticket_categories')
        .select('id, name, color, icon')
        .eq('id', (ticket as any).category_id)
        .single();
      return data;
    },
    enabled: !!(ticket as any)?.category_id,
  });

  // Fetch ticket tags
  const { data: ticketTags } = useQuery({
    queryKey: ['ticket-tags', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_tag_links')
        .select('tag_id, ticket_tags(id, name, color)')
        .eq('ticket_id', id!);
      if (error) throw error;
      return data?.map(d => (d as any).ticket_tags).filter(Boolean) || [];
    },
    enabled: !!id,
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

  // Fetch timeline and merge with visits
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

      // Get visits to merge into timeline
      const visitsForTimeline = visits?.map(v => ({
        id: `visit-${v.id}`,
        created_at: v.created_at,
        event_type: 'visit',
        event_description: '',
        interaction_type: 'visit' as const,
        notes: null,
        user_id: v.field_technician_user_id,
        user_name: v.technician_name,
        ticket_id: id,
        metadata: null,
        visit_data: v,
      })) || [];

      const timelineWithNames = data?.map(t => ({
        ...t,
        user_name: profilesMap.get(t.user_id) || 'Usuário',
        visit_data: null as any,
      })) || [];

      // Merge and sort by created_at descending
      const merged = [...timelineWithNames, ...visitsForTimeline].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return merged;
    },
    enabled: !!id && visits !== undefined,
  });

  // Update technician mutation
  const updateTechnician = useMutation({
    mutationFn: async (technicianId: string) => {
      const { error } = await supabase
        .from('technical_tickets')
        .update({ assigned_technician_id: technicianId || null })
        .eq('id', id);
      
      if (error) throw error;

      const { error: tlError } = await supabase.from('ticket_timeline').insert({
        ticket_id: id,
        user_id: user!.id,
        event_type: 'technician_assigned',
        event_description: technicianId 
          ? 'Técnico de campo atribuído' 
          : 'Técnico de campo removido',
      });
      if (tlError) console.error('[DetalheChamado] Timeline insert failed:', tlError);
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
    return (
      <Badge variant="outline" className={`${config.color} text-base px-3 py-1`}>
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
            <h1 className="text-2xl font-bold">{ticket.ticket_code}</h1>
            {/* Duration Badge */}
            {(() => {
              const days = calculateDurationDays(ticket.created_at, ticket.resolved_at);
              const isResolved = ticket.status === 'resolvido' || ticket.status === 'cancelado';
              return (
                <div className={`flex items-center gap-1.5 mt-1 ${days > 7 && !isResolved ? 'text-warning' : days > 14 && !isResolved ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-sm">
                    {isResolved ? 'Duração: ' : 'Aberto há '}
                    {days === 0 ? 'hoje' : days === 1 ? '1 dia' : `${days} dias`}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
        
        <div className="flex gap-2">
          {ticket.status !== 'resolvido' && ticket.status !== 'cancelado' && (
            <Button variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowFinalizar(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Finalizar Chamado
            </Button>
          )}
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

      {/* Status Stepper */}
      <TicketStatusStepper 
        currentStatus={ticket.status} 
        createdAt={ticket.created_at}
        updatedAt={ticket.updated_at}
        resolvedAt={ticket.resolved_at}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem Description */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle>Descrição do Problema</CardTitle>
              {isEditable && !editingDescription && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                  setEditDescription(ticket.description || '');
                  setEditingDescription(true);
                }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-base font-medium text-foreground">{ticket.title}</p>
              {editingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditingDescription(false)}>
                      <X className="mr-1 h-3.5 w-3.5" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={() => updateDescription.mutate(editDescription)} disabled={updateDescription.isPending}>
                      {updateDescription.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : ticket.description ? (
                <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Sem descrição detalhada.</p>
              )}
            </CardContent>
          </Card>

          {/* Timeline / Interações - Movido para cima */}
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
                    const isVisit = entry.interaction_type === 'visit' && entry.visit_data;
                    const typeConfig = interactionTypeConfig[(entry.interaction_type as keyof typeof interactionTypeConfig) || 'system'] || interactionTypeConfig.system;
                    const Icon = typeConfig.icon;
                    const isManualInteraction = entry.interaction_type && entry.interaction_type !== 'system' && !isVisit;
                    
                    return (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`${isVisit ? 'h-10 w-10' : 'h-8 w-8'} rounded-full flex items-center justify-center ${typeConfig.bgColor} ${isVisit ? 'shadow-md ring-2 ring-indigo-200 dark:ring-indigo-800' : ''}`}>
                            <Icon className={`${isVisit ? 'h-5 w-5' : 'h-4 w-4'} ${typeConfig.color}`} />
                          </div>
                          {index < timeline.length - 1 && (
                            <div className="w-px flex-1 bg-border min-h-[16px]" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          {isVisit && entry.visit_data ? (
                            /* Visit Card Expandido */
                            <div className="border-2 border-indigo-200 dark:border-indigo-800 rounded-lg p-4 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-background shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium text-sm">
                                  Visita Técnica
                                  {entry.visit_data.visit_code && (
                                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                                      {entry.visit_data.visit_code}
                                    </span>
                                  )}
                                </div>
                                <Badge variant="outline" className={`text-xs ${visitStatusConfig[entry.visit_data.status as keyof typeof visitStatusConfig]?.color}`}>
                                  {visitStatusConfig[entry.visit_data.status as keyof typeof visitStatusConfig]?.label}
                                </Badge>
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{entry.visit_data.technician_name}</span>
                                </div>
                                {entry.visit_data.planned_start_date && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>
                                      Planejada: {format(new Date(entry.visit_data.planned_start_date), "dd/MM/yyyy", { locale: ptBR })}
                                    </span>
                                  </div>
                                )}
                                {entry.visit_data.checkin_at && (
                                  <div className="flex items-center gap-2 text-green-600">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span>
                                      Check-in: {format(new Date(entry.visit_data.checkin_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </span>
                                  </div>
                                )}
                                {entry.visit_data.checkout_at && (
                                  <div className="flex items-center gap-2 text-blue-600">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span>
                                      Check-out: {format(new Date(entry.visit_data.checkout_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </span>
                                  </div>
                                )}
                                {entry.visit_data.result && (
                                  <div className="mt-2 pt-2 border-t">
                                    <Badge variant="outline" className={
                                      entry.visit_data.result === 'resolvido' ? 'bg-green-500/10 text-green-600' :
                                      entry.visit_data.result === 'pendente' ? 'bg-warning/10 text-warning' :
                                      'bg-muted text-muted-foreground'
                                    }>
                                      {entry.visit_data.result === 'resolvido' && 'Problema Resolvido'}
                                      {entry.visit_data.result === 'pendente' && 'Pendente'}
                                      {entry.visit_data.result === 'requer_retorno' && 'Requer Retorno'}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end mt-2">
                                <Button variant="ghost" size="sm" asChild>
                                  <Link to={`/chamados/visita/${entry.visit_data.id}`}>
                                    <Eye className="mr-1 h-3.5 w-3.5" />
                                    Ver detalhes
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          ) : isManualInteraction && entry.notes ? (
                            <>
                              <p className="text-sm font-medium">{entry.event_description}</p>
                              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{entry.notes}</p>
                            </>
                          ) : (
                            <p className="text-sm">{entry.event_description}</p>
                          )}
                          {!isVisit && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {entry.user_name} • {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          )}
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
                        <div className="flex items-center gap-2">
                          {(pr.pedidos as any)?.pedido_code && (
                            <span className="font-mono font-bold text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {(pr.pedidos as any).pedido_code}
                            </span>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(pr.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
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

          {/* Gerenciamento */}
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Products */}
              {(ticket as any).products?.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Produtos</div>
                  <div className="flex flex-wrap gap-1">
                    {(ticket as any).products.map((product: string) => (
                      <Badge key={product} variant="secondary" className="text-xs">
                        {product === 'rumiflow' && 'RumiFlow'}
                        {product === 'rumiprocare' && 'RumiProcare'}
                        {product === 'rumiaction' && 'RumiAction'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Category */}
              {category && (
                <div>
                  <div className="text-sm font-medium mb-2">Categoria</div>
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    style={{ borderColor: category.color, color: category.color }}
                  >
                    {category.name}
                  </Badge>
                </div>
              )}

              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Tags</span>
                  {isEditable && !editingTags && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                      setSelectedTagIds(ticketTags?.map((t: any) => t.id) || []);
                      setEditingTags(true);
                    }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {editingTags ? (
                  <div className="space-y-2">
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {allActiveTags?.map(tag => (
                        <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={selectedTagIds.includes(tag.id)}
                            onCheckedChange={(checked) => {
                              setSelectedTagIds(prev =>
                                checked ? [...prev, tag.id] : prev.filter(id => id !== tag.id)
                              );
                            }}
                          />
                          <Badge variant="outline" className="text-xs" style={{ borderColor: tag.color, color: tag.color }}>
                            {tag.name}
                          </Badge>
                        </label>
                      ))}
                      {!allActiveTags?.length && <p className="text-xs text-muted-foreground">Nenhuma tag ativa.</p>}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setEditingTags(false)}>
                        <X className="mr-1 h-3.5 w-3.5" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={() => updateTags.mutate(selectedTagIds)} disabled={updateTags.isPending}>
                        {updateTags.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : ticketTags && ticketTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {ticketTags.map((tag: any) => (
                      <Badge key={tag.id} variant="outline" className="text-xs" style={{ borderColor: tag.color, color: tag.color }}>
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhuma tag.</p>
                )}
              </div>

              {/* Priority */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Prioridade</span>
                  {isEditable && !editingPriority && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingPriority(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {editingPriority ? (
                  <Select
                    value={ticket.priority}
                    onValueChange={(v) => updatePriority.mutate(v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge 
                    variant="outline" 
                    className={priorityConfig[ticket.priority as keyof typeof priorityConfig]?.color}
                  >
                    {priorityConfig[ticket.priority as keyof typeof priorityConfig]?.label}
                  </Badge>
                )}
              </div>

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

      {/* Finalizar Chamado Dialog */}
      <FinalizarChamadoDialog
        open={showFinalizar}
        onOpenChange={setShowFinalizar}
        ticketId={id!}
      />
    </div>
  );
}
