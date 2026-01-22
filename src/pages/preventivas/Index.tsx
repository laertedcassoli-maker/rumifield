import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Loader2, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  Plus,
  Route,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

type PreventiveStatus = 'sem_historico' | 'atrasada' | 'elegivel' | 'em_dia' | 'all';
type SortField = 'client_name' | 'preventive_frequency_days' | 'last_preventive_date' | 'days_until_due' | 'preventive_status';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 15;

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
  preventive_frequency_days: number | null;
  consultor_rplus_id: string | null;
  last_preventive_date: string | null;
  days_since_last: number | null;
  days_until_due: number | null;
  preventive_status: string;
}

export default function PreventiveMaintenanceIndex() {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PreventiveStatus>('all');
  const [consultorFilter, setConsultorFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('preventive_status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch preventive overview data
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['preventive-overview'],
    queryFn: async () => {
      // Fetch clients with preventive data calculated on client side
      const { data: clients, error: clientsError } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, preventive_frequency_days, consultor_rplus_id, status')
        .eq('status', 'ativo')
        .order('nome');
      
      if (clientsError) throw clientsError;

      // Fetch all completed preventive maintenance records
      const { data: preventives, error: preventivesError } = await supabase
        .from('preventive_maintenance')
        .select('client_id, completed_date')
        .eq('status', 'concluida');
      
      if (preventivesError) throw preventivesError;

      // Calculate status for each client
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return clients?.map(client => {
        const clientPreventives = preventives?.filter(p => p.client_id === client.id) || [];
        const lastPreventive = clientPreventives.length > 0 
          ? clientPreventives.reduce((max, p) => 
              new Date(p.completed_date!) > new Date(max.completed_date!) ? p : max
            )
          : null;

        const lastPreventiveDate = lastPreventive?.completed_date 
          ? new Date(lastPreventive.completed_date) 
          : null;
        
        let daysSinceLast: number | null = null;
        let daysUntilDue: number | null = null;
        let status = 'sem_historico';

        if (lastPreventiveDate) {
          daysSinceLast = Math.floor((today.getTime() - lastPreventiveDate.getTime()) / (1000 * 60 * 60 * 24));
          const frequency = client.preventive_frequency_days || 90;
          daysUntilDue = frequency - daysSinceLast;

          if (daysUntilDue < 0) {
            status = 'atrasada';
          } else if (daysUntilDue <= 30) {
            status = 'elegivel';
          } else {
            status = 'em_dia';
          }
        }

        return {
          client_id: client.id,
          client_name: client.nome,
          fazenda: client.fazenda,
          preventive_frequency_days: client.preventive_frequency_days,
          consultor_rplus_id: client.consultor_rplus_id,
          last_preventive_date: lastPreventive?.completed_date || null,
          days_since_last: daysSinceLast,
          days_until_due: daysUntilDue,
          preventive_status: status,
        } as ClientPreventive;
      }) || [];
    },
  });

  // Fetch consultors for filter
  const { data: consultors } = useQuery({
    queryKey: ['consultors-preventive'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'consultor_rplus');
      
      if (!roles?.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', roles.map(r => r.user_id));
      
      return profiles || [];
    },
  });

  // Filter and sort
  const filteredAndSortedData = useMemo(() => {
    if (!clientsData) return [];

    let result = clientsData.filter(client => {
      const matchesSearch = 
        client.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        client.fazenda?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || client.preventive_status === statusFilter;
      const matchesConsultor = consultorFilter === 'all' || client.consultor_rplus_id === consultorFilter;

      return matchesSearch && matchesStatus && matchesConsultor;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'client_name':
          comparison = (a.client_name || '').localeCompare(b.client_name || '', 'pt-BR');
          break;
        case 'preventive_frequency_days':
          comparison = (a.preventive_frequency_days || 0) - (b.preventive_frequency_days || 0);
          break;
        case 'last_preventive_date':
          if (!a.last_preventive_date && !b.last_preventive_date) comparison = 0;
          else if (!a.last_preventive_date) comparison = 1;
          else if (!b.last_preventive_date) comparison = -1;
          else comparison = new Date(a.last_preventive_date).getTime() - new Date(b.last_preventive_date).getTime();
          break;
        case 'days_until_due':
          const aDays = a.days_until_due ?? -9999;
          const bDays = b.days_until_due ?? -9999;
          comparison = aDays - bDays;
          break;
        case 'preventive_status':
          const aConfig = statusConfig[a.preventive_status as keyof typeof statusConfig];
          const bConfig = statusConfig[b.preventive_status as keyof typeof statusConfig];
          comparison = (aConfig?.priority ?? 99) - (bConfig?.priority ?? 99);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [clientsData, search, statusFilter, consultorFilter, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Stats
  const stats = useMemo(() => {
    if (!clientsData) return { total: 0, semHistorico: 0, atrasada: 0, elegivel: 0, emDia: 0 };
    return {
      total: clientsData.length,
      semHistorico: clientsData.filter(c => c.preventive_status === 'sem_historico').length,
      atrasada: clientsData.filter(c => c.preventive_status === 'atrasada').length,
      elegivel: clientsData.filter(c => c.preventive_status === 'elegivel').length,
      emDia: clientsData.filter(c => c.preventive_status === 'em_dia').length,
    };
  }, [clientsData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-4 w-4" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-4 w-4" />
      : <ArrowDown className="ml-1 h-4 w-4" />;
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manutenção Preventiva</h1>
          <p className="text-muted-foreground">Controle de elegibilidade e programação de rotas</p>
        </div>
        {isAdminOrCoordinator && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/preventivas/rotas">
                <Route className="mr-2 h-4 w-4" />
                Ver Rotas
              </Link>
            </Button>
            <Button asChild>
              <Link to="/preventivas/rotas/nova">
                <Plus className="mr-2 h-4 w-4" />
                Nova Rota
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors border-muted" onClick={() => { setStatusFilter('sem_historico'); setCurrentPage(1); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              <div className="text-2xl font-bold">{stats.semHistorico}</div>
            </div>
            <div className="text-sm text-muted-foreground">Sem Histórico</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors border-destructive/30" onClick={() => { setStatusFilter('atrasada'); setCurrentPage(1); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="text-2xl font-bold text-destructive">{stats.atrasada}</div>
            </div>
            <div className="text-sm text-muted-foreground">Atrasadas</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors border-warning/30" onClick={() => { setStatusFilter('elegivel'); setCurrentPage(1); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <div className="text-2xl font-bold text-warning">{stats.elegivel}</div>
            </div>
            <div className="text-sm text-muted-foreground">Elegíveis</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors border-green-500/30" onClick={() => { setStatusFilter('em_dia'); setCurrentPage(1); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{stats.emDia}</div>
            </div>
            <div className="text-sm text-muted-foreground">Em Dia</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por fazenda..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: PreventiveStatus) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="sem_historico">Sem Histórico</SelectItem>
            <SelectItem value="atrasada">Atrasada</SelectItem>
            <SelectItem value="elegivel">Elegível</SelectItem>
            <SelectItem value="em_dia">Em Dia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={consultorFilter} onValueChange={(v) => { setConsultorFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Consultor R+" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Consultores</SelectItem>
            {consultors?.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginatedData.length > 0 ? (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('client_name')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Fazenda {getSortIcon('client_name')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('preventive_frequency_days')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Frequência {getSortIcon('preventive_frequency_days')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('last_preventive_date')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Última Preventiva {getSortIcon('last_preventive_date')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('days_until_due')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Dias p/ Vencer {getSortIcon('days_until_due')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('preventive_status')} className="h-auto p-0 font-medium hover:bg-transparent">
                      Status {getSortIcon('preventive_status')}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((client) => (
                  <TableRow key={client.client_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{client.client_name}</div>
                        {client.fazenda && (
                          <div className="text-sm text-muted-foreground">{client.fazenda}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.preventive_frequency_days ? (
                        <span>{client.preventive_frequency_days} dias</span>
                      ) : (
                        <span className="text-muted-foreground">Não definida</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.last_preventive_date ? (
                        <div>
                          <div>{format(new Date(client.last_preventive_date), 'dd/MM/yyyy', { locale: ptBR })}</div>
                          <div className="text-sm text-muted-foreground">
                            {client.days_since_last} dias atrás
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.days_until_due !== null ? (
                        <span className={client.days_until_due < 0 ? 'text-destructive font-medium' : client.days_until_due <= 30 ? 'text-warning font-medium' : ''}>
                          {client.days_until_due < 0 ? `${Math.abs(client.days_until_due)} dias atrasada` : `${client.days_until_due} dias`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {renderStatusBadge(client.preventive_status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedData.length)} de {filteredAndSortedData.length} registros
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">
              {search || statusFilter !== 'all' ? 'Nenhuma fazenda encontrada' : 'Nenhuma fazenda cadastrada'}
            </h3>
            <p className="text-muted-foreground">
              {search || statusFilter !== 'all' ? 'Tente ajustar os filtros' : ''}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
