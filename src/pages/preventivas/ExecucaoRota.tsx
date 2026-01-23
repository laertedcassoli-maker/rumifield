import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  ArrowLeft,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  Play,
  Eye,
  Navigation,
  AlertCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { CheckinDialog } from '@/components/preventivas/CheckinDialog';

const routeStatusConfig = {
  planejada: { label: 'Planejada', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  em_execucao: { label: 'Em Execução', color: 'bg-warning/10 text-warning border-warning/20' },
  finalizada: { label: 'Finalizada', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
};

type AttendanceStatus = 'nao_iniciada' | 'em_atendimento' | 'concluida';

const attendanceStatusConfig: Record<AttendanceStatus, { label: string; color: string; icon: typeof Clock }> = {
  nao_iniciada: { label: 'Pendente', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20', icon: Clock },
  em_atendimento: { label: 'Em andamento', color: 'bg-warning/10 text-warning border-warning/20', icon: Play },
  concluida: { label: 'Concluída', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
};

interface RouteItem {
  id: string;
  client_id: string;
  client_name: string;
  client_fazenda: string | null;
  client_cidade: string | null;
  client_estado: string | null;
  client_link_maps: string | null;
  status: string;
  checkin_at: string | null;
  checkin_lat: number | null;
  checkin_lon: number | null;
  order_index: number;
}

function getAttendanceStatus(item: RouteItem): AttendanceStatus {
  if (item.status === 'executado') return 'concluida';
  if (item.checkin_at) return 'em_atendimento';
  return 'nao_iniciada';
}

export default function ExecucaoRota() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [checkinItem, setCheckinItem] = useState<RouteItem | null>(null);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ['route-execution', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_routes')
        .select('id, route_code, start_date, end_date, status, field_technician_user_id, notes')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: items, isLoading: itemsLoading } = useQuery<RouteItem[]>({
    queryKey: ['route-execution-items', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_route_items')
        .select('id, client_id, status, checkin_at, checkin_lat, checkin_lon, order_index')
        .eq('route_id', id)
        .order('order_index');

      if (error) throw error;
      if (!data?.length) return [];

      const clientIds = data.map(i => i.client_id);
      const { data: clients } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado, link_maps')
        .in('id', clientIds);

      const clientMap = new Map(clients?.map(c => [c.id, c]) || []);

      return data.map(item => {
        const client = clientMap.get(item.client_id);
        return {
          ...item,
          client_name: client?.nome || 'Cliente desconhecido',
          client_fazenda: client?.fazenda || null,
          client_cidade: client?.cidade || null,
          client_estado: client?.estado || null,
          client_link_maps: client?.link_maps || null,
        };
      });
    },
    enabled: !!id,
  });

  const checkinMutation = useMutation({
    mutationFn: async ({ itemId, lat, lon }: { itemId: string; lat: number | null; lon: number | null }) => {
      const { error } = await supabase
        .from('preventive_route_items')
        .update({
          checkin_at: new Date().toISOString(),
          checkin_lat: lat,
          checkin_lon: lon,
        } as any)
        .eq('id', itemId);

      if (error) throw error;

      if (route?.status === 'planejada') {
        await supabase
          .from('preventive_routes')
          .update({ status: 'em_execucao' })
          .eq('id', id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-execution', id] });
      queryClient.invalidateQueries({ queryKey: ['route-execution-items', id] });
      toast({
        title: 'Check-in realizado!',
        description: 'Registro salvo com sucesso.',
      });
      setCheckinItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao fazer check-in',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCheckinConfirm = (lat: number | null, lon: number | null) => {
    if (!checkinItem) return;
    checkinMutation.mutate({ itemId: checkinItem.id, lat, lon });
  };

  const canAccess = isAdminOrCoordinator || route?.field_technician_user_id === user?.id;

  if (routeLoading || itemsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 font-semibold">Rota não encontrada</h2>
        <Button asChild className="mt-4" size="sm">
          <Link to="/preventivas/minhas-rotas">Voltar</Link>
        </Button>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 font-semibold">Acesso negado</h2>
        <p className="text-sm text-muted-foreground mt-1">Sem permissão para esta rota.</p>
        <Button asChild className="mt-4" size="sm">
          <Link to="/preventivas/minhas-rotas">Voltar</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = routeStatusConfig[route.status as keyof typeof routeStatusConfig];
  const executedCount = items?.filter(i => i.status === 'executado').length || 0;
  const inProgressCount = items?.filter(i => i.checkin_at && i.status !== 'executado').length || 0;
  const totalCount = items?.length || 0;
  const progress = totalCount > 0 ? Math.round((executedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-3 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0 -ml-2">
            <Link to="/preventivas/minhas-rotas">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold truncate">{route.route_code}</h1>
              {statusConfig && (
                <Badge variant="outline" className={`${statusConfig.color} shrink-0 text-xs`}>
                  {statusConfig.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(route.start_date), 'dd/MM', { locale: ptBR })} - {format(parseISO(route.end_date), 'dd/MM', { locale: ptBR })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Summary Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso</span>
            <span className="text-sm font-bold">{progress}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {totalCount - executedCount - inProgressCount} pendentes
            </span>
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3" />
              {inProgressCount} em andamento
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {executedCount} concluídas
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Farms List */}
      <div className="space-y-2">
        {items?.map((item, index) => {
          const attendanceStatus = getAttendanceStatus(item);
          const config = attendanceStatusConfig[attendanceStatus];
          const IconComponent = config.icon;

          return (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Main content area */}
                <div className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Index badge */}
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                      attendanceStatus === 'concluida' 
                        ? 'bg-green-500 text-white' 
                        : attendanceStatus === 'em_atendimento'
                        ? 'bg-warning text-warning-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {attendanceStatus === 'concluida' ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </div>

                    {/* Farm info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm leading-snug">{item.client_name}</p>
                          {(item.client_cidade || item.client_estado) && (
                            <p className="text-xs text-muted-foreground">
                              {[item.client_cidade, item.client_estado].filter(Boolean).join(' - ')}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className={`${config.color} text-xs shrink-0 whitespace-nowrap`}>
                          {config.label}
                        </Badge>
                      </div>

                      {item.checkin_at && (
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Check-in: {format(parseISO(item.checkin_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons - Full width for touch */}
                <div className="flex border-t divide-x">
                  {item.client_link_maps && (
                    <a
                      href={item.client_link_maps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:bg-muted/50 active:bg-muted transition-colors"
                    >
                      <Navigation className="h-4 w-4" />
                      Navegar
                    </a>
                  )}

                  {attendanceStatus === 'nao_iniciada' && (
                    <button
                      onClick={() => setCheckinItem(item)}
                      disabled={checkinMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                      Check-in
                    </button>
                  )}

                  {attendanceStatus === 'em_atendimento' && (
                    <Link
                      to={`/preventivas/execucao/${id}/atendimento/${item.id}`}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-warning hover:bg-warning/5 active:bg-warning/10 transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      Continuar
                    </Link>
                  )}

                  {attendanceStatus === 'concluida' && (
                    <button
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:bg-muted/50 active:bg-muted transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      Ver resumo
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!items || items.length === 0) && (
          <Card>
            <CardContent className="py-8 text-center">
              <MapPin className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma fazenda nesta rota</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Check-in Dialog */}
      <CheckinDialog
        open={!!checkinItem}
        onOpenChange={(open) => !open && setCheckinItem(null)}
        farmName={checkinItem?.client_name || ''}
        farmFazenda={checkinItem?.client_fazenda || undefined}
        onConfirm={handleCheckinConfirm}
        isLoading={checkinMutation.isPending}
      />
    </div>
  );
}
