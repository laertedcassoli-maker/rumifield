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
import { 
  Search, 
  Loader2, 
  Plus,
  Eye,
  Ticket,
  AlertTriangle,
  Clock,
  CheckCircle,
  Package,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Building2,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

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

interface TicketWithDetails {
  id: string;
  ticket_code: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  client_id: string;
  client_name: string;
  client_fazenda: string | null;
  assigned_technician_id: string | null;
  technician_name: string | null;
  created_at: string;
  visits_count: number;
}

const ITEMS_PER_PAGE = 15;

export default function ChamadosIndex() {
  const { role, user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch tickets
  const { data: tickets, isLoading } = useQuery<TicketWithDetails[]>({
    queryKey: ['technical-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technical_tickets')
        .select(`
          id,
          ticket_code,
          title,
          description,
          priority,
          status,
          client_id,
          assigned_technician_id,
          created_at
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!data?.length) return [];

      // Get unique client and technician IDs
      const clientIds = [...new Set(data.map(t => t.client_id))];
      const technicianIds = [...new Set(data.map(t => t.assigned_technician_id).filter(Boolean))] as string[];
      const ticketIds = data.map(t => t.id);

      // Fetch clients, profiles, and visit counts in parallel
      const [clientsResult, profilesResult, visitsResult] = await Promise.all([
        supabase.from('clientes').select('id, nome, fazenda').in('id', clientIds),
        technicianIds.length > 0 
          ? supabase.from('profiles').select('id, nome').in('id', technicianIds)
          : Promise.resolve({ data: [] }),
        supabase.from('ticket_visits').select('ticket_id').in('ticket_id', ticketIds)
      ]);

      const clientsMap = new Map<string, { id: string; nome: string; fazenda: string | null }>(
        clientsResult.data?.map(c => [c.id, c] as [string, { id: string; nome: string; fazenda: string | null }]) || []
      );
      const profilesMap = new Map<string, string>(
        profilesResult.data?.map(p => [p.id, p.nome] as [string, string]) || []
      );
      
      // Count visits per ticket
      const visitsCountMap = new Map<string, number>();
      visitsResult.data?.forEach(v => {
        visitsCountMap.set(v.ticket_id, (visitsCountMap.get(v.ticket_id) || 0) + 1);
      });

      return data.map(ticket => {
        const client = clientsMap.get(ticket.client_id);
        return {
          ...ticket,
          client_name: client?.nome || 'Cliente não encontrado',
          client_fazenda: client?.fazenda || null,
          technician_name: ticket.assigned_technician_id 
            ? profilesMap.get(ticket.assigned_technician_id) || null 
            : null,
          visits_count: visitsCountMap.get(ticket.id) || 0,
        };
      }) as TicketWithDetails[];
    },
  });

  // Filter and paginate
  const filteredTickets = useMemo(() => {
    if (!tickets) return [];

    const searchLower = search.toLowerCase();
    const searchWords = searchLower.split(/\s+/).filter(Boolean);

    return tickets.filter(ticket => {
      const searchableText = [
        ticket.ticket_code,
        ticket.title,
        ticket.client_name,
        ticket.client_fazenda,
        ticket.technician_name,
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = searchWords.length === 0 || 
        searchWords.every(word => searchableText.includes(word));
      
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Stats
  const stats = useMemo(() => {
    if (!tickets) return { total: 0, aberto: 0, em_atendimento: 0, aguardando_peca: 0, resolvido: 0 };
    return {
      total: tickets.length,
      aberto: tickets.filter(t => t.status === 'aberto').length,
      em_atendimento: tickets.filter(t => t.status === 'em_atendimento').length,
      aguardando_peca: tickets.filter(t => t.status === 'aguardando_peca').length,
      resolvido: tickets.filter(t => t.status === 'resolvido').length,
    };
  }, [tickets]);

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

  const renderPriorityBadge = (priority: string) => {
    const config = priorityConfig[priority as keyof typeof priorityConfig];
    if (!config) return null;
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chamados Técnicos</h1>
          <p className="text-muted-foreground">Gestão de chamados e visitas corretivas</p>
        </div>
        <Button asChild>
          <Link to="/chamados/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo Chamado
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors border-blue-500/30" onClick={() => { setStatusFilter('aberto'); setCurrentPage(1); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{stats.aberto}</div>
            </div>
            <div className="text-sm text-muted-foreground">Abertos</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors border-warning/30" onClick={() => { setStatusFilter('em_atendimento'); setCurrentPage(1); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div className="text-2xl font-bold text-warning">{stats.em_atendimento}</div>
            </div>
            <div className="text-sm text-muted-foreground">Em Atendimento</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors border-purple-500/30" onClick={() => { setStatusFilter('aguardando_peca'); setCurrentPage(1); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              <div className="text-2xl font-bold text-purple-600">{stats.aguardando_peca}</div>
            </div>
            <div className="text-sm text-muted-foreground">Aguardando Peça</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors border-green-500/30" onClick={() => { setStatusFilter('resolvido'); setCurrentPage(1); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{stats.resolvido}</div>
            </div>
            <div className="text-sm text-muted-foreground">Resolvidos</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, título, cliente ou técnico..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
            <SelectItem value="aguardando_peca">Aguardando Peça</SelectItem>
            <SelectItem value="resolvido">Resolvido</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginatedTickets.length > 0 ? (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.ticket_code}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <div className="font-medium truncate">{ticket.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <div className="font-medium">{ticket.client_name}</div>
                          {ticket.client_fazenda && (
                            <div className="text-sm text-muted-foreground">{ticket.client_fazenda}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{renderPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell>{renderStatusBadge(ticket.status)}</TableCell>
                    <TableCell>
                      {ticket.technician_name ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{ticket.technician_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Não atribuído</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/chamados/${ticket.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)} de {filteredTickets.length} registros
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
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">
              {search || statusFilter !== 'all' || priorityFilter !== 'all' 
                ? 'Nenhum chamado encontrado' 
                : 'Nenhum chamado cadastrado'}
            </h3>
            <p className="text-muted-foreground">
              {!search && statusFilter === 'all' && priorityFilter === 'all' && 'Crie um novo chamado para começar'}
            </p>
            {!search && statusFilter === 'all' && priorityFilter === 'all' && (
              <Button className="mt-4" asChild>
                <Link to="/chamados/novo">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Chamado
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
