import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Building2, CalendarDays, User } from "lucide-react";
import InstallationChecklistExecution from "@/components/instalacoes/ChecklistExecution";

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

export default function ExecucaoEtapa() {
  const { stageId } = useParams<{ stageId: string }>();
  const navigate = useNavigate();

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

  const { data: technicianName } = useQuery({
    queryKey: ['installation-technician', stage?.technician_user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', stage.technician_user_id)
        .single();
      if (error) throw error;
      return data?.nome as string;
    },
    enabled: !!stage?.technician_user_id,
    staleTime: 300_000,
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
            <Badge variant={stage.status === 'concluido' ? 'outline' : stage.status === 'em_andamento' ? 'default' : 'secondary'}>
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
            {technicianName && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 shrink-0" />
                {technicianName}
              </span>
            )}
            {stage.planned_date && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {new Date(stage.planned_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <InstallationChecklistExecution
        stageId={stage.id}
        stageTemplateId={stage.checklist_template_id}
      />
    </div>
  );
}
