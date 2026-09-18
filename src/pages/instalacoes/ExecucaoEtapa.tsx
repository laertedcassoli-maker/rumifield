import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { ArrowLeft, Loader2, Building2, CalendarDays, User, Paperclip, CheckCircle2, Clock } from "lucide-react";
import InstallationChecklistExecution from "@/components/instalacoes/ChecklistExecution";
import { useAnexoPreview } from "@/hooks/useAnexoPreview";
import AnexoPreviewDialog from "@/components/instalacoes/AnexoPreviewDialog";
import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<string, string> = {
  pre_venda: 'Pré Venda',
  pre_instalacao: 'Pré Instalação',
  instalacao: 'Instalação',
};

const STAGE_STATUS_LABELS: Record<string, string> = {
  planejado: 'Planejado',
  em_andamento: 'Em Andamento',
  aguardando_aprovacao: 'Aguardando Aprovação',
  concluido: 'Concluído',
};

const AGUARDANDO_APROVACAO_CLASS = 'bg-amber-500/15 text-amber-700 border-amber-500/30';

export default function ExecucaoEtapa() {
  const { stageId } = useParams<{ stageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const canApprove = role === 'coordenador_servicos' || role === 'admin';

  const [confirmApprove, setConfirmApprove] = useState(false);
  const {
    preview: anexoPreview,
    setPreview: setAnexoPreview,
    handleClick: handleAnexoClick,
    handleDoubleClick: handleAnexoDoubleClick,
  } = useAnexoPreview('instalacao-anexos');

  const { data: stage, isLoading } = useQuery({
    queryKey: ['installation-stage', stageId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('installation_stages')
        .select(`
          id,
          stage,
          status,
          technician_user_id,
          csm_user_id,
          sales_email_attachment_path,
          planned_date,
          checklist_template_id,
          installation:installations(
            id,
            status,
            cliente:clientes(nome, fazenda)
          )
        `)
        .eq('id', stageId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!stageId,
    staleTime: 30_000,
  });

  const responsavelId = stage?.csm_user_id || stage?.technician_user_id || null;
  const isCsm = !!stage?.csm_user_id;

  const { data: responsavelNome } = useQuery({
    queryKey: ['installation-responsavel', responsavelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', responsavelId!)
        .single();
      if (error) throw error;
      return data?.nome as string;
    },
    enabled: !!responsavelId,
    staleTime: 300_000,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .from('installation_stages')
        .update({
          status: 'concluido',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', stageId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('A aprovação não foi confirmada pelo servidor. Verifique suas permissões.');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installation-stage', stageId] });
      queryClient.invalidateQueries({ queryKey: ['installation-stage-type', stageId] });
      queryClient.invalidateQueries({ queryKey: ['installations'] });
      toast.success('Pré Instalação aprovada!');
      setConfirmApprove(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao aprovar: ' + (error?.message || ''));
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!stage) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Etapa não encontrada.</p>
            <Button variant="outline" onClick={() => navigate('/instalacoes')}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar para Instalações
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cliente = stage.installation?.cliente;
  const aguardandoAprovacao = stage.stage === 'pre_instalacao' && stage.status === 'aguardando_aprovacao';

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/instalacoes')} className="shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <h1 className="text-lg font-bold truncate">
              {STAGE_LABELS[stage.stage] || stage.stage}
            </h1>
            <Badge
              variant={stage.status === 'em_andamento' ? 'default' : stage.status === 'planejado' ? 'secondary' : 'outline'}
              className={cn(stage.status === 'aguardando_aprovacao' && AGUARDANDO_APROVACAO_CLASS)}
            >
              {STAGE_STATUS_LABELS[stage.status] || stage.status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {cliente && (
              <span className="flex items-center gap-1.5 min-w-0">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{cliente.nome}{cliente.fazenda ? ` — ${cliente.fazenda}` : ''}</span>
              </span>
            )}
            {responsavelNome && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 shrink-0" />
                {isCsm ? `${responsavelNome} (CSM)` : responsavelNome}
              </span>
            )}
            {stage.planned_date && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {new Date(stage.planned_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>

          {stage.sales_email_attachment_path && (
            <div className="pt-2 space-y-1">
              <p className="text-xs font-medium">E-mail de venda</p>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm hover:bg-muted/50 min-w-0"
                onClick={() => handleAnexoClick(stage.sales_email_attachment_path)}
                onDoubleClick={() => handleAnexoDoubleClick(stage.sales_email_attachment_path)}
              >
                <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate min-w-0">{stage.sales_email_attachment_path.split('/').pop()}</span>
              </button>
              <p className="text-xs text-muted-foreground">
                Um clique abre a pré-visualização; dois cliques abrem em outra guia.
              </p>
            </div>
          )}

          {aguardandoAprovacao && (
            canApprove ? (
              <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t">
                <p className="text-sm text-muted-foreground pt-3">
                  Revise os dados e o e-mail de venda antes de aprovar esta Pré Instalação.
                </p>
                <Button className="mt-3" onClick={() => setConfirmApprove(true)}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Aprovar Pré Instalação
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
                <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Esta Pré Instalação está aguardando revisão do Coordenador de Serviços.</span>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <InstallationChecklistExecution
        stageId={stage.id}
        stageTemplateId={stage.checklist_template_id}
      />

      <AnexoPreviewDialog preview={anexoPreview} onClose={() => setAnexoPreview(null)} />

      <AlertDialog
        open={confirmApprove}
        onOpenChange={(open) => !open && !approveMutation.isPending && setConfirmApprove(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar esta Pré Instalação?</AlertDialogTitle>
            <AlertDialogDescription>
              A etapa passa para <strong>Concluído</strong> com o registro da sua aprovação, liberando a
              configuração da etapa de Instalação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={approveMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                approveMutation.mutate();
              }}
            >
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
