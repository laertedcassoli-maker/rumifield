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
  User,
  Map as MapIcon,
  AlertTriangle,
  Wrench,
  Plus
} from 'lucide-react';
import NovaVisitaDiretaDialog from '@/components/chamados/NovaVisitaDiretaDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, isToday, isThisWeek, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

// Preventive route statuses
const preventiveStatusConfig = {
  planejada: { label: 'Planejada', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Calendar },
  em_execucao: { label: 'Em Execução', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
  finalizada: { label: 'Finalizada', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
};

// Corrective visit statuses
const correctiveStatusConfig = {
  planejada: { label: 'Planejada', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Calendar },
  em_elaboracao: { label: 'Em Elaboração', color: 'bg-muted text-muted-foreground border-border', icon: Clock },
  em_execucao: { label: 'Em Execução', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
  finalizada: { label: 'Concluída', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
};

type FilterType = 'hoje' | 'semana' | 'todas';
type RouteType = 'all' | 'preventive' | 'corrective';
type StatusFilter = 'ativas' | 'concluidas' | 'todas';

interface PreventiveRoute {
  type: 'preventive';
  id: string;
  code: string;
  start_date: string;
  end_date: string;
  status: string;
  total_farms: number;
  executed_farms: number;
  field_technician_user_id: string;
  technician_name: string;
  farm_coordinates: Array<{ lat: number; lon: number; name: string }>;
}

interface CorrectiveVisit {
  type: 'corrective';
  id: string;
  code: string;
  scheduled_date: string;
  status: string;
  ticket_id: string;
  ticket_code: string;
  client_id: string;
  client_name: string;
  client_fazenda: string | null;
  field_technician_user_id: string;
  technician_name: string;
  client_lat: number | null;
  client_lon: number | null;
}

type UnifiedRoute = PreventiveRoute | CorrectiveVisit;

interface Technician {
  id: string;
  nome: string;
}

export default function MinhasRotas() {
  const { user, role } = useAuth();
  const [filter, setFilter] = useState<FilterType>('todas');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<RouteType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ativas');
  const [showNovaVisita, setShowNovaVisita] = useState(false);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Piracicaba/SP coordinates as default origin
  const DEFAULT_ORIGIN = { lat: -22.7249, lon: -47.6476, name: 'Piracicaba/SP' };

  // Fetch current user's profile for cidade_base
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-cidade-base', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('cidade_base, cidade_base_lat, cidade_base_lon')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Determine origin based on user profile or default
  const userOrigin = userProfile?.cidade_base_lat && userProfile?.cidade_base_lon
    ? { lat: userProfile.cidade_base_lat, lon: userProfile.cidade_base_lon, name: userProfile.cidade_base || 'Minha cidade' }
    : userProfile?.cidade_base
      ? { ...DEFAULT_ORIGIN, name: userProfile.cidade_base }
      : DEFAULT_ORIGIN;

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

  // Fetch preventive routes
  const { data: preventiveRoutes, isLoading: isLoadingPreventive } = useQuery<PreventiveRoute[]>({
    queryKey: ['my-preventive-routes', user?.id, isAdminOrCoordinator],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('preventive_routes')
        .select('id, route_code, start_date, end_date, status, field_technician_user_id')
        .in('status', ['planejada', 'em_execucao', 'finalizada'])
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
          .select('route_id, status, client_id, order_index')
          .in('route_id', routeIds)
          .order('order_index'),
        technicianIds.length > 0
          ? supabase.from('profiles').select('id, nome').in('id', technicianIds)
          : Promise.resolve({ data: [] }),
      ]);

      if (itemsResult.error) throw itemsResult.error;

      // Fetch client coordinates
      const clientIds = [...new Set(itemsResult.data?.map(i => i.client_id) || [])];
      const { data: clientsData } = clientIds.length > 0
        ? await supabase
            .from('clientes')
            .select('id, nome, latitude, longitude')
            .in('id', clientIds)
        : { data: [] };

      const clientsMap = new Map<string, { nome: string; lat: number | null; lon: number | null }>(
        clientsData?.map(c => [c.id, { nome: c.nome, lat: c.latitude, lon: c.longitude }] as [string, { nome: string; lat: number | null; lon: number | null }]) || []
      );

      const profilesMap = new Map<string, string>(
        profilesResult.data?.map(p => [p.id, p.nome] as [string, string]) || []
      );

      const countMap = new Map<string, { total: number; executed: number; coordinates: Array<{ lat: number; lon: number; name: string }> }>();
      routeIds.forEach(id => countMap.set(id, { total: 0, executed: 0, coordinates: [] }));

      // Group items by route and preserve order
      const itemsByRoute = new Map<string, typeof itemsResult.data>();
      routeIds.forEach(id => itemsByRoute.set(id, []));
      itemsResult.data?.forEach(item => {
        itemsByRoute.get(item.route_id)?.push(item);
      });

      itemsByRoute.forEach((items, routeId) => {
        const counts = countMap.get(routeId);
        if (counts) {
          items?.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          items?.forEach(item => {
            counts.total += 1;
            if (item.status === 'executado') {
              counts.executed += 1;
            }
            const client = clientsMap.get(item.client_id);
            if (client?.lat && client?.lon) {
              counts.coordinates.push({ lat: client.lat, lon: client.lon, name: client.nome });
            }
          });
        }
      });

      return routesData.map(route => ({
        type: 'preventive' as const,
        id: route.id,
        code: route.route_code,
        start_date: route.start_date,
        end_date: route.end_date,
        status: route.status,
        total_farms: countMap.get(route.id)?.total || 0,
        executed_farms: countMap.get(route.id)?.executed || 0,
        field_technician_user_id: route.field_technician_user_id,
        technician_name: profilesMap.get(route.field_technician_user_id) || 'Não atribuído',
        farm_coordinates: countMap.get(route.id)?.coordinates || [],
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch corrective visits
  const { data: correctiveVisits, isLoading: isLoadingCorrective } = useQuery<CorrectiveVisit[]>({
    queryKey: ['my-corrective-visits', user?.id, isAdminOrCoordinator],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('ticket_visits')
        .select(`
          id,
          visit_code,
          planned_start_date,
          status,
          field_technician_user_id,
          ticket_id,
          client_id
        `)
        .in('status', ['planejada', 'em_elaboracao', 'em_execucao', 'finalizada'])
        .order('planned_start_date', { ascending: true });

      if (!isAdminOrCoordinator) {
        query = query.eq('field_technician_user_id', user.id);
      }

      const { data: visitsData, error: visitsError } = await query;

      if (visitsError) throw visitsError;
      if (!visitsData?.length) return [];

      // Fetch ticket details
      const ticketIds = [...new Set(visitsData.map(v => v.ticket_id))];
      const technicianIds = [...new Set(visitsData.map(v => v.field_technician_user_id).filter(Boolean))] as string[];
      const clientIds = [...new Set(visitsData.map(v => v.client_id).filter(Boolean))] as string[];

      const [ticketsResult, profilesResult, clientsResult] = await Promise.all([
        supabase
          .from('technical_tickets')
          .select('id, ticket_code')
          .in('id', ticketIds),
        technicianIds.length > 0
          ? supabase.from('profiles').select('id, nome').in('id', technicianIds)
          : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
        clientIds.length > 0
          ? supabase.from('clientes').select('id, nome, fazenda, latitude, longitude').in('id', clientIds)
          : Promise.resolve({ data: [] as Array<{ id: string; nome: string; fazenda: string | null; latitude: number | null; longitude: number | null }> }),
      ]);

      if (ticketsResult.error) throw ticketsResult.error;

      const ticketsMap = new Map(ticketsResult.data?.map(t => [t.id, t]) || []);
      const clientsMap = new Map(clientsResult.data?.map(c => [c.id, c]) || []);
      const profilesMap = new Map<string, string>(
        profilesResult.data?.map(p => [p.id, p.nome] as [string, string]) || []
      );

      return visitsData.map(visit => {
        const ticket = ticketsMap.get(visit.ticket_id);
        const client = visit.client_id ? clientsMap.get(visit.client_id) : null;

        return {
          type: 'corrective' as const,
          id: visit.id,
          code: visit.visit_code || 'CORR-????',
          scheduled_date: visit.planned_start_date || '',
          status: visit.status === 'em_execucao' ? 'em_andamento' : visit.status === 'planejada' ? 'agendada' : visit.status,
          ticket_id: visit.ticket_id,
          ticket_code: ticket?.ticket_code || '',
          client_id: visit.client_id || '',
          client_name: client?.nome || 'Cliente não encontrado',
          client_fazenda: client?.fazenda || null,
          field_technician_user_id: visit.field_technician_user_id,
          technician_name: profilesMap.get(visit.field_technician_user_id) || 'Não atribuído',
          client_lat: client?.latitude || null,
          client_lon: client?.longitude || null,
        };
      });
    },
    enabled: !!user?.id,
  });

  const isLoading = isLoadingPreventive || isLoadingCorrective;

  // Combine and filter routes
  const filteredRoutes = useMemo(() => {
    const allRoutes: UnifiedRoute[] = [
      ...(preventiveRoutes || []),
      ...(correctiveVisits || []),
    ];

    return allRoutes.filter(route => {
      // Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'preventive' && route.type !== 'preventive') return false;
        if (typeFilter === 'corrective' && route.type !== 'corrective') return false;
      }

      // Status filter
      if (statusFilter !== 'todas') {
        const completedStatuses = ['concluida', 'finalizada'];
        const isCompleted = completedStatuses.includes(route.status);
        if (statusFilter === 'ativas' && isCompleted) return false;
        if (statusFilter === 'concluidas' && !isCompleted) return false;
      }

      // Technician filter
      const techId = route.field_technician_user_id;
      if (technicianFilter !== 'all' && techId !== technicianFilter) return false;

      // Date filter
      const today = new Date();
      if (route.type === 'preventive') {
        const startDate = parseISO(route.start_date);
        const endDate = parseISO(route.end_date);

        switch (filter) {
          case 'hoje':
            return isToday(startDate) || isToday(endDate) || (startDate <= today && endDate >= today);
          case 'semana':
            return isThisWeek(startDate, { locale: ptBR }) || isThisWeek(endDate, { locale: ptBR });
          default:
            return true;
        }
      } else {
        const scheduledDate = parseISO(route.scheduled_date);
        switch (filter) {
          case 'hoje':
            return isToday(scheduledDate);
          case 'semana':
            return isThisWeek(scheduledDate, { locale: ptBR });
          default:
            return true;
        }
      }
    }).sort((a, b) => {
      // Sort by date
      const dateA = a.type === 'preventive' ? a.start_date : a.scheduled_date;
      const dateB = b.type === 'preventive' ? b.start_date : b.scheduled_date;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  }, [preventiveRoutes, correctiveVisits, filter, technicianFilter, typeFilter, statusFilter]);

  const renderStatusBadge = (route: UnifiedRoute) => {
    if (route.type === 'preventive') {
      const config = preventiveStatusConfig[route.status as keyof typeof preventiveStatusConfig];
      if (!config) return null;
      const IconComponent = config.icon;
      return (
        <Badge variant="outline" className={`${config.color} gap-1`}>
          <IconComponent className="h-3 w-3" />
          {config.label}
        </Badge>
      );
    } else {
      const config = correctiveStatusConfig[route.status as keyof typeof correctiveStatusConfig];
      if (!config) return null;
      const IconComponent = config.icon;
      return (
        <Badge variant="outline" className={`${config.color} gap-1`}>
          <IconComponent className="h-3 w-3" />
          {config.label}
        </Badge>
      );
    }
  };

  const getProgressPercentage = (executed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((executed / total) * 100);
  };

  const buildGoogleMapsRouteUrl = (coordinates: Array<{ lat: number; lon: number; name: string }>) => {
    if (coordinates.length === 0) return null;
    
    const origin = `${userOrigin.lat},${userOrigin.lon}`;
    const waypoints = coordinates.map(c => `${c.lat},${c.lon}`);
    
    if (waypoints.length === 1) {
      return `https://www.google.com/maps/dir/${origin}/${waypoints[0]}`;
    }
    
    const allPoints = [origin, ...waypoints];
    return `https://www.google.com/maps/dir/${allPoints.join('/')}`;
  };

  const buildSingleDestinationUrl = (lat: number, lon: number) => {
    const origin = `${userOrigin.lat},${userOrigin.lon}`;
    return `https://www.google.com/maps/dir/${origin}/${lat},${lon}`;
  };

  const renderPreventiveCard = (route: PreventiveRoute) => {
    const progress = getProgressPercentage(route.executed_farms, route.total_farms);
    return (
      <Card key={route.id} className="overflow-hidden active:scale-[0.98] transition-transform">
        <Link to={`/preventivas/execucao/${route.id}`} className="block">
          <CardContent className="p-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                    <Route className="h-3 w-3 mr-1" />
                    PREV
                  </Badge>
                  <p className="font-semibold text-base">{route.code}</p>
                  {route.farm_coordinates.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={buildGoogleMapsRouteUrl(route.farm_coordinates) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-primary hover:text-primary/80"
                        >
                          <MapIcon className="h-4 w-4" />
                          <span className="text-xs font-medium">Rota</span>
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Abrir trajeto no Google Maps</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {isAdminOrCoordinator && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <User className="h-3 w-3" />
                    {route.technician_name}
                  </p>
                )}
              </div>
              {renderStatusBadge(route)}
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
  };

  const renderCorrectiveCard = (visit: CorrectiveVisit) => {
    return (
      <Card key={visit.id} className="overflow-hidden active:scale-[0.98] transition-transform">
        <Link to={`/chamados/visita/${visit.id}`} className="block">
          <CardContent className="p-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs">
                    <Wrench className="h-3 w-3 mr-1" />
                    CORR
                  </Badge>
                  <p className="font-semibold text-base">{visit.code}</p>
                  {visit.client_lat && visit.client_lon ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={buildSingleDestinationUrl(visit.client_lat, visit.client_lon)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 p-1 rounded-md hover:bg-muted transition-colors"
                        >
                          <span className="text-xs text-muted-foreground">Rota</span>
                          <MapIcon className="h-4 w-4 text-primary" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ver no Google Maps</p>
                        <p className="text-xs text-muted-foreground">Saindo de {userOrigin.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1 p-1 rounded-md cursor-not-allowed">
                          <span className="text-xs text-muted-foreground/40">Rota</span>
                          <MapIcon className="h-4 w-4 text-muted-foreground/40" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mapa indisponível</p>
                        <p className="text-xs text-muted-foreground">Cliente sem coordenadas cadastradas</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {isAdminOrCoordinator && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <User className="h-3 w-3" />
                    {visit.technician_name}
                  </p>
                )}
              </div>
              {renderStatusBadge(visit)}
            </div>

            {/* Client info */}
            <div className="mb-3">
              <p className="font-medium text-sm">{visit.client_name}</p>
              {visit.client_fazenda && (
                <p className="text-xs text-muted-foreground">{visit.client_fazenda}</p>
              )}
            </div>

            {/* Info row */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(parseISO(visit.scheduled_date), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1 text-xs text-orange-600">
                <AlertTriangle className="h-3 w-3" />
                {visit.ticket_code}
              </span>
            </div>

            {/* Arrow */}
            <div className="flex justify-end mt-2">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Link>
      </Card>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-4 animate-fade-in">
        {/* Header - Compact on mobile */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">
              {isAdminOrCoordinator ? 'Rotas em Execução' : 'Minhas Rotas'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAdminOrCoordinator 
                ? 'Acompanhe rotas preventivas e visitas corretivas' 
                : 'Rotas preventivas e visitas corretivas atribuídas'}
            </p>
          </div>
          <Button 
            size="sm" 
            className="shrink-0 gap-1 h-9"
            onClick={() => setShowNovaVisita(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Visita</span>
            <span className="sm:hidden">Visita</span>
          </Button>
        </div>

        {/* Filters - Stacked on mobile */}
        <div className="space-y-3">
          {/* Type Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Button
              variant={typeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter('all')}
              className="shrink-0"
            >
              Todas
            </Button>
            <Button
              variant={typeFilter === 'preventive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter('preventive')}
              className="shrink-0 gap-1"
            >
              <Route className="h-3 w-3" />
              Preventivas
            </Button>
            <Button
              variant={typeFilter === 'corrective' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter('corrective')}
              className="shrink-0 gap-1"
            >
              <Wrench className="h-3 w-3" />
              Corretivas
            </Button>
          </div>

          {/* Quick Date Filters - Scrollable on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Button
              variant={filter === 'hoje' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('hoje')}
              className="shrink-0"
            >
              Hoje
            </Button>
            <Button
              variant={filter === 'semana' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('semana')}
              className="shrink-0"
            >
              Semana
            </Button>
            <Button
              variant={filter === 'todas' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('todas')}
              className="shrink-0"
            >
              Todas
            </Button>
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full">
              <CheckCircle2 className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativas">Em andamento</SelectItem>
              <SelectItem value="concluidas">Concluídas</SelectItem>
              <SelectItem value="todas">Todos os status</SelectItem>
            </SelectContent>
          </Select>

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
            {filteredRoutes.map((route) => 
              route.type === 'preventive' 
                ? renderPreventiveCard(route)
                : renderCorrectiveCard(route)
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center">
              <Route className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-3 font-semibold text-sm">
                {filter !== 'todas' || technicianFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'ativas'
                  ? 'Nenhuma rota encontrada' 
                  : isAdminOrCoordinator 
                    ? 'Nenhuma rota em execução'
                    : 'Nenhuma rota atribuída'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {filter !== 'todas' || technicianFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'ativas'
                  ? 'Tente outros filtros' 
                  : 'Aguarde novas atribuições'}
              </p>
              {(filter !== 'todas' || technicianFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'ativas') && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="mt-3" 
                  onClick={() => { setFilter('todas'); setTechnicianFilter('all'); setTypeFilter('all'); setStatusFilter('ativas'); }}
                >
                  Limpar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <NovaVisitaDiretaDialog 
          open={showNovaVisita} 
          onOpenChange={setShowNovaVisita} 
        />
      </div>
    </TooltipProvider>
  );
}
