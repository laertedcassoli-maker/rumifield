import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Loader2, 
  ArrowLeft,
  Save,
  AlertTriangle,
  Clock,
  HelpCircle,
  CheckCircle,
  Sparkles,
  CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Lazy load map component to avoid SSR issues with Leaflet
const FarmMap = lazy(() => import('@/components/preventivas/FarmMap'));

const statusConfig = {
  sem_historico: { label: 'Sem Histórico', color: 'bg-muted text-muted-foreground', icon: HelpCircle, priority: 0 },
  atrasada: { label: 'Atrasada', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle, priority: 1 },
  elegivel: { label: 'Elegível', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock, priority: 2 },
  em_dia: { label: 'Em Dia', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle, priority: 3 },
};

interface ClientPreventive {
  client_id: string;
  client_name: string;
  fazenda: string | null;
  estado: string | null;
  consultor_rplus_id: string | null;
  consultor_name: string | null;
  preventive_frequency_days: number | null;
  last_preventive_date: string | null;
  days_until_due: number | null;
  preventive_status: string;
  suggested_reason?: string;
  latitude: number | null;
  longitude: number | null;
  link_maps: string | null;
}

type SortField = 'client_name' | 'estado' | 'consultor_name' | 'preventive_status' | 'days_until_due';
type SortDirection = 'asc' | 'desc';

