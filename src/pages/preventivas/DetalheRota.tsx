import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Loader2, 
  ArrowLeft,
  Calendar,
  User,
  Trash2,
  CheckCircle,
  Play,
  Flag
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const routeStatusConfig = {
  planejada: { label: 'Planejada', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  em_execucao: { label: 'Em Execução', color: 'bg-warning/10 text-warning border-warning/20' },
  finalizada: { label: 'Finalizada', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
};

const itemStatusConfig = {
  planejado: { label: 'Planejado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  executado: { label: 'Executado', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  reagendado: { label: 'Reagendado', color: 'bg-warning/10 text-warning border-warning/20' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export default function DetalheRota() {
  const { id } = useParams();
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch route details
  const { data: route, isLoading } = useQuery({
    queryKey: ['preventive-route', id],
    queryFn: async () => {
      const { data: routeData, error: routeError } = await supabase
        .from('preventive_routes')
        .select('*')
        .eq('id', id)
        .single();
      
      if (routeError) throw routeError;

      // Fetch technician profile
      const { data: techProfile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', routeData.field_technician_user_id)
        .single();

      // Fetch route items with client info
      const { data: items, error: itemsError } = await supabase
        .from('preventive_route_items')
        .select('*')
        .eq('route_id', id)
        .order('created_at');
      
      if (itemsError) throw itemsError;

      // Fetch client details
      const clientIds = items?.map(i => i.client_id) || [];
      const { data: clients } = await supabase
        .from('clientes')
        .select('id, nome, fazenda')
        .in('id', clientIds);

      const clientsMap = new Map(clients?.map(c => [c.id, c]) || []);

      return {
        ...routeData,
        technician_name: techProfile?.nome || 'Não encontrado',
        items: items?.map(item => ({
          ...item,
          client_name: clientsMap.get(item.client_id)?.nome || 'Cliente não encontrado',
          client_fazenda: clientsMap.get(item.client_id)?.fazenda || null,
        })) || [],
      };
    },
    enabled: !!id,
  });

  // Update route status
  const updateRouteStatus = useMutation({
    mutationFn: async (newStatus: 'planejada' | 'em_execucao' | 'finalizada') => {
      const { error } = await supabase
        .from('preventive_routes')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-route', id] });
      queryClient.invalidateQueries({ queryKey: ['preventive-routes'] });
      toast({ title: 'Status atualizado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  // Update item status
  const updateItemStatus = useMutation({
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: string }) => {
      const updateData: any = { status: newStatus };
      
      // If marking as executed, create a preventive maintenance record
      if (newStatus === 'executado') {
        const item = route?.items.find(i => i.id === itemId);
        if (item) {
          const { error: pmError } = await supabase
            .from('preventive_maintenance')
            .insert({
              client_id: item.client_id,
              scheduled_date: route?.start_date,
              completed_date: new Date().toISOString().split('T')[0],
              status: 'concluida',
              technician_user_id: route?.field_technician_user_id,
              notes: `Executada na rota ${route?.route_code}`,
            });
          if (pmError) throw pmError;
        }
      }

      const { error } = await supabase
        .from('preventive_route_items')
        .update(updateData)
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-route', id] });
      queryClient.invalidateQueries({ queryKey: ['preventive-overview'] });
      toast({ title: 'Status do item atualizado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  // Delete route
  const deleteRoute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('preventive_routes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-routes'] });
      toast({ title: 'Rota excluída!' });
      navigate('/preventivas/rotas');
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Rota não encontrada.</p>
        <Button className="mt-4" asChild>
          <Link to="/preventivas/rotas">Voltar</Link>
        </Button>
      </div>
    );
  }

  const executedCount = route.items.filter((i: any) => i.status === 'executado').length;
  const totalCount = route.items.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/preventivas/rotas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{route.route_code}</h1>
            <p className="text-muted-foreground">Detalhes da rota preventiva</p>
          </div>
        </div>
        {isAdminOrCoordinator && (
          <div className="flex gap-2">
            {route.status === 'planejada' && (
              <Button 
                variant="outline"
                onClick={() => updateRouteStatus.mutate('em_execucao' as const)}
                disabled={updateRouteStatus.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                Iniciar Execução
              </Button>
            )}
            {route.status === 'em_execucao' && (
              <Button 
                variant="outline"
                onClick={() => updateRouteStatus.mutate('finalizada' as const)}
                disabled={updateRouteStatus.isPending}
              >
                <Flag className="mr-2 h-4 w-4" />
                Finalizar Rota
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir rota?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A rota e todos os seus itens serão removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteRoute.mutate()}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Route Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Período</div>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(route.start_date), 'dd/MM', { locale: ptBR })} - {format(new Date(route.end_date), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Técnico de Campo</div>
            <div className="flex items-center gap-2 mt-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{route.technician_name}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Progresso</div>
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{executedCount} / {totalCount} fazendas</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Status</div>
            <div className="mt-1">
              <Badge variant="outline" className={routeStatusConfig[route.status as keyof typeof routeStatusConfig]?.color}>
                {routeStatusConfig[route.status as keyof typeof routeStatusConfig]?.label}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {route.notes && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Observações</div>
            <p>{route.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fazendas da Rota</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fazenda</TableHead>
                <TableHead>Motivo da Inclusão</TableHead>
                <TableHead>Data Planejada</TableHead>
                <TableHead>Status</TableHead>
                {isAdminOrCoordinator && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {route.items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.client_name}</div>
                      {item.client_fazenda && (
                        <div className="text-sm text-muted-foreground">{item.client_fazenda}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.suggested_reason || '-'}
                  </TableCell>
                  <TableCell>
                    {item.planned_date 
                      ? format(new Date(item.planned_date), 'dd/MM/yyyy', { locale: ptBR })
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={itemStatusConfig[item.status as keyof typeof itemStatusConfig]?.color}>
                      {itemStatusConfig[item.status as keyof typeof itemStatusConfig]?.label}
                    </Badge>
                  </TableCell>
                  {isAdminOrCoordinator && (
                    <TableCell className="text-right">
                      <Select
                        value={item.status}
                        onValueChange={(v) => updateItemStatus.mutate({ itemId: item.id, newStatus: v })}
                        disabled={updateItemStatus.isPending}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planejado">Planejado</SelectItem>
                          <SelectItem value="executado">Executado</SelectItem>
                          <SelectItem value="reagendado">Reagendado</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
