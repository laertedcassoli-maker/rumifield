import { useState, useEffect } from 'react';
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
  LogOut,
  AlertTriangle,
  Play,
  Wrench
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import ChecklistExecution from '@/components/preventivas/ChecklistExecution';
import VisitMediaUpload from '@/components/preventivas/VisitMediaUpload';
import ConsumedPartsBlock from '@/components/preventivas/ConsumedPartsBlock';
import ObservationsBlock from '@/components/preventivas/ObservationsBlock';
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

interface ValidationResult {
  canProceed: boolean;
  blockingErrors: string[];
  warnings: string[];
}

export default function ExecucaoVisitaCorretiva() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getLocation } = useGeolocation();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [selectedResult, setSelectedResult] = useState<'resolvido' | 'parcial' | 'aguardando_peca' | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [checklistStatus, setChecklistStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch visit details
  const { data: visit, isLoading, refetch } = useQuery({
    queryKey: ['corrective-visit-execution', visitId],
    queryFn: async () => {
      const { data: visitData, error } = await supabase
        .from('ticket_visits')
        .select(`
          id,
          visit_code,
          ticket_id,
          client_id,
          field_technician_user_id,
          status,
          planned_start_date,
          checklist_template_id,
          checkin_at,
          checkin_lat,
          checkin_lon,
          checkout_at,
          internal_notes,
          public_notes,
          result,
          visit_summary
        `)
        .eq('id', visitId)
        .maybeSingle();

      if (error) throw error;
      if (!visitData) return null;

      // Fetch ticket details
      const { data: ticket } = await supabase
        .from('technical_tickets')
        .select('id, ticket_code, title')
        .eq('id', visitData.ticket_id)
        .maybeSingle();

      // Fetch client details
      const { data: client } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado')
        .eq('id', visitData.client_id)
        .maybeSingle();

      // Check/create preventive_maintenance record for this visit
      // We'll use route_id = null and link via client_id + created_at
      let preventiveId: string | null = null;

      // Look for existing PM linked to this visit (we'll use a naming convention in notes)
      const { data: existingPm } = await supabase
        .from('preventive_maintenance')
        .select('id, internal_notes, public_notes, public_token')
        .eq('client_id', visitData.client_id)
        .ilike('notes', `%CORR-VISIT-${visitData.id}%`)
        .maybeSingle();

      let internalNotes: string | null = visitData.internal_notes;
      let publicNotes: string | null = visitData.public_notes;
      let publicToken: string | null = null;

      if (existingPm) {
        preventiveId = existingPm.id;
        internalNotes = existingPm.internal_notes || visitData.internal_notes;
        publicNotes = existingPm.public_notes || visitData.public_notes;
        publicToken = existingPm.public_token;
      } else if (visitData.checkin_at) {
        // Create preventive_maintenance record for this corrective visit
        const { data: newPm, error: pmError } = await supabase
          .from('preventive_maintenance')
          .insert([{
            client_id: visitData.client_id,
            scheduled_date: visitData.planned_start_date || new Date().toISOString().split('T')[0],
            status: 'planejada' as const,
            technician_user_id: visitData.field_technician_user_id,
            notes: `Visita Corretiva CORR-VISIT-${visitData.id} - ${ticket?.ticket_code || 'Chamado'}`,
          }])
          .select('id')
          .single();

        if (!pmError && newPm) {
          preventiveId = newPm.id;
        }
      }

      // Check checklist status
      if (preventiveId) {
        const { data: checklist } = await supabase
          .from('preventive_checklists')
          .select('status')
          .eq('preventive_id', preventiveId)
          .maybeSingle();
        
        if (checklist) {
          setChecklistStatus(checklist.status === 'concluido' ? 'completed' : 'in_progress');
        }
      }

      return {
        ...visitData,
        ticket,
        client,
        preventiveId,
        internalNotes,
        publicNotes,
        publicToken,
      };
    },
    enabled: !!visitId,
  });

  // Check-in mutation
  const checkinMutation = useMutation({
    mutationFn: async () => {
      setIsCheckingIn(true);
      let lat: number | null = null;
      let lon: number | null = null;

      try {
        const position = await getLocation();
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      } catch {
        // Continue without geolocation
      }

      const { error } = await supabase
        .from('ticket_visits')
        .update({
          checkin_at: new Date().toISOString(),
          checkin_lat: lat,
          checkin_lon: lon,
          status: 'em_execucao',
        })
        .eq('id', visitId);

      if (error) throw error;

      // Add timeline entry
      await supabase.from('ticket_timeline').insert({
        ticket_id: visit?.ticket_id,
        user_id: user!.id,
        event_type: 'visit_checkin',
        event_description: `Check-in realizado na visita ${visit?.visit_code}`,
      });

      return { lat, lon };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corrective-visit-execution', visitId] });
      toast({
        title: 'Check-in realizado!',
        description: 'Você pode iniciar o atendimento.',
      });
      setIsCheckingIn(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao fazer check-in',
        description: error.message,
        variant: 'destructive',
      });
      setIsCheckingIn(false);
    },
  });

  // Complete visit mutation
  const completeMutation = useMutation({
    mutationFn: async (result: 'resolvido' | 'parcial' | 'aguardando_peca') => {
      if (!visit) throw new Error('Visita não encontrada');

      let lat: number | null = null;
      let lon: number | null = null;

      try {
        const position = await getLocation();
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      } catch {
        // Continue without geolocation
      }

      // Update ticket_visits status to finalizada
      const { error: visitError } = await supabase
        .from('ticket_visits')
        .update({ 
          status: 'finalizada',
          checkout_at: new Date().toISOString(),
          checkout_lat: lat,
          checkout_lon: lon,
          result: result,
        })
        .eq('id', visitId);

      if (visitError) throw visitError;

      // Update preventive_maintenance to concluida
      if (visit.preventiveId) {
        const { error: pmError } = await supabase
          .from('preventive_maintenance')
          .update({
            status: 'concluida',
            completed_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', visit.preventiveId);

        if (pmError) throw pmError;
      }

      // Build result label for timeline
      const resultLabels = {
        resolvido: 'Resolvido',
        parcial: 'Parcialmente resolvido',
        aguardando_peca: 'Aguardando peça'
      };

      // Add timeline entry
      await supabase.from('ticket_timeline').insert({
        ticket_id: visit.ticket_id,
        user_id: user!.id,
        event_type: 'visit_completed',
        event_description: `Visita ${visit.visit_code} concluída - ${resultLabels[result]}`,
      });

      // If result is "resolvido", close the ticket
      if (result === 'resolvido') {
        const { error: ticketError } = await supabase
          .from('technical_tickets')
          .update({ 
            status: 'resolvido',
            resolved_at: new Date().toISOString(),
          })
          .eq('id', visit.ticket_id);

        if (ticketError) throw ticketError;

        // Add timeline entry for ticket resolution
        await supabase.from('ticket_timeline').insert({
          ticket_id: visit.ticket_id,
          user_id: user!.id,
          event_type: 'status_change',
          event_description: 'Chamado encerrado - Problema resolvido na visita',
        });
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['corrective-visit-execution', visitId] });
      queryClient.invalidateQueries({ queryKey: ['my-corrective-visits'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-timeline', visit?.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ['ticket', visit?.ticket_id] });
      
      const messages = {
        resolvido: 'Visita encerrada e chamado resolvido!',
        parcial: 'Visita encerrada como parcialmente resolvida.',
        aguardando_peca: 'Visita encerrada - aguardando peça.'
      };
      
      toast({
        title: messages[result],
        description: result === 'resolvido' 
          ? 'O chamado foi marcado como resolvido.' 
          : 'O chamado permanece aberto para acompanhamento.',
      });
      refetch();
      setSelectedResult(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao encerrar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const canAccess = isAdminOrCoordinator || visit?.field_technician_user_id === user?.id;
  const isVisitCompleted = visit?.status === 'finalizada';
  const hasCheckedIn = !!visit?.checkin_at;
  const canFinishVisit = checklistStatus === 'completed';

  // Validation function for encerrar
  const validateBeforeComplete = async (): Promise<ValidationResult> => {
    const blockingErrors: string[] = [];
    const warnings: string[] = [];

    if (!visit?.preventiveId) {
      return { canProceed: false, blockingErrors: ['Registro de manutenção não encontrado'], warnings: [] };
    }

    // Check for parts without stock source
    const { data: partsWithoutSource } = await supabase
      .from('preventive_part_consumption')
      .select('id, part_name_snapshot')
      .eq('preventive_id', visit.preventiveId)
      .is('stock_source', null);

    if (partsWithoutSource && partsWithoutSource.length > 0) {
      blockingErrors.push(`${partsWithoutSource.length} peça(s) sem origem definida (Técnico/Fazenda)`);
    }

    // Check for at least one media
    const { count: mediaCount } = await supabase
      .from('preventive_visit_media')
      .select('id', { count: 'exact', head: true })
      .eq('preventive_id', visit.preventiveId);

    if (!mediaCount || mediaCount === 0) {
      blockingErrors.push('Nenhuma foto/vídeo anexado');
    }

    // Check for empty observations (warning only)
    const { data: pmData } = await supabase
      .from('preventive_maintenance')
      .select('internal_notes, public_notes')
      .eq('id', visit.preventiveId)
      .maybeSingle();

    const hasInternalNotes = pmData?.internal_notes && pmData.internal_notes.trim().length > 0;
    const hasPublicNotes = pmData?.public_notes && pmData.public_notes.trim().length > 0;

    if (!hasInternalNotes) {
      warnings.push('Observação interna está vazia');
    }
    if (!hasPublicNotes) {
      warnings.push('Observação para relatório está vazia');
    }

    return {
      canProceed: blockingErrors.length === 0,
      blockingErrors,
      warnings,
    };
  };

  const handleEncerrarClick = async () => {
    const result = await validateBeforeComplete();
    setValidationResult(result);

    if (!result.canProceed) {
      toast({
        title: 'Não é possível encerrar',
        description: result.blockingErrors.join('. '),
        variant: 'destructive',
      });
      return;
    }

    if (result.warnings.length > 0) {
      setShowWarningDialog(true);
    } else {
      setShowResultDialog(true);
    }
  };

  const handleResultSelection = (result: 'resolvido' | 'parcial' | 'aguardando_peca') => {
    setSelectedResult(result);
    setShowResultDialog(false);
    setShowCompleteDialog(true);
  };

  const handleProceedAfterWarning = () => {
    setShowWarningDialog(false);
    setShowResultDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="text-center py-12 px-4">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 font-semibold">Visita não encontrada</h2>
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
        <Button asChild className="mt-4" size="sm">
          <Link to="/preventivas/minhas-rotas">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in w-full pb-24">
      {/* Minimal Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/preventivas/minhas-rotas">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs">
              <Wrench className="h-3 w-3 mr-1" />
              CORR
            </Badge>
            {isVisitCompleted && (
              <Badge
                variant="outline"
                className="bg-green-500/10 text-green-600 border-green-500/20"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Encerrada
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{visit.visit_code}</p>
              <h1 className="text-lg font-bold text-foreground">{visit.client?.nome}</h1>
              {visit.client?.fazenda && (
                <p className="text-sm text-muted-foreground -mt-0.5">{visit.client.fazenda}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {[visit.client?.cidade, visit.client?.estado].filter(Boolean).join(' - ')}
            </span>
          </div>

          {visit.ticket && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              <Link 
                to={`/chamados/${visit.ticket_id}`}
                className="hover:text-primary transition-colors"
              >
                Chamado: {visit.ticket.ticket_code}
              </Link>
            </div>
          )}

          {visit.checkin_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                Check-in: {format(parseISO(visit.checkin_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in Section */}
      {!hasCheckedIn && !isVisitCompleted && (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Iniciar Atendimento</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Faça o check-in para registrar o início da visita
                </p>
              </div>
            </div>
            <Button 
              onClick={() => checkinMutation.mutate()}
              disabled={checkinMutation.isPending || isCheckingIn}
              size="lg"
              className="w-full"
            >
              {(checkinMutation.isPending || isCheckingIn) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Play className="h-4 w-4 mr-2" />
              Fazer Check-in
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Content blocks after check-in */}
      {hasCheckedIn && (
        <>
          {/* Checklist Execution Block */}
          {visit.preventiveId ? (
            <ChecklistExecution 
              preventiveId={visit.preventiveId}
              routeTemplateId={visit.checklist_template_id || undefined}
              onStatusChange={(status) => {
                setChecklistStatus(status);
                if (status === 'completed') {
                  refetch();
                }
              }}
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

          {/* Consumed Parts Block */}
          {visit.preventiveId && (
            <ConsumedPartsBlock 
              preventiveId={visit.preventiveId}
              isCompleted={isVisitCompleted}
            />
          )}

          {/* Observations Block */}
          {visit.preventiveId && (
            <ObservationsBlock 
              preventiveId={visit.preventiveId}
              initialInternalNotes={visit.internalNotes}
              initialPublicNotes={visit.publicNotes}
              isCompleted={isVisitCompleted}
            />
          )}

          {/* Media Upload Block */}
          {visit.preventiveId && (
            <VisitMediaUpload 
              preventiveId={visit.preventiveId}
              isCompleted={isVisitCompleted}
            />
          )}

          {/* Share Section - When Visit is Completed */}
          {isVisitCompleted && visit.publicToken && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-foreground">Visita Encerrada</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  A visita corretiva foi concluída com sucesso.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Visit Completed without token */}
          {isVisitCompleted && !visit.publicToken && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-foreground">Visita Encerrada</span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Fixed Footer - Encerrar Visita */}
      {hasCheckedIn && !isVisitCompleted && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto">
            <Button 
              onClick={handleEncerrarClick}
              disabled={!canFinishVisit || completeMutation.isPending}
              className="w-full"
              size="lg"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Encerrar Visita
            </Button>
            {!canFinishVisit && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Conclua o checklist para encerrar a visita
              </p>
            )}
          </div>
        </div>
      )}

      {/* Warning Dialog (observations empty) */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Atenção
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Os seguintes campos estão vazios:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {validationResult?.warnings.map((warning, i) => (
                    <li key={i} className="text-amber-600">{warning}</li>
                  ))}
                </ul>
                <p className="mt-3">Deseja continuar mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e preencher</AlertDialogCancel>
            <AlertDialogAction onClick={handleProceedAfterWarning}>
              Continuar assim mesmo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result Selection Dialog */}
      <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resultado da Visita</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Qual foi o resultado desta visita corretiva?</p>
                <div className="grid gap-2 mt-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 border-green-500/30 hover:bg-green-500/10 hover:border-green-500"
                    onClick={() => handleResultSelection('resolvido')}
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">Resolvido</p>
                      <p className="text-xs text-muted-foreground">Problema solucionado, chamado será encerrado</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500"
                    onClick={() => handleResultSelection('parcial')}
                  >
                    <AlertTriangle className="h-5 w-5 text-amber-500 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">Parcialmente Resolvido</p>
                      <p className="text-xs text-muted-foreground">Requer nova visita, chamado permanece aberto</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500"
                    onClick={() => handleResultSelection('aguardando_peca')}
                  >
                    <Clock className="h-5 w-5 text-blue-500 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">Aguardando Peça</p>
                      <p className="text-xs text-muted-foreground">Peça solicitada, chamado permanece aberto</p>
                    </div>
                  </Button>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar encerramento?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Isso marcará a visita como concluída. Você poderá visualizar o resumo mas não poderá editar as respostas.</p>
                
                {selectedResult && (
                  <div className={`rounded-lg p-3 ${
                    selectedResult === 'resolvido' ? 'bg-green-500/10 border border-green-500/30' :
                    selectedResult === 'parcial' ? 'bg-amber-500/10 border border-amber-500/30' :
                    'bg-blue-500/10 border border-blue-500/30'
                  }`}>
                    <p className="text-xs text-muted-foreground mb-1">Resultado selecionado</p>
                    <p className="font-semibold">
                      {selectedResult === 'resolvido' && '✓ Resolvido - Chamado será encerrado'}
                      {selectedResult === 'parcial' && '⚠ Parcialmente resolvido - Chamado permanece aberto'}
                      {selectedResult === 'aguardando_peca' && '⏳ Aguardando peça - Chamado permanece aberto'}
                    </p>
                  </div>
                )}
                
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Data e hora de encerramento</p>
                  <p className="text-base font-semibold text-foreground">
                    {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedResult(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedResult && completeMutation.mutate(selectedResult)}
              disabled={completeMutation.isPending || !selectedResult}
            >
              {completeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Encerramento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