export default function NovaRota() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    route_code: '',
    start_date: '',
    end_date: '',
    field_technician_user_id: '',
    checklist_template_id: '',
    notes: '',
  });
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  
  // Filters and sorting
  const [clientSearch, setClientSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [consultorFilter, setConsultorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statusAtRouteFilter, setStatusAtRouteFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('preventive_status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [highlightedClientId, setHighlightedClientId] = useState<string | null>(null);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Generate next route code
  const { data: nextRouteCode } = useQuery({
    queryKey: ['next-route-code'],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const prefix = `PREV-${year}-`;
      
      const { data } = await supabase
        .from('preventive_routes')
        .select('route_code')
        .like('route_code', `${prefix}%`)
        .order('route_code', { ascending: false })
        .limit(1);
      
      let nextNum = 1;
      if (data && data.length > 0) {
        const lastCode = data[0].route_code;
        const match = lastCode.match(/PREV-\d{4}-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1]) + 1;
        }
      }
      
      return `${prefix}${String(nextNum).padStart(5, '0')}`;
    },
  });

  // Set route code when loaded
  useEffect(() => {
    if (nextRouteCode && !form.route_code) {
      setForm(f => ({ ...f, route_code: nextRouteCode }));
    }
  }, [nextRouteCode]);

  // Fetch field technicians
  const { data: technicians } = useQuery({
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
        .eq('is_active', true);
      
      return profiles || [];
    },
  });

  // Fetch active checklist templates
  const { data: checklistTemplates } = useQuery({
    queryKey: ['active-checklist-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name, description')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch clients with preventive status
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients-for-route'],
    queryFn: async () => {
      // Fetch clients and consultors in parallel
      const [clientsResult, preventivesResult, consultorsResult] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nome, fazenda, estado, consultor_rplus_id, preventive_frequency_days, status, latitude, longitude, link_maps')
          .eq('status', 'ativo')
          .order('nome') as unknown as Promise<{ data: Array<{
            id: string;
            nome: string;
            fazenda: string | null;
            estado: string | null;
            consultor_rplus_id: string | null;
            preventive_frequency_days: number | null;
            status: string;
            latitude: number | null;
            longitude: number | null;
            link_maps: string | null;
          }> | null; error: any }>,
        supabase
          .from('preventive_maintenance' as any)
          .select('client_id, completed_date')
          .eq('status', 'concluida') as unknown as Promise<{ data: Array<{ client_id: string; completed_date: string | null }> | null; error: any }>,
        supabase
          .from('profiles')
          .select('id, nome')
      ]);
      
      if (clientsResult.error) throw clientsResult.error;
      if (preventivesResult.error) throw preventivesResult.error;

      const clients = clientsResult.data || [];
      const preventives = preventivesResult.data || [];
      const consultorsMap = new Map(consultorsResult.data?.map(p => [p.id, p.nome]) || []);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return clients.map(client => {
        const clientPreventives = preventives.filter(p => p.client_id === client.id);
        const lastPreventive = clientPreventives.length > 0 
          ? clientPreventives.reduce((max, p) => 
              new Date(p.completed_date!) > new Date(max.completed_date!) ? p : max
            )
          : null;

        const lastPreventiveDate = lastPreventive?.completed_date 
          ? new Date(lastPreventive.completed_date) 
          : null;
        
        let daysUntilDue: number | null = null;
        let status = 'sem_historico';
        let suggestedReason = '';

        if (lastPreventiveDate) {
          const daysSinceLast = Math.floor((today.getTime() - lastPreventiveDate.getTime()) / (1000 * 60 * 60 * 24));
          const frequency = client.preventive_frequency_days || 90;
          daysUntilDue = frequency - daysSinceLast;

          if (daysUntilDue < 0) {
            status = 'atrasada';
            suggestedReason = `Atrasada há ${Math.abs(daysUntilDue)} dias`;
          } else if (daysUntilDue <= 30) {
            status = 'elegivel';
            suggestedReason = `Vence em ${daysUntilDue} dias`;
          } else {
            status = 'em_dia';
          }
        } else {
          suggestedReason = 'Nunca realizou preventiva';
        }

        return {
          client_id: client.id,
          client_name: client.nome,
          fazenda: client.fazenda,
          estado: client.estado,
          consultor_rplus_id: client.consultor_rplus_id,
          consultor_name: client.consultor_rplus_id ? consultorsMap.get(client.consultor_rplus_id) || null : null,
          preventive_frequency_days: client.preventive_frequency_days,
          last_preventive_date: lastPreventive?.completed_date || null,
          days_until_due: daysUntilDue,
          preventive_status: status,
          suggested_reason: suggestedReason,
          latitude: client.latitude ? Number(client.latitude) : null,
          longitude: client.longitude ? Number(client.longitude) : null,
          link_maps: client.link_maps,
        } as ClientPreventive;
      });
    },
  });

  // Get unique estados and consultors for filters
  const uniqueEstados = useMemo(() => {
    if (!clientsData) return [];
    const estados = [...new Set(clientsData.map(c => c.estado).filter(Boolean))] as string[];
    return estados.sort();
  }, [clientsData]);

  const uniqueConsultors = useMemo(() => {
    if (!clientsData) return [];
    const consultors = [...new Set(clientsData
      .filter(c => c.consultor_name)
      .map(c => JSON.stringify({ id: c.consultor_rplus_id, name: c.consultor_name }))
    )].map(s => JSON.parse(s));
    return consultors.sort((a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name));
  }, [clientsData]);

  // Helper function to calculate projected status at route
  const getProjectedStatusAtRoute = (client: ClientPreventive) => {
    if (client.days_until_due === null || !form.start_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const routeStart = new Date(form.start_date + 'T00:00:00');
    const daysToRoute = Math.ceil((routeStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const daysAtRoute = client.days_until_due - daysToRoute;
    
    if (daysAtRoute < 0) return 'atrasada';
    if (daysAtRoute <= 30) return 'elegivel';
    return 'em_dia';
  };

  // Filter and sort clients
  const filteredAndSortedClients = useMemo(() => {
    if (!clientsData) return [];
    
    // Apply filters
    let result = clientsData.filter(client => {
      // Search filter (multi-word)
      if (clientSearch) {
        const searchWords = clientSearch.toLowerCase().split(' ').filter(Boolean);
        const searchText = `${client.client_name} ${client.fazenda || ''} ${client.estado || ''}`.toLowerCase();
        if (!searchWords.every(word => searchText.includes(word))) {
          return false;
        }
      }
      
      // Estado filter
      if (estadoFilter !== 'all' && client.estado !== estadoFilter) {
        return false;
      }
      
      // Consultor filter
      if (consultorFilter !== 'all' && client.consultor_rplus_id !== consultorFilter) {
        return false;
      }
      
      // Status filter (current)
      if (statusFilter !== 'all' && client.preventive_status !== statusFilter) {
        return false;
      }
      
      // Status at Route filter (projected)
      if (statusAtRouteFilter !== 'all') {
        // sem_historico clients don't have a projected status - exclude them
        if (client.preventive_status === 'sem_historico') {
          return false;
        }
        const projectedStatus = getProjectedStatusAtRoute(client);
        if (projectedStatus !== statusAtRouteFilter) {
          return false;
        }
      }
      
      return true;
    });
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'client_name':
          comparison = (a.client_name || '').localeCompare(b.client_name || '', 'pt-BR');
          break;
        case 'estado':
          comparison = (a.estado || 'ZZZ').localeCompare(b.estado || 'ZZZ', 'pt-BR');
          break;
        case 'consultor_name':
          comparison = (a.consultor_name || 'ZZZ').localeCompare(b.consultor_name || 'ZZZ', 'pt-BR');
          break;
        case 'preventive_status': {
          const aConfig = statusConfig[a.preventive_status as keyof typeof statusConfig];
          const bConfig = statusConfig[b.preventive_status as keyof typeof statusConfig];
          comparison = (aConfig?.priority ?? 99) - (bConfig?.priority ?? 99);
          break;
        }
        case 'days_until_due':
          comparison = (a.days_until_due ?? 9999) - (b.days_until_due ?? 9999);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [clientsData, clientSearch, estadoFilter, consultorFilter, statusFilter, statusAtRouteFilter, sortField, sortDirection, form.start_date]);

  // Suggested clients (sem_historico, atrasada, elegivel) - from filtered list
  const suggestedClients = useMemo(() => {
    return filteredAndSortedClients.filter(c => 
      c.preventive_status === 'sem_historico' || 
      c.preventive_status === 'atrasada' || 
      c.preventive_status === 'elegivel'
    );
  }, [filteredAndSortedClients]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const handleSelectSuggested = () => {
    const newSelected = new Set(selectedClients);
    suggestedClients.forEach(c => newSelected.add(c.client_id));
    setSelectedClients(newSelected);
  };

  const handleToggleClient = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedClients.size === filteredAndSortedClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredAndSortedClients.map(c => c.client_id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.route_code || !form.start_date || !form.end_date || !form.field_technician_user_id || !form.checklist_template_id) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios, incluindo o template de checklist.',
      });
      return;
    }

    if (selectedClients.size === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione fazendas',
        description: 'Adicione pelo menos uma fazenda à rota.',
      });
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      toast({
        variant: 'destructive',
        title: 'Datas inválidas',
        description: 'A data final deve ser posterior à data inicial.',
      });
      return;
    }

    setIsSaving(true);
    let createdRouteId: string | null = null;

    try {
      // Create route with status 'em_elaboracao'
      const { data: route, error: routeError } = await supabase
        .from('preventive_routes')
        .insert({
          route_code: form.route_code,
          start_date: form.start_date,
          end_date: form.end_date,
          field_technician_user_id: form.field_technician_user_id,
          checklist_template_id: form.checklist_template_id,
          notes: form.notes || null,
          created_by_user_id: user!.id,
          status: 'em_elaboracao',
        } as any)
        .select()
        .single();

      if (routeError) throw routeError;
      createdRouteId = route.id;

      // Create route items with order_index
      const selectedClientsArray = Array.from(selectedClients);
      const items = selectedClientsArray.map((clientId, index) => {
        const client = clientsData?.find(c => c.client_id === clientId);
        return {
          route_id: route.id,
          client_id: clientId,
          order_index: index,
          suggested_reason: client?.suggested_reason || null,
          status: 'planejado' as const,
        };
      });

      const { error: itemsError } = await supabase
        .from('preventive_route_items')
        .insert(items);

      if (itemsError) throw itemsError;

      toast({ title: 'Rota criada com sucesso! A rota está em elaboração.' });
      queryClient.invalidateQueries({ queryKey: ['preventive-routes'] });
      navigate(`/preventivas/rotas/${route.id}`);
    } catch (error: any) {
      // Se rota foi criada mas items falharam, limpar para permitir retry
      if (createdRouteId) {
        try {
          await supabase
            .from('preventive_routes')
            .delete()
            .eq('id', createdRouteId);
        } catch (cleanupError) {
          console.error('[NovaRota] Falha ao limpar rota órfã:', cleanupError);
        }
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao criar rota',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (!isAdminOrCoordinator) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Você não tem permissão para criar rotas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/preventivas/rotas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Rota Preventiva</h1>
          <p className="text-muted-foreground">Programe uma nova rota de manutenção</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Route Details */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Rota</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Código da Rota *</Label>
              <Input
                placeholder="Ex: Rota Preventiva 01"
                value={form.route_code}
                onChange={(e) => setForm({ ...form, route_code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: '' })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim *</Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.end_date && "text-muted-foreground"
                    )}
                    disabled={!form.start_date}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.end_date ? format(new Date(form.end_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : <span>Selecione</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.end_date ? new Date(form.end_date + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setForm({ ...form, end_date: format(date, 'yyyy-MM-dd') });
                        setEndDateOpen(false);
                      }
                    }}
                    defaultMonth={form.start_date ? new Date(form.start_date + 'T12:00:00') : undefined}
                    disabled={(date) => form.start_date ? date < new Date(form.start_date + 'T00:00:00') : false}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Técnico de Campo *</Label>
              <Select
                value={form.field_technician_user_id}
                onValueChange={(v) => setForm({ ...form, field_technician_user_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {technicians?.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Template de Checklist *</Label>
              <Select
                value={form.checklist_template_id}
                onValueChange={(v) => setForm({ ...form, checklist_template_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um checklist" />
                </SelectTrigger>
                <SelectContent>
                  {checklistTemplates?.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex flex-col">
                        <span>{t.name}</span>
                        {t.description && (
                          <span className="text-xs text-muted-foreground">{t.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {checklistTemplates?.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum template ativo. <Link to="/preventivas/checklists" className="text-primary underline">Criar template</Link>
                </p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-4">
              <Label>Observações</Label>
              <Textarea
                placeholder="Notas adicionais sobre a rota..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Client Selection */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Seleção de Fazendas</CardTitle>
                  <CardDescription>
                    {selectedClients.size} fazenda(s) selecionada(s) de {filteredAndSortedClients.length}
                    {suggestedClients.length > 0 && (
                      <span className="text-warning ml-2">
                        ({suggestedClients.length} sugerida(s))
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {suggestedClients.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={handleSelectSuggested}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Sugeridas
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectedClients.size === filteredAndSortedClients.length && filteredAndSortedClients.length > 0 ? 'Desmarcar' : 'Selecionar'} Todas
                  </Button>
                </div>
              </div>
              
              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar fazenda..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
                <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos UF</SelectItem>
                    {uniqueEstados.map(estado => (
                      <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={consultorFilter} onValueChange={setConsultorFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Consultor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Consultores</SelectItem>
                    {uniqueConsultors.map((c: {id: string, name: string}) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Status Atual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status Atual</SelectItem>
                    <SelectItem value="sem_historico">Sem Histórico</SelectItem>
                    <SelectItem value="atrasada">Atrasada</SelectItem>
                    <SelectItem value="elegivel">Elegível</SelectItem>
                    <SelectItem value="em_dia">Em Dia</SelectItem>
                  </SelectContent>
                </Select>
                <Select 
                  value={statusAtRouteFilter} 
                  onValueChange={setStatusAtRouteFilter}
                  disabled={!form.start_date}
                >
                  <SelectTrigger className={cn("h-9", !form.start_date && "opacity-50")}>
                    <SelectValue placeholder="Status na Rota" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status na Rota</SelectItem>
                    <SelectItem value="atrasada">Atrasada na Rota</SelectItem>
                    <SelectItem value="elegivel">Elegível na Rota</SelectItem>
                    <SelectItem value="em_dia">Em Dia na Rota</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!form.start_date && statusAtRouteFilter === 'all' && (
                <p className="text-xs text-muted-foreground">
                  💡 Defina a data inicial para habilitar o filtro "Status na Rota"
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredAndSortedClients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma fazenda encontrada com os filtros aplicados
              </div>
            ) : (
              <div className="max-h-[400px] overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('client_name')} className="h-auto p-0 font-medium hover:bg-transparent text-xs">
                          Fazenda {getSortIcon('client_name')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('estado')} className="h-auto p-0 font-medium hover:bg-transparent text-xs">
                          UF {getSortIcon('estado')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('consultor_name')} className="h-auto p-0 font-medium hover:bg-transparent text-xs">
                          Consultor R+ {getSortIcon('consultor_name')}
                        </Button>
                      </TableHead>
                      <TableHead className="text-center text-xs">Última Prev.</TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('days_until_due')} className="h-auto p-0 font-medium hover:bg-transparent text-xs">
                          Dias Restantes {getSortIcon('days_until_due')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('preventive_status')} className="h-auto p-0 font-medium hover:bg-transparent text-xs">
                          Status {getSortIcon('preventive_status')}
                        </Button>
                      </TableHead>
                      <TableHead className="text-center text-xs">
                        <span className="flex items-center justify-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          Dias na Rota
                        </span>
                      </TableHead>
                      <TableHead className="text-center text-xs">Status na Rota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedClients.map((client) => (
                      <TableRow 
                        key={client.client_id}
                        data-client-id={client.client_id}
                        className={cn(
                          selectedClients.has(client.client_id) && 'bg-primary/5',
                          highlightedClientId === client.client_id && 'ring-2 ring-primary',
                          'cursor-pointer hover:bg-muted/50'
                        )}
                        onClick={() => setHighlightedClientId(client.client_id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedClients.has(client.client_id)}
                            onCheckedChange={() => handleToggleClient(client.client_id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{client.client_name}</div>
                            {client.fazenda && (
                              <div className="text-xs text-muted-foreground">{client.fazenda}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {client.estado || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {client.consultor_name || '-'}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {client.last_preventive_date 
                            ? format(new Date(client.last_preventive_date + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {client.days_until_due !== null ? (
                            <span className={cn(
                              "text-sm font-medium",
                              client.days_until_due < 0 && "text-destructive",
                              client.days_until_due >= 0 && client.days_until_due <= 30 && "text-warning",
                              client.days_until_due > 30 && "text-green-600"
                            )}>
                              {client.days_until_due < 0 ? client.days_until_due : `+${client.days_until_due}`}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {renderStatusBadge(client.preventive_status)}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            if (client.days_until_due === null || !form.start_date) return '-';
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const routeStart = new Date(form.start_date + 'T00:00:00');
                            const daysToRoute = Math.ceil((routeStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            const daysAtRoute = client.days_until_due - daysToRoute;
                            
                            let colorClass = 'text-green-600';
                            if (daysAtRoute < 0) {
                              colorClass = 'text-destructive';
                            } else if (daysAtRoute <= 30) {
                              colorClass = 'text-warning';
                            }
                            
                            return (
                              <span className={cn("text-sm font-medium", colorClass)}>
                                {daysAtRoute < 0 ? daysAtRoute : `+${daysAtRoute}`}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            if (client.preventive_status === 'sem_historico') {
                              return <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Sem Histórico</Badge>;
                            }
                            if (client.days_until_due === null || !form.start_date) return '-';
                            
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const routeStart = new Date(form.start_date + 'T00:00:00');
                            const daysToRoute = Math.ceil((routeStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            const daysAtRoute = client.days_until_due - daysToRoute;
                            
                            if (daysAtRoute < 0) {
                              return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Atrasada</Badge>;
                            } else if (daysAtRoute <= 30) {
                              return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">Elegível</Badge>;
                            } else {
                              return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Em Dia</Badge>;
                            }
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Farm Map */}
        {!isLoading && filteredAndSortedClients.length > 0 && (
          <Suspense fallback={
            <Card>
              <CardContent className="h-[400px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          }>
            <FarmMap 
              clients={filteredAndSortedClients}
              highlightedClientId={highlightedClientId}
              onClientClick={(clientId) => {
                setHighlightedClientId(clientId);
                // Scroll to the table row
                const row = document.querySelector(`[data-client-id="${clientId}"]`);
                row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          </Suspense>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link to="/preventivas/rotas">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Criar Rota
          </Button>
        </div>
      </form>
    </div>
  );
}
