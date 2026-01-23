import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  ExternalLink,
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

// Item attendance status based on checkin and execution
type AttendanceStatus = 'nao_iniciada' | 'em_atendimento' | 'concluida';

const attendanceStatusConfig: Record<AttendanceStatus, { label: string; color: string; icon: typeof Clock }> = {
  nao_iniciada: { label: 'Não iniciada', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20', icon: Clock },
  em_atendimento: { label: 'Em atendimento', color: 'bg-warning/10 text-warning border-warning/20', icon: Play },
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
  if (item.status === 'executado') {
    return 'concluida';
  }
  if (item.checkin_at) {
    return 'em_atendimento';
  }
  return 'nao_iniciada';
}

export default function ExecucaoRota() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [checkinItem, setCheckinItem] = useState<RouteItem | null>(null);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch route details
  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ['route-execution', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_routes')
        .select('id, route_code, start_date, end_date, status, field_technician_user_id, notes')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch route items with client info
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

  // Check-in mutation
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

      // If route is still "planejada", update to "em_execucao"
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
        description: 'Data, hora e localização registrados com sucesso.',
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

  // Access control: only assigned technician, admin, or coordinator can view
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
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-lg font-semibold">Rota não encontrada</h2>
        <Button asChild className="mt-4">
          <Link to="/preventivas/minhas-rotas">Voltar</Link>
        </Button>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-lg font-semibold">Acesso negado</h2>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta rota.</p>
        <Button asChild className="mt-4">
          <Link to="/preventivas/minhas-rotas">Voltar</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = routeStatusConfig[route.status as keyof typeof routeStatusConfig];
  const executedCount = items?.filter(i => i.status === 'executado').length || 0;
  const totalCount = items?.length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/preventivas/minhas-rotas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{route.route_code}</h1>
            {statusConfig && (
              <Badge variant="outline" className={statusConfig.color}>
                {statusConfig.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(parseISO(route.start_date), 'dd/MM', { locale: ptBR })} - {format(parseISO(route.end_date), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {executedCount} / {totalCount} fazendas
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso da Rota</span>
              <span className="font-medium">{totalCount > 0 ? Math.round((executedCount / totalCount) * 100) : 0}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (executedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Farms List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Fazendas da Rota</h2>
        {items?.map((item, index) => {
          const attendanceStatus = getAttendanceStatus(item);
          const config = attendanceStatusConfig[attendanceStatus];
          const IconComponent = config.icon;

          return (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-medium text-sm shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{item.client_name}</p>
                      {item.client_fazenda && (
                        <p className="text-sm text-muted-foreground truncate">{item.client_fazenda}</p>
                      )}
                      {(item.client_cidade || item.client_estado) && (
                        <p className="text-xs text-muted-foreground">
                          {[item.client_cidade, item.client_estado].filter(Boolean).join(' - ')}
                        </p>
                      )}
                      {item.checkin_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Check-in: {format(parseISO(item.checkin_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant="outline" className={`${config.color} gap-1`}>
                      <IconComponent className="h-3 w-3" />
                      {config.label}
                    </Badge>

                    <div className="flex items-center gap-2">
                      {item.client_link_maps && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={item.client_link_maps} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}

                      {attendanceStatus === 'nao_iniciada' && (
                        <Button
                          size="sm"
                          onClick={() => setCheckinItem(item)}
                          disabled={checkinMutation.isPending}
                        >
                          <Play className="mr-1 h-4 w-4" />
                          Check-in
                        </Button>
                      )}

                      {attendanceStatus === 'em_atendimento' && (
                        <Button size="sm" variant="secondary">
                          <Play className="mr-1 h-4 w-4" />
                          Continuar
                        </Button>
                      )}

                      {attendanceStatus === 'concluida' && (
                        <Button size="sm" variant="outline">
                          <Eye className="mr-1 h-4 w-4" />
                          Ver Resumo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!items || items.length === 0) && (
          <Card>
            <CardContent className="py-8 text-center">
              <MapPin className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">Nenhuma fazenda nesta rota</p>
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
