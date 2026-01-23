import { useState } from 'react'; // v2
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  ArrowLeft,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  Save
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import ChecklistExecution from '@/components/preventivas/ChecklistExecution';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AtendimentoPreventivo() {
  const { routeId, itemId } = useParams<{ routeId: string; itemId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch route item details
  const { data: routeItem, isLoading } = useQuery({
    queryKey: ['route-item-attendance', itemId],
    queryFn: async () => {
      const { data: item, error } = await supabase
        .from('preventive_route_items')
        .select('id, client_id, status, checkin_at, checkin_lat, checkin_lon, order_index, route_id')
        .eq('id', itemId)
        .maybeSingle();

      if (error) throw error;
      if (!item) return null;

      // Fetch route details
      const { data: route } = await supabase
        .from('preventive_routes')
        .select('id, route_code, start_date, field_technician_user_id, checklist_template_id')
        .eq('id', item.route_id)
        .maybeSingle();

      // Fetch client details
      const { data: client } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado')
        .eq('id', item.client_id)
        .maybeSingle();

      // Fetch or find preventive_maintenance record by route_id (unique constraint)
      let preventiveId: string | null = null;
      
      const { data: existingPm } = await supabase
        .from('preventive_maintenance')
        .select('id')
        .eq('client_id', item.client_id)
        .eq('route_id', item.route_id)
        .maybeSingle();

      if (existingPm) {
        preventiveId = existingPm.id;
      } else if (route?.start_date) {
        // Create preventive_maintenance record with route_id (ensures uniqueness)
        const { data: newPm, error: pmError } = await supabase
          .from('preventive_maintenance')
          .insert([{
            client_id: item.client_id,
            route_id: item.route_id,
            scheduled_date: route.start_date,
            status: 'planejada' as const,
            technician_user_id: route.field_technician_user_id,
            notes: `Atendimento via rota ${route.route_code}`,
          }])
          .select('id')
          .single();

        if (!pmError && newPm) {
          preventiveId = newPm.id;
        }
      }

      return {
        ...item,
        route,
        client,
        preventiveId,
      };
    },
    enabled: !!itemId,
  });

  // Complete attendance mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!routeItem) throw new Error('Item não encontrado');

      // Update route item status to executado
      const { error: itemError } = await supabase
        .from('preventive_route_items')
        .update({ status: 'executado' })
        .eq('id', itemId);

      if (itemError) throw itemError;

      // Update preventive_maintenance to concluida
      if (routeItem.preventiveId) {
        const { error: pmError } = await supabase
          .from('preventive_maintenance')
          .update({
            status: 'concluida',
            completed_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', routeItem.preventiveId);

        if (pmError) throw pmError;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-execution', routeId] });
      queryClient.invalidateQueries({ queryKey: ['route-execution-items', routeId] });
      toast({
        title: 'Atendimento concluído!',
        description: 'A fazenda foi marcada como executada.',
      });
      navigate(`/preventivas/execucao/${routeId}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao concluir',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const canAccess = isAdminOrCoordinator || routeItem?.route?.field_technician_user_id === user?.id;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!routeItem) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 font-semibold">Atendimento não encontrado</h2>
        <Button asChild className="mt-4" size="sm">
          <Link to={`/preventivas/execucao/${routeId}`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 font-semibold">Acesso negado</h2>
        <Button asChild className="mt-4" size="sm">
          <Link to="/preventivas/minhas-rotas">Voltar</Link>
        </Button>
      </div>
    );
  }

  const isCompleted = routeItem.status === 'executado';

  return (
    <div className="space-y-4 animate-fade-in pb-40 w-full max-w-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-3 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0 -ml-2">
            <Link to={`/preventivas/execucao/${routeId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{routeItem.client?.nome}</h1>
            {routeItem.client?.fazenda && (
              <p className="text-xs text-muted-foreground truncate">{routeItem.client.fazenda}</p>
            )}
            {isCompleted && (
              <Badge
                variant="outline"
                className="mt-1 inline-flex sm:hidden bg-green-500/10 text-green-600 border-green-500/20"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Concluído
              </Badge>
            )}
          </div>
          {isCompleted && (
            <Badge
              variant="outline"
              className="hidden sm:inline-flex bg-green-500/10 text-green-600 border-green-500/20 shrink-0"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Concluído
            </Badge>
          )}
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {[routeItem.client?.cidade, routeItem.client?.estado].filter(Boolean).join(' - ')}
            </span>
          </div>
          {routeItem.checkin_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                Check-in: {format(parseISO(routeItem.checkin_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardCheck className="h-4 w-4 shrink-0" />
            <span>Rota: {routeItem.route?.route_code}</span>
          </div>
        </CardContent>
      </Card>

      {/* Checklist Execution */}
      {routeItem.preventiveId ? (
        <ChecklistExecution 
          preventiveId={routeItem.preventiveId}
          routeTemplateId={routeItem.route?.checklist_template_id || undefined}
          onComplete={() => setShowCompleteDialog(true)}
        />
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Não foi possível criar o registro de manutenção
            </p>
          </CardContent>
        </Card>
      )}

      {/* Floating Action Bar */}
      {!isCompleted && routeItem.preventiveId && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t safe-area-inset-bottom">
          <div className="flex gap-3 max-w-lg mx-auto">
            <Button 
              variant="outline" 
              className="flex-1"
              asChild
            >
              <Link to={`/preventivas/execucao/${routeId}`}>
                <Save className="h-4 w-4 mr-2" />
                Salvar rascunho
              </Link>
            </Button>
            <Button 
              className="flex-1"
              onClick={() => setShowCompleteDialog(true)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Concluir
            </Button>
          </div>
        </div>
      )}

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso marcará a fazenda como executada na rota. Você poderá visualizar o resumo mas não poderá editar as respostas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
