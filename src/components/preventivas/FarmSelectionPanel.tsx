import { useState, useMemo, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Lazy load map component
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

interface FarmSelectionPanelProps {
  excludedClientIds?: string[];
  routeStartDate?: string;
  onConfirm: (clientIds: string[]) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function FarmSelectionPanel({
  excludedClientIds = [],
  routeStartDate,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: FarmSelectionPanelProps) {
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  
  // Filters and sorting
  const [clientSearch, setClientSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [consultorFilter, setConsultorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statusAtRouteFilter, setStatusAtRouteFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('preventive_status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [highlightedClientId, setHighlightedClientId] = useState<string | null>(null);

  // Fetch clients with preventive status
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients-for-farm-selection', excludedClientIds],
    queryFn: async () => {
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

      const clients = (clientsResult.data || []).filter(c => !excludedClientIds.includes(c.id));
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
    if (client.days_until_due === null || !routeStartDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const routeStart = new Date(routeStartDate + 'T00:00:00');
    const daysToRoute = Math.ceil((routeStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const daysAtRoute = client.days_until_due - daysToRoute;
    
    if (daysAtRoute < 0) return 'atrasada';
    if (daysAtRoute <= 30) return 'elegivel';
    return 'em_dia';
  };

  // Filter and sort clients
  const filteredAndSortedClients = useMemo(() => {
    if (!clientsData) return [];
    
    let result = clientsData.filter(client => {
      // Search filter (multi-word)
      if (clientSearch) {
        const searchWords = clientSearch.toLowerCase().split(' ').filter(Boolean);
        const searchText = `${client.client_name} ${client.fazenda || ''} ${client.estado || ''}`.toLowerCase();
        if (!searchWords.every(word => searchText.includes(word))) {
          return false;
        }
      }
      
      if (estadoFilter !== 'all' && client.estado !== estadoFilter) return false;
      if (consultorFilter !== 'all' && client.consultor_rplus_id !== consultorFilter) return false;
      if (statusFilter !== 'all' && client.preventive_status !== statusFilter) return false;
      
      if (statusAtRouteFilter !== 'all') {
        if (client.preventive_status === 'sem_historico') return false;
        const projectedStatus = getProjectedStatusAtRoute(client);
        if (projectedStatus !== statusAtRouteFilter) return false;
      }
      
      return true;
    });
    
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
  }, [clientsData, clientSearch, estadoFilter, consultorFilter, statusFilter, statusAtRouteFilter, sortField, sortDirection, routeStartDate]);

  // Suggested clients
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

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Seleção de Fazendas</h3>
            <p className="text-sm text-muted-foreground">
              {selectedClients.size} fazenda(s) selecionada(s) de {filteredAndSortedClients.length}
              {suggestedClients.length > 0 && (
                <span className="text-warning ml-2">
                  ({suggestedClients.length} sugerida(s))
                </span>
              )}
            </p>
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
            disabled={!routeStartDate}
          >
            <SelectTrigger className={cn("h-9", !routeStartDate && "opacity-50")}>
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
        {!routeStartDate && statusAtRouteFilter === 'all' && (
          <p className="text-xs text-muted-foreground">
            💡 O filtro "Status na Rota" usa a data de início da rota
          </p>
        )}
      </div>

      {/* Table */}
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
                      if (client.preventive_status === 'sem_historico') {
                        return <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Sem Histórico</Badge>;
                      }
                      if (client.days_until_due === null || !routeStartDate) return '-';
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const routeStart = new Date(routeStartDate + 'T00:00:00');
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

      {/* Farm Map */}
      {!isLoading && filteredAndSortedClients.length > 0 && (
        <Suspense fallback={
          <div className="h-[300px] flex items-center justify-center border rounded-md">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }>
          <FarmMap 
            clients={filteredAndSortedClients}
            highlightedClientId={highlightedClientId}
            onClientClick={(clientId) => {
              setHighlightedClientId(clientId);
              const row = document.querySelector(`[data-client-id="${clientId}"]`);
              row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        </Suspense>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button 
          type="button" 
          onClick={() => onConfirm(Array.from(selectedClients))}
          disabled={selectedClients.size === 0 || isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Adicionar {selectedClients.size > 0 && `(${selectedClients.size})`}
        </Button>
      </div>
    </div>
  );
}
