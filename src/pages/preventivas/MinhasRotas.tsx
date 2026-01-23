import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
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

      let query = supabase
        .from('preventive_routes')
        .select('id, route_code, start_date, end_date, status, field_technician_user_id')
        .in('status', ['planejada', 'em_execucao'])
        .order('start_date', { ascending: true });

      if (!isAdminOrCoordinator) {
        query = query.eq('field_technician_user_id', user.id);
      }

      const { data: routesData, error: routesError } = await query;

      if (routesError) throw routesError;
      if (!routesData?.length) return [];

      const routeIds = routesData.map(r => r.id);
      const technicianIds = [...new Set(routesData.map(r => r.field_technician_user_id).filter(Boolean))];

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
    <div className="space-y-4 animate-fade-in">
      {/* Header - Compact on mobile */}
      <div>
        <h1 className="text-xl font-bold">
          {isAdminOrCoordinator ? 'Rotas em Execução' : 'Minhas Rotas'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdminOrCoordinator 
            ? 'Acompanhe as rotas dos técnicos' 
            : 'Rotas atribuídas a você'}
        </p>
      </div>

      {/* Filters - Stacked on mobile */}
      <div className="space-y-3">
        {/* Quick Date Filters - Scrollable on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Button
            variant={filter === 'hoje' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('hoje')}
            className="shrink-0"
          >
            Hoje
          </Button>
          <Button
            variant={filter === 'semana' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('semana')}
            className="shrink-0"
          >
            Semana
          </Button>
          <Button
            variant={filter === 'todas' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('todas')}
            className="shrink-0"
          >
            Todas
          </Button>
        </div>

        {/* Technician Filter (Admin/Coordinator only) */}
        {isAdminOrCoordinator && (
          <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
            <SelectTrigger className="w-full">
              <User className="mr-2 h-4 w-4 shrink-0" />
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
        <div className="space-y-3">
          {filteredRoutes.map((route) => {
            const progress = getProgressPercentage(route.executed_farms, route.total_farms);
            return (
              <Card key={route.id} className="overflow-hidden active:scale-[0.98] transition-transform">
                <Link to={`/preventivas/execucao/${route.id}`} className="block">
                  <CardContent className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-base">{route.route_code}</p>
                        {isAdminOrCoordinator && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            {route.technician_name}
                          </p>
                        )}
                      </div>
                      {renderStatusBadge(route.status)}
                    </div>

                    {/* Info row */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(parseISO(route.start_date), 'dd/MM', { locale: ptBR })} - {format(parseISO(route.end_date), 'dd/MM', { locale: ptBR })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {route.executed_farms}/{route.total_farms}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{progress}% concluído</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <Route className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-3 font-semibold text-sm">
              {filter !== 'todas' || technicianFilter !== 'all' 
                ? 'Nenhuma rota encontrada' 
                : isAdminOrCoordinator 
                  ? 'Nenhuma rota em execução'
                  : 'Nenhuma rota atribuída'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {filter !== 'todas' || technicianFilter !== 'all'
                ? 'Tente outros filtros' 
                : 'Aguarde novas atribuições'}
            </p>
            {(filter !== 'todas' || technicianFilter !== 'all') && (
              <Button 
                variant="outline" 
                size="sm"
                className="mt-3" 
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
