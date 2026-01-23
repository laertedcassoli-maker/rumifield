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
  Route,
  Plus,
  Eye,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const statusConfig = {
  em_elaboracao: { label: 'Em Elaboração', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  planejada: { label: 'Planejada', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  em_execucao: { label: 'Em Execução', color: 'bg-warning/10 text-warning border-warning/20' },
  finalizada: { label: 'Finalizada', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
};

interface RouteWithDetails {
  id: string;
  route_code: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  field_technician_user_id: string;
  created_at: string;
  technician_name: string;
  items_count: number;
}

const ITEMS_PER_PAGE = 10;

export default function PreventiveRoutes() {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch routes
  const { data: routes, isLoading } = useQuery<RouteWithDetails[]>({
    queryKey: ['preventive-routes'],
    queryFn: async () => {
      // Fetch routes with item count
      const { data, error } = await supabase
        .from('preventive_routes')
        .select(`
          id,
          route_code,
          start_date,
          end_date,
          status,
          notes,
          field_technician_user_id,
          created_at
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!data?.length) return [];

      // Get unique technician IDs and route IDs
      const technicianIds = [...new Set(data.map(r => r.field_technician_user_id).filter(Boolean))];
      const routeIds = data.map(r => r.id);

      // Fetch profiles and item counts in parallel
      const [profilesResult, itemsResult] = await Promise.all([
        technicianIds.length > 0 
          ? supabase.from('profiles').select('id, nome').in('id', technicianIds)
          : Promise.resolve({ data: [] }),
        supabase.from('preventive_route_items').select('route_id').in('route_id', routeIds)
      ]);

      const profilesMap = new Map<string, string>(
        profilesResult.data?.map(p => [p.id, p.nome] as [string, string]) || []
      );
      
      // Count items per route
      const itemCountMap = new Map<string, number>();
      itemsResult.data?.forEach(item => {
        itemCountMap.set(item.route_id, (itemCountMap.get(item.route_id) || 0) + 1);
      });

      return data.map(route => ({
        ...route,
        technician_name: profilesMap.get(route.field_technician_user_id) || 'Não atribuído',
        items_count: itemCountMap.get(route.id) || 0,
      })) as RouteWithDetails[];
    },
  });

  const filteredRoutes = useMemo(() => {
    if (!routes) return [];

    return routes.filter(route => {
      const matchesSearch = 
        route.route_code?.toLowerCase().includes(search.toLowerCase()) ||
        route.technician_name?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || route.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [routes, search, statusFilter]);

  const totalPages = Math.ceil(filteredRoutes.length / ITEMS_PER_PAGE);
  const paginatedRoutes = filteredRoutes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/preventivas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Rotas Preventivas</h1>
            <p className="text-muted-foreground">Programação de rotas de manutenção</p>
          </div>
        </div>
        {isAdminOrCoordinator && (
          <Button asChild>
            <Link to="/preventivas/rotas/nova">
              <Plus className="mr-2 h-4 w-4" />
              Nova Rota
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou técnico..."
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
            <SelectItem value="em_elaboracao">Em Elaboração</SelectItem>
            <SelectItem value="planejada">Planejada</SelectItem>
            <SelectItem value="em_execucao">Em Execução</SelectItem>
            <SelectItem value="finalizada">Finalizada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginatedRoutes.length > 0 ? (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Técnico de Campo</TableHead>
                  <TableHead>Fazendas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRoutes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-medium">{route.route_code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(route.start_date), 'dd/MM', { locale: ptBR })} - {format(new Date(route.end_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {route.technician_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{route.items_count} fazenda(s)</Badge>
                    </TableCell>
                    <TableCell>
                      {renderStatusBadge(route.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/preventivas/rotas/${route.id}`}>
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
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredRoutes.length)} de {filteredRoutes.length} registros
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
            <Route className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">
              {search || statusFilter !== 'all' ? 'Nenhuma rota encontrada' : 'Nenhuma rota cadastrada'}
            </h3>
            <p className="text-muted-foreground">
              {isAdminOrCoordinator && !search && statusFilter === 'all' && 'Crie uma nova rota para começar'}
            </p>
            {isAdminOrCoordinator && !search && statusFilter === 'all' && (
              <Button className="mt-4" asChild>
                <Link to="/preventivas/rotas/nova">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Rota
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
