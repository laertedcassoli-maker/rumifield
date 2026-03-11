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
  AlertCircle,
  Share2,
  XCircle,
  WifiOff
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { CheckinDialog } from '@/components/preventivas/CheckinDialog';
import { CancelarVisitaDialog } from '@/components/preventivas/CancelarVisitaDialog';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { offlineDb } from '@/lib/offline-db';

const ONLINE_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('__timeout__')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message === '__timeout__' || err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch');
  }
  return false;
}

const routeStatusConfig = {
  planejada: { label: 'Planejada', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  em_execucao: { label: 'Em Execução', color: 'bg-warning/10 text-warning border-warning/20' },
  finalizada: { label: 'Finalizada', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
};

type AttendanceStatus = 'nao_iniciada' | 'em_atendimento' | 'concluida' | 'cancelada';

const attendanceStatusConfig: Record<AttendanceStatus, { label: string; color: string; icon: typeof Clock }> = {
  nao_iniciada: { label: 'Pendente', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20', icon: Clock },
  em_atendimento: { label: 'Em andamento', color: 'bg-warning/10 text-warning border-warning/20', icon: Play },
  concluida: { label: 'Concluída', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
};

interface RouteItem {
  id: string;
  client_id: string;
  client_name: string;
  client_fazenda: string | null;
  client_cidade: string | null;
  client_estado: string | null;
  client_link_maps: string | null;
  client_latitude: number | null;
  client_longitude: number | null;
  status: string;
  checkin_at: string | null;
  checkin_lat: number | null;
  checkin_lon: number | null;
  order_index: number;
  public_token: string | null;
}

function getAttendanceStatus(item: RouteItem): AttendanceStatus {
  if (item.status === 'cancelado') return 'cancelada';
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
  const [cancelItem, setCancelItem] = useState<RouteItem | null>(null);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  const { data: route, isLoading: routeLoading, isOfflineData: isRouteOffline, refetchOffline: refetchRouteOffline, isOnline } = useOfflineQuery({
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
    offlineFn: async () => {
      const rota = await offlineDb.rotas.get(id!);
      if (!rota) return null;
      return {
        id: rota.id,
        route_code: rota.route_code,
        start_date: rota.start_date,
        end_date: rota.end_date,
        status: rota.status,
        field_technician_user_id: rota.field_technician_user_id,
        notes: rota.notes,
      };
    },
    enabled: !!id,
  });

  const { data: items, isLoading: itemsLoading, isOfflineData: isItemsOffline, refetchOffline: refetchItemsOffline } = useOfflineQuery<RouteItem[]>({
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
        .select('id, nome, fazenda, cidade, estado, link_maps, latitude, longitude')
        .in('id', clientIds);

      // Fetch public tokens for completed items
      const { data: preventives } = await supabase
        .from('preventive_maintenance')
        .select('client_id, public_token')
        .eq('route_id', id)
        .not('public_token', 'is', null);

      const clientMap = new Map(clients?.map(c => [c.id, c]) || []);
      const tokenMap = new Map(preventives?.map(p => [p.client_id, p.public_token]) || []);

      return data.map(item => {
        const client = clientMap.get(item.client_id);
        return {
          ...item,
          client_name: client?.nome || 'Cliente desconhecido',
          client_fazenda: client?.fazenda || null,
          client_cidade: client?.cidade || null,
          client_estado: client?.estado || null,
          client_link_maps: client?.link_maps || null,
          client_latitude: client?.latitude ?? null,
          client_longitude: client?.longitude ?? null,
          public_token: tokenMap.get(item.client_id) || null,
        };
      });
    },
    offlineFn: async () => {
      const rotaItems = await offlineDb.rota_items
        .filter(i => i.route_id === id!)
        .sortBy('order_index');

      if (!rotaItems.length) return [];

      const allClients = await offlineDb.clientes.toArray();
      const clientsMap = new Map(allClients.map(c => [c.id, c]));

      return rotaItems.map(item => {
        const client = clientsMap.get(item.client_id);
        return {
          id: item.id,
          client_id: item.client_id,
          client_name: client?.nome || item.client_name || 'Cliente desconhecido',
          client_fazenda: client?.fazenda || item.client_fazenda || null,
          client_cidade: client?.cidade || item.client_cidade || null,
          client_estado: client?.estado || item.client_estado || null,
          client_link_maps: client?.link_maps || item.client_link_maps || null,
          client_latitude: client?.latitude ?? item.client_lat ?? null,
          client_longitude: client?.longitude ?? item.client_lon ?? null,
          status: item.status,
          checkin_at: item.checkin_at || null,
          checkin_lat: item.checkin_lat ?? null,
          checkin_lon: item.checkin_lon ?? null,
          order_index: item.order_index || 0,
          public_token: null, // Not available offline
        };
      });
    },
    enabled: !!id,
  });

  const isOffline = isRouteOffline || isItemsOffline;

  // Offline helper for checkin
  const checkinOffline = async (itemId: string, lat: number | null, lon: number | null, now: string) => {
    await offlineDb.rota_items.update(itemId, {
      checkin_at: now,
      checkin_lat: lat,
      checkin_lon: lon,
    });
    await offlineDb.addToSyncQueue('preventive_route_items', 'update', {
      id: itemId,
      checkin_at: now,
      checkin_lat: lat,
      checkin_lon: lon,
    });
    if (route?.status === 'planejada') {
      await offlineDb.rotas.update(id!, { status: 'em_execucao' });
      await offlineDb.addToSyncQueue('preventive_routes', 'update', {
        id: id,
        status: 'em_execucao',
      });
    }
  };

  const checkinMutation = useMutation({
    mutationFn: async ({ itemId, lat, lon }: { itemId: string; lat: number | null; lon: number | null }) => {
      const now = new Date().toISOString();

      // Fast path: known offline flags
      if (isOffline || !isOnline) {
        await checkinOffline(itemId, lat, lon, now);
        return;
      }

      // Real connectivity probe (2s timeout)
      const reallyOnline = await isReallyOnline();
      if (!reallyOnline) {
        console.log('[checkin] Probe detected offline, using local storage');
        await checkinOffline(itemId, lat, lon, now);
        toast({
          title: 'Salvo localmente',
          description: 'Sem conexão — o check-in será sincronizado automaticamente.',
        });
        return;
      }

      try {
        const updatePromise = (async () => {
          const { error } = await supabase
            .from('preventive_route_items')
            .update({
              checkin_at: now,
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
        })();

        await withTimeout(updatePromise, ONLINE_TIMEOUT_MS);
      } catch (err) {
        console.warn('[checkin] Online attempt failed, falling back to offline:', err);
        await checkinOffline(itemId, lat, lon, now);
        toast({
          title: 'Salvo localmente',
          description: 'Sem conexão — o check-in será sincronizado automaticamente.',
        });
        return;
      }
    },
    onSuccess: () => {
      // Always refetch from offline DB to ensure UI updates immediately
      refetchRouteOffline();
      refetchItemsOffline();
      // Also invalidate queries as bonus when online
      if (!isOffline && isOnline) {
        queryClient.invalidateQueries({ queryKey: ['route-execution', id] });
        queryClient.invalidateQueries({ queryKey: ['route-execution-items', id] });
      }
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

  // Offline helper for cancel
  const cancelOffline = async (itemId: string, clientId: string, justification: string) => {
    await offlineDb.rota_items.update(itemId, { status: 'cancelado' });
    await offlineDb.addToSyncQueue('preventive_route_items', 'update', {
      id: itemId,
      status: 'cancelado',
    });
    await offlineDb.addToSyncQueue('preventive_maintenance_cancel', 'insert', {
      client_id: clientId,
      route_id: id,
      scheduled_date: route?.start_date || new Date().toISOString().split('T')[0],
      status: 'cancelada',
      notes: justification,
      technician_user_id: route?.field_technician_user_id,
    });
  };

  // Cancel visit mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ itemId, clientId, justification }: { itemId: string; clientId: string; justification: string }) => {
      // Fast path: known offline flags
      if (isOffline || !isOnline) {
        await cancelOffline(itemId, clientId, justification);
        return;
      }

      // Real connectivity probe (2s timeout)
      const reallyOnline = await isReallyOnline();
      if (!reallyOnline) {
        console.log('[cancel] Probe detected offline, using local storage');
        await cancelOffline(itemId, clientId, justification);
        toast({
          title: 'Salvo localmente',
          description: 'Sem conexão — o cancelamento será sincronizado automaticamente.',
        });
        return;
      }

      try {
        const cancelPromise = (async () => {
          const { error: itemError } = await supabase
            .from('preventive_route_items')
            .update({ status: 'cancelado' } as any)
            .eq('id', itemId);
          if (itemError) throw itemError;

          const { data: existingMaint } = await supabase
            .from('preventive_maintenance')
            .select('id')
            .eq('client_id', clientId)
            .eq('route_id', id)
            .maybeSingle();

          if (existingMaint) {
            await supabase
              .from('preventive_maintenance')
              .update({ 
                status: 'cancelada',
                notes: justification,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingMaint.id);
          } else {
            await supabase
              .from('preventive_maintenance')
              .insert({
                client_id: clientId,
                route_id: id,
                scheduled_date: route?.start_date || new Date().toISOString().split('T')[0],
                status: 'cancelada',
                notes: justification,
                technician_user_id: route?.field_technician_user_id
              });
          }

          const { data: allItems } = await supabase
            .from('preventive_route_items')
            .select('status')
            .eq('route_id', id);

          const allDone = allItems?.every(i => i.status === 'executado' || i.status === 'cancelado');
          if (allDone && allItems && allItems.length > 0) {
            await supabase
              .from('preventive_routes')
              .update({ status: 'finalizada' })
              .eq('id', id);
          }
        })();

        await withTimeout(cancelPromise, ONLINE_TIMEOUT_MS);
      } catch (err) {
        console.warn('[cancel] Online attempt failed, falling back to offline:', err);
        await cancelOffline(itemId, clientId, justification);
        toast({
          title: 'Salvo localmente',
          description: 'Sem conexão — o cancelamento será sincronizado automaticamente.',
        });
        return;
      }
    },
    onSuccess: () => {
      refetchRouteOffline();
      refetchItemsOffline();
      if (!isOffline && isOnline) {
        queryClient.invalidateQueries({ queryKey: ['route-execution', id] });
        queryClient.invalidateQueries({ queryKey: ['route-execution-items', id] });
      }
      toast({
        title: 'Visita cancelada',
        description: 'O cancelamento foi registrado.',
      });
      setCancelItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao cancelar visita',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCheckinConfirm = (lat: number | null, lon: number | null) => {
    if (!checkinItem) return;
    checkinMutation.mutate({ itemId: checkinItem.id, lat, lon });
  };

  const handleCancelConfirm = (justification: string) => {
    if (!cancelItem) return;
    cancelMutation.mutate({ itemId: cancelItem.id, clientId: cancelItem.client_id, justification });
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
  const cancelledCount = items?.filter(i => i.status === 'cancelado').length || 0;
  const inProgressCount = items?.filter(i => i.checkin_at && i.status !== 'executado' && i.status !== 'cancelado').length || 0;
  const totalCount = items?.length || 0;
  const completedCount = executedCount + cancelledCount;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
              {isOffline && (
                <Badge variant="outline" className="gap-1 text-xs bg-amber-500/10 text-amber-600 border-amber-500/20 shrink-0">
                  <WifiOff className="h-3 w-3" />
                  Offline
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
              {totalCount - completedCount - inProgressCount} pendentes
            </span>
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3" />
              {inProgressCount} em andamento
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {executedCount} concluídas
            </span>
            {cancelledCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-3 w-3" />
                {cancelledCount} canceladas
              </span>
            )}
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
                  {(() => {
                    const mapsUrl = item.client_link_maps
                      || (item.client_latitude != null && item.client_longitude != null
                        ? `https://www.google.com/maps?q=${item.client_latitude},${item.client_longitude}`
                        : null);
                    return mapsUrl ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:bg-muted/50 active:bg-muted transition-colors"
                      >
                        <Navigation className="h-4 w-4" />
                        Navegar
                      </a>
                    ) : null;
                  })()}

                  {attendanceStatus === 'nao_iniciada' && (
                    <>
                      <button
                        onClick={() => setCancelItem(item)}
                        disabled={cancelMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-destructive hover:bg-destructive/5 active:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancelar
                      </button>
                      <button
                        onClick={() => setCheckinItem(item)}
                        disabled={checkinMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        <Play className="h-4 w-4" />
                        Check-in
                      </button>
                    </>
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
                    <>
                      <Link
                        to={`/preventivas/execucao/${id}/atendimento/${item.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:bg-muted/50 active:bg-muted transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        Ver resumo
                      </Link>
                      {item.public_token && (
                        <button
                          onClick={async () => {
                            const baseUrl = window.location.hostname.includes('lovableproject.com') 
                              ? 'https://rumifield.lovable.app' 
                              : window.location.origin;
                            const url = `${baseUrl}/relatorio/${item.public_token}`;
                            const shareData = {
                              title: `Relatório - ${item.client_name}`,
                              text: `Confira o relatório da visita preventiva: ${url}`,
                              url
                            };
                            
                            const canNativeShare = typeof navigator.share === 'function' && 
                              (!navigator.canShare || navigator.canShare(shareData));
                            
                            if (canNativeShare) {
                              try {
                                await navigator.share(shareData);
                                return;
                              } catch (err) {
                                if ((err as Error).name === 'AbortError') return;
                              }
                            }
                            
                            try {
                              await navigator.clipboard.writeText(url);
                              toast({ title: 'Link copiado!', description: 'Cole no WhatsApp para enviar' });
                            } catch {
                              toast({ title: 'Link do relatório', description: url });
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:bg-muted/50 active:bg-muted transition-colors"
                        >
                          <Share2 className="h-4 w-4" />
                          Compartilhar
                        </button>
                      )}
                    </>
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
        routeStartDate={route?.start_date}
      />

      {/* Cancel Dialog */}
      <CancelarVisitaDialog
        open={!!cancelItem}
        onOpenChange={(open) => !open && setCancelItem(null)}
        farmName={cancelItem?.client_name || ''}
        farmFazenda={cancelItem?.client_fazenda || undefined}
        onConfirm={handleCancelConfirm}
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
