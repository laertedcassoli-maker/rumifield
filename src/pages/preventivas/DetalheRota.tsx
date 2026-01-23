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
  Flag,
  FileCheck,
  ClipboardList,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const routeStatusConfig = {
  em_elaboracao: { label: 'Em Elaboração', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
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

      // Fetch technician profile and checklist template in parallel
      const [techProfileResult, templateResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('nome')
          .eq('id', routeData.field_technician_user_id)
          .single(),
        routeData.checklist_template_id
          ? supabase
              .from('checklist_templates')
              .select('id, name, description')
              .eq('id', routeData.checklist_template_id)
              .single()
          : Promise.resolve({ data: null })
      ]);

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
        .select('id, nome, fazenda, link_maps')
        .in('id', clientIds);

      const clientsMap = new Map(clients?.map(c => [c.id, c]) || []);

      return {
        ...routeData,
        technician_name: techProfileResult.data?.nome || 'Não encontrado',
        checklist_template: templateResult.data,
        items: items?.map(item => ({
          ...item,
          client_name: clientsMap.get(item.client_id)?.nome || 'Cliente não encontrado',
          client_fazenda: clientsMap.get(item.client_id)?.fazenda || null,
          client_link_maps: clientsMap.get(item.client_id)?.link_maps || null,
        })) || [],
      };
    },
    enabled: !!id,
  });

  // Fetch active checklist templates for editing
  const { data: checklistTemplates } = useQuery({
    queryKey: ['active-checklist-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name, description')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: route?.status === 'em_elaboracao',
  });

  // Update route status
  const updateRouteStatus = useMutation({
    mutationFn: async (newStatus: 'em_elaboracao' | 'planejada' | 'em_execucao' | 'finalizada') => {
      // If finalizing planning (em_elaboracao -> planejada), create preventive_maintenance records
      if (newStatus === 'planejada' && route?.status === 'em_elaboracao') {
        // Validate checklist is set
        if (!route?.checklist_template_id) {
          throw new Error('Selecione um template de checklist antes de finalizar o planejamento.');
        }

        // Create preventive_maintenance records for calendar visibility
        const preventiveRecords = route.items.map((item: any) => ({
          client_id: item.client_id,
          scheduled_date: route.start_date,
          status: 'planejada' as const,
          technician_user_id: route.field_technician_user_id,
          notes: `Planejada na rota ${route.route_code}`,
        }));

        const { error: pmError } = await supabase
          .from('preventive_maintenance')
          .insert(preventiveRecords);

        if (pmError) throw pmError;
      }

      const { error } = await supabase
        .from('preventive_routes')
        .update({ status: newStatus } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['preventive-route', id] });
      queryClient.invalidateQueries({ queryKey: ['preventive-routes'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-preventives'] });
      const message = newStatus === 'planejada' 
        ? 'Planejamento finalizado! A rota está pronta para execução.'
        : 'Status atualizado!';
      toast({ title: message });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  // Update checklist template
  const updateChecklistTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('preventive_routes')
        .update({ checklist_template_id: templateId } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-route', id] });
      toast({ title: 'Template de checklist atualizado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  // Update item status
  const updateItemStatus = useMutation({
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: string }) => {
      const updateData: any = { status: newStatus };
      const item = route?.items.find(i => i.id === itemId);
      
      if (item) {
        // Find existing preventive_maintenance record for this client in this route's date range
        const { data: existingPm } = await supabase
          .from('preventive_maintenance')
          .select('id')
          .eq('client_id', item.client_id)
          .eq('scheduled_date', route?.start_date)
          .in('status', ['planejada', 'concluida'])
          .limit(1)
          .single();

        if (newStatus === 'executado') {
          if (existingPm) {
            // Update existing record to concluida
            const { error: pmError } = await supabase
              .from('preventive_maintenance')
              .update({
                completed_date: new Date().toISOString().split('T')[0],
                status: 'concluida',
                notes: `Executada na rota ${route?.route_code}`,
              })
              .eq('id', existingPm.id);
            if (pmError) throw pmError;
          } else {
            // Create new record if none exists (legacy routes without auto-creation)
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
        } else if (newStatus === 'planejado' && existingPm) {
          // Revert to planejada if changing back from executado
          const { error: pmError } = await supabase
            .from('preventive_maintenance')
            .update({
              completed_date: null,
              status: 'planejada',
              notes: `Planejada na rota ${route?.route_code}`,
            })
            .eq('id', existingPm.id);
          if (pmError) throw pmError;
        } else if (newStatus === 'cancelado' && existingPm) {
          // Mark as canceled
          const { error: pmError } = await supabase
            .from('preventive_maintenance')
            .update({
              status: 'cancelada',
              notes: `Cancelada na rota ${route?.route_code}`,
            })
            .eq('id', existingPm.id);
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
      queryClient.invalidateQueries({ queryKey: ['calendar-preventives'] });
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
            {route.status === 'em_elaboracao' && (
              <Button 
                onClick={() => updateRouteStatus.mutate('planejada' as const)}
                disabled={updateRouteStatus.isPending || !route.checklist_template_id}
              >
                <FileCheck className="mr-2 h-4 w-4" />
                Finalizar Planejamento
              </Button>
            )}
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

      {/* Checklist Template Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Template de Checklist</div>
                {route.checklist_template ? (
                  <div className="font-medium">{route.checklist_template.name}</div>
                ) : (
                  <div className="text-destructive text-sm">Nenhum template selecionado</div>
                )}
                {route.checklist_template?.description && (
                  <div className="text-xs text-muted-foreground">{route.checklist_template.description}</div>
                )}
              </div>
            </div>
            {isAdminOrCoordinator && route.status === 'em_elaboracao' && (
              <Select
                value={route.checklist_template_id || ''}
                onValueChange={(v) => updateChecklistTemplate.mutate(v)}
                disabled={updateChecklistTemplate.isPending}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Selecione um checklist" />
                </SelectTrigger>
                <SelectContent>
                  {checklistTemplates?.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {route.status !== 'em_elaboracao' && route.checklist_template && (
              <Badge variant="outline" className="bg-primary/10 text-primary">
                Definido
              </Badge>
            )}
          </div>
          {route.status === 'em_elaboracao' && !route.checklist_template_id && (
            <p className="text-xs text-destructive mt-2">
              ⚠️ Selecione um template de checklist para poder finalizar o planejamento.
            </p>
          )}
        </CardContent>
      </Card>

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
                <TableHead>Localização</TableHead>
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
                  <TableCell>
                    {item.client_link_maps ? (
                      <a 
                        href={item.client_link_maps} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                      >
                        <MapPin className="h-3 w-3" />
                        Ver no Maps
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
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
