import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Route,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowRight,
  CalendarDays,
  User
} from 'lucide-react';
import { format, isToday, isThisWeek, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const statusConfig = {
  planejada: { label: 'Planejada', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Calendar },
  em_execucao: { label: 'Em Execução', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
  finalizada: { label: 'Finalizada', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
};

type FilterType = 'hoje' | 'semana' | 'todas';

interface RouteWithProgress {
  id: string;
  route_code: string;
  start_date: string;
  end_date: string;
  status: string;
  total_farms: number;
  executed_farms: number;
  field_technician_user_id: string;
  technician_name: string;
}

interface Technician {
  id: string;
  nome: string;
}

export default function MinhasRotas() {
  const { user, role } = useAuth();
  const [filter, setFilter] = useState<FilterType>('todas');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch field technicians (only for admin/coordinator)
  const { data: technicians } = useQuery<Technician[]>({
    queryKey: ['field-technicians'],
    queryFn: async () => {
      // Get users with tecnico_campo role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'tecnico_campo');

      if (roleError) throw roleError;
      if (!roleData?.length) return [];

      const userIds = roleData.map(r => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', userIds)
        .order('nome');

      if (profilesError) throw profilesError;
      return profiles || [];
    },
    enabled: isAdminOrCoordinator,
  });

  // Fetch routes
  const { data: routes, isLoading } = useQuery<RouteWithProgress[]>({
    queryKey: ['my-preventive-routes', user?.id, isAdminOrCoordinator],
    queryFn: async () => {
      if (!user?.id) return [];

      // Build query based on role
      let query = supabase
        .from('preventive_routes')
        .select('id, route_code, start_date, end_date, status, field_technician_user_id')
        .in('status', ['planejada', 'em_execucao'])
        .order('start_date', { ascending: true });

      // If not admin/coordinator, filter by current user
      if (!isAdminOrCoordinator) {
        query = query.eq('field_technician_user_id', user.id);
      }

      const { data: routesData, error: routesError } = await query;

      if (routesError) throw routesError;
      if (!routesData?.length) return [];

      const routeIds = routesData.map(r => r.id);
      const technicianIds = [...new Set(routesData.map(r => r.field_technician_user_id).filter(Boolean))];

      // Fetch route items and technician names in parallel
      const [itemsResult, profilesResult] = await Promise.all([
        supabase
          .from('preventive_route_items')
          .select('route_id, status')
          .in('route_id', routeIds),
        technicianIds.length > 0
          ? supabase.from('profiles').select('id, nome').in('id', technicianIds)
          : Promise.resolve({ data: [] }),
      ]);

      if (itemsResult.error) throw itemsResult.error;

      // Build maps
      const profilesMap = new Map<string, string>(
        profilesResult.data?.map(p => [p.id, p.nome] as [string, string]) || []
      );

      const countMap = new Map<string, { total: number; executed: number }>();
      routeIds.forEach(id => countMap.set(id, { total: 0, executed: 0 }));

      itemsResult.data?.forEach(item => {
        const counts = countMap.get(item.route_id);
        if (counts) {
          counts.total += 1;
          if (item.status === 'executado') {
            counts.executed += 1;
          }
        }
      });

      return routesData.map(route => ({
        ...route,
        total_farms: countMap.get(route.id)?.total || 0,
        executed_farms: countMap.get(route.id)?.executed || 0,
        technician_name: profilesMap.get(route.field_technician_user_id) || 'Não atribuído',
      }));
    },
    enabled: !!user?.id,
  });

  const filteredRoutes = useMemo(() => {
    if (!routes) return [];

    return routes.filter(route => {
      const startDate = parseISO(route.start_date);
      const endDate = parseISO(route.end_date);
      const today = new Date();

      // Date filter
      let matchesDateFilter = true;
      switch (filter) {
        case 'hoje':
          matchesDateFilter = isToday(startDate) || isToday(endDate) || (startDate <= today && endDate >= today);
          break;
        case 'semana':
          matchesDateFilter = isThisWeek(startDate, { locale: ptBR }) || isThisWeek(endDate, { locale: ptBR });
          break;
        case 'todas':
        default:
          matchesDateFilter = true;
      }

      // Technician filter (only for admin/coordinator)
      const matchesTechnicianFilter = technicianFilter === 'all' || route.field_technician_user_id === technicianFilter;

      return matchesDateFilter && matchesTechnicianFilter;
    });
  }, [routes, filter, technicianFilter]);

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;
    const IconComponent = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} gap-1`}>
        <IconComponent className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getProgressPercentage = (executed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((executed / total) * 100);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">
          {isAdminOrCoordinator ? 'Rotas em Execução' : 'Minhas Rotas'}
        </h1>
        <p className="text-muted-foreground">
          {isAdminOrCoordinator 
            ? 'Acompanhe as rotas de manutenção preventiva dos técnicos' 
            : 'Rotas de manutenção preventiva atribuídas a você'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Quick Date Filters */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'hoje' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('hoje')}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Hoje
          </Button>
          <Button
            variant={filter === 'semana' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('semana')}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Esta Semana
          </Button>
          <Button
            variant={filter === 'todas' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('todas')}
          >
            <Route className="mr-2 h-4 w-4" />
            Todas
          </Button>
        </div>

        {/* Technician Filter (Admin/Coordinator only) */}
        {isAdminOrCoordinator && (
          <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
            <SelectTrigger className="w-[220px]">
              <User className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filtrar por técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os técnicos</SelectItem>
              {technicians?.map(tech => (
                <SelectItem key={tech.id} value={tech.id}>
                  {tech.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Routes List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredRoutes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRoutes.map((route) => {
            const progress = getProgressPercentage(route.executed_farms, route.total_farms);
            return (
              <Card key={route.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold">{route.route_code}</CardTitle>
                    {renderStatusBadge(route.status)}
                  </div>
                  {/* Show technician name for admin/coordinator */}
                  {isAdminOrCoordinator && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <User className="h-3 w-3" />
                      {route.technician_name}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Period */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(parseISO(route.start_date), 'dd/MM', { locale: ptBR })} - {format(parseISO(route.end_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Fazendas
                      </span>
                      <span className="font-medium">
                        {route.executed_farms} / {route.total_farms}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      {progress}% concluído
                    </p>
                  </div>

                  {/* Action Button */}
                  <Button asChild className="w-full">
                    <Link to={`/preventivas/execucao/${route.id}`}>
                      Abrir Rota
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Route className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">
              {filter !== 'todas' || technicianFilter !== 'all' 
                ? 'Nenhuma rota encontrada com os filtros selecionados' 
                : isAdminOrCoordinator 
                  ? 'Nenhuma rota em execução'
                  : 'Nenhuma rota atribuída'}
            </h3>
            <p className="text-muted-foreground mt-1">
              {filter !== 'todas' || technicianFilter !== 'all'
                ? 'Tente outros filtros para ver as rotas' 
                : isAdminOrCoordinator
                  ? 'Não há rotas planejadas ou em execução no momento'
                  : 'Aguarde a atribuição de novas rotas pelo coordenador'}
            </p>
            {(filter !== 'todas' || technicianFilter !== 'all') && (
              <Button 
                variant="outline" 
                className="mt-4" 
                onClick={() => { setFilter('todas'); setTechnicianFilter('all'); }}
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
