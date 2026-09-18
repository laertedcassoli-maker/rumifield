import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { HardHat, Plus, Loader2, Play, Settings2, Check, ChevronsUpDown, Building2, CalendarDays, User, Trash2, Paperclip, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnexoPreview } from "@/hooks/useAnexoPreview";
import AnexoPreviewDialog from "@/components/instalacoes/AnexoPreviewDialog";


type StageType = 'pre_venda' | 'pre_instalacao' | 'instalacao';

// 'pre_venda' foi removida da UI — permanece no tipo/DB apenas para dados legados
const STAGE_ORDER: StageType[] = ['pre_instalacao', 'instalacao'];

const STAGE_LABELS: Partial<Record<StageType, string>> = {
  pre_instalacao: 'Pré Instalação',
  instalacao: 'Instalação',
};

const STAGE_STATUS_LABELS: Record<string, string> = {
  planejado: 'Planejado',
  em_andamento: 'Em Andamento',
  aguardando_aprovacao: 'Aguardando Aprovação',
  concluido: 'Concluído',
};

const STAGE_STATUS_VARIANTS: Record<string, 'secondary' | 'default' | 'outline'> = {
  planejado: 'secondary',
  em_andamento: 'default',
  aguardando_aprovacao: 'outline',
  concluido: 'outline',
};

// Amber emphasis for the "waiting for approval" state
export const AGUARDANDO_APROVACAO_CLASS = 'bg-amber-500/15 text-amber-700 border-amber-500/30';


interface StageRow {
  id: string;
  stage: StageType;
  status: string;
  technician_user_id: string | null;
  csm_user_id: string | null;
  sales_email_attachment_path: string | null;
  planned_date: string | null;
  checklist_template_id: string | null;
}

interface InstallationRow {
  id: string;
  status: string;
  created_at: string;
  cliente: { nome: string; fazenda: string | null } | null;
  stages: StageRow[];
  /** All stages of the installation, kept when the view filters stages */
  allStages?: StageRow[];
}


type SituacaoInstalacao = 'concluida' | 'pre_instalacao' | 'instalacao' | 'sem_etapa';

// Classificação única usada tanto pelo resumo (contagens) quanto pelo filtro clicável
// — mesma precedência do resumo original: concluída > instalacao > pre_instalacao > sem etapa.
function classificarSituacao(inst: InstallationRow): SituacaoInstalacao {
  if (inst.status === 'concluido') return 'concluida';
  if (inst.stages.some(s => s.stage === 'instalacao')) return 'instalacao';
  if (inst.stages.some(s => s.stage === 'pre_instalacao')) return 'pre_instalacao';
  return 'sem_etapa';
}


export default function InstalacoesIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const isTecnicoCampo = role === 'tecnico_campo';
  const canManage = !isTecnicoCampo;

  // Optional stage filter via URL: /instalacoes?etapa=pre_venda|pre_instalacao|instalacao
  const [searchParams] = useSearchParams();
  const etapaParam = searchParams.get('etapa');
  const etapaFiltro = (STAGE_ORDER as string[]).includes(etapaParam || '')
    ? (etapaParam as StageType)
    : null;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clientePopoverOpen, setClientePopoverOpen] = useState(false);
  const [filtroSituacao, setFiltroSituacao] = useState<'all' | SituacaoInstalacao>('all');

  const [stageDialog, setStageDialog] = useState<{
    installationId: string;
    stage: StageType;
    existing?: StageRow;
  } | null>(null);
  const [instalacaoParaExcluir, setInstalacaoParaExcluir] = useState<InstallationRow | null>(null);
  const [stageTechnicianId, setStageTechnicianId] = useState<string>('');
  const [stageCsmId, setStageCsmId] = useState<string>('');
  const [stageResponsavelTipo, setStageResponsavelTipo] = useState<'tecnico' | 'csm'>('tecnico');
  const [stagePlannedDate, setStagePlannedDate] = useState<string>('');
  const [stageTemplateId, setStageTemplateId] = useState<string>('');
  const [stageAnexoPath, setStageAnexoPath] = useState<string | null>(null);
  const [isUploadingAnexo, setIsUploadingAnexo] = useState(false);
  const {
    preview: anexoPreview,
    setPreview: setAnexoPreview,
    handleClick: handleAnexoClick,
    handleDoubleClick: handleAnexoDoubleClick,
  } = useAnexoPreview('instalacao-anexos');


  // Installations with stages (tecnico_campo sees only installations containing his stages)
  const { data: installations, isLoading } = useQuery<InstallationRow[]>({
    queryKey: ['installations', isTecnicoCampo ? user?.id : 'all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('installations')
        .select(`
          id,
          status,
          created_at,
          cliente:clientes(nome, fazenda),
          stages:installation_stages(id, stage, status, technician_user_id, csm_user_id, sales_email_attachment_path, planned_date, checklist_template_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let rows = (data || []) as InstallationRow[];

      if (isTecnicoCampo && user) {
        rows = rows
          .map(inst => ({
            ...inst,
            stages: (inst.stages || []).filter(s => s.technician_user_id === user.id),
          }))
          .filter(inst => inst.stages.length > 0);
      }

      return rows;
    },
    staleTime: 30_000,
  });

  // Stage-view filter: keep only installations that have the selected stage,
  // and show just that stage row inside each card. Installations with NO stages
  // yet (freshly created, not even the first stage configured) always stay
  // visible for managers so they can never become unreachable in a filtered view.
  // In the "Instalação" view, installations whose Pré Instalação already exists
  // also stay visible so managers can configure (or see the lock on) that stage.
  const visibleInstallations = useMemo(() => {
    if (!installations) return installations;
    let list = installations;
    if (etapaFiltro) {
      list = list.filter(inst => {
        if (inst.stages.length === 0) return canManage;
        if (inst.stages.some(s => s.stage === etapaFiltro)) return true;
        return canManage && etapaFiltro === 'instalacao' && inst.stages.some(s => s.stage === 'pre_instalacao');
      });
    }
    if (filtroSituacao !== 'all') {
      list = list.filter(inst => classificarSituacao(inst) === filtroSituacao);
    }
    return list.map(inst => ({
      ...inst,
      // keep the Pré Instalação row out of the Instalação view, but preserve it
      // in a side field so the lock rule can read its status
      stages: inst.stages.filter(s => !etapaFiltro || s.stage === etapaFiltro),
      allStages: inst.stages,
    }));
  }, [installations, etapaFiltro, canManage, filtroSituacao]);

  // Resumo por situação — usa os dados já carregados (recorte de acesso do usuário,
  // incluindo o filtro de técnico/CSM para tecnico_campo) e IGNORA o filtro ?etapa= da URL.
  // A contagem sempre reflete o total real de cada categoria (não o resultado filtrado).
  const resumo = useMemo(() => {
    const list = installations || [];
    return {
      total: list.length,
      concluidas: list.filter(i => classificarSituacao(i) === 'concluida').length,
      emPreInstalacao: list.filter(i => classificarSituacao(i) === 'pre_instalacao').length,
      emInstalacao: list.filter(i => classificarSituacao(i) === 'instalacao').length,
      semEtapa: list.filter(i => classificarSituacao(i) === 'sem_etapa').length,
    };
  }, [installations]);


  // Responsible names for display (technician or CSM)
  const technicianIds = Array.from(new Set(
    (installations || []).flatMap(i => i.stages.flatMap(s => [s.technician_user_id, s.csm_user_id].filter(Boolean) as string[]))
  ));

  const { data: technicianNames } = useQuery<Record<string, string>>({
    queryKey: ['installation-technician-names', technicianIds.sort().join(',')],
    queryFn: async () => {
      if (technicianIds.length === 0) return {};
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', technicianIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map(p => [p.id, p.nome]));
    },
    enabled: technicianIds.length > 0,
    staleTime: 300_000,
  });

  // Clients for creation combobox
  const { data: clientes } = useQuery({
    queryKey: ['instalacoes-clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: isCreateOpen && canManage,
  });

  // Field technicians for stage assignment (via SECURITY DEFINER RPC — user_roles has restricted RLS)
  const { data: tecnicos } = useQuery<{ user_id: string; nome: string }[]>({
    queryKey: ['pedidos-responsaveis', 'tecnico_campo'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('list_pedidos_responsaveis', { p_role: 'tecnico_campo' });
      if (error) throw error;
      return (data || []) as { user_id: string; nome: string }[];
    },
    enabled: !!stageDialog,
  });

  // CSMs (consultor_rplus) for stage assignment
  const { data: csms } = useQuery<{ user_id: string; nome: string }[]>({
    queryKey: ['pedidos-responsaveis', 'consultor_rplus'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('list_pedidos_responsaveis', { p_role: 'consultor_rplus' });
      if (error) throw error;
      return (data || []) as { user_id: string; nome: string }[];
    },
    enabled: !!stageDialog,
  });

  // Active checklist templates
  const { data: templates } = useQuery({
    queryKey: ['active-checklist-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!stageDialog,
  });

  const createInstallationMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await (supabase as any)
        .from('installations')
        .insert({ cliente_id: clientId })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: { id: string }) => {
      track('installation_created', {}, { entity: 'installation' });
      queryClient.invalidateQueries({ queryKey: ['installations'] });
      toast.success('Instalação criada! Configure as etapas.');
      setIsCreateOpen(false);
      setClienteId(null);
      // Jump straight into configuring the first stage: the one matching the
      // current filtered view, or Pré Instalação when there is no filter active.
      if (data?.id) {
        openStageDialog(data.id, etapaFiltro ?? 'pre_instalacao');
      }
    },
    onError: (error) => {
      toast.error('Erro ao criar instalação: ' + error.message);
    },
  });

  const deleteInstallationMutation = useMutation({
    mutationFn: async (installationId: string) => {
      const { data, error } = await (supabase as any)
        .from('installations')
        .delete()
        .eq('id', installationId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('A exclusão não foi confirmada pelo servidor. Verifique suas permissões e tente novamente.');
      }
      return data;
    },
    onSuccess: () => {
      track('installation_deleted', {}, { entity: 'installation', entity_id: instalacaoParaExcluir?.id });
      queryClient.invalidateQueries({ queryKey: ['installations'] });
      toast.success('Instalação excluída!');
      setInstalacaoParaExcluir(null);
    },
    onError: (error) => {
      toast.error('Erro ao excluir instalação: ' + error.message);
    },
  });

  const saveStageMutation = useMutation({
    mutationFn: async () => {
      if (!stageDialog) return;
      // Exactly one responsible: technician OR CSM, never both
      const payload: Record<string, any> = {
        technician_user_id: stageResponsavelTipo === 'tecnico' ? (stageTechnicianId || null) : null,
        csm_user_id: stageResponsavelTipo === 'csm' ? (stageCsmId || null) : null,
        planned_date: stagePlannedDate || null,
        checklist_template_id: stageTemplateId || null,
      };

      if (stageDialog.stage === 'pre_instalacao') {
        payload.sales_email_attachment_path = stageAnexoPath || null;
      }

      if (stageDialog.existing) {
        const { error } = await (supabase as any)
          .from('installation_stages')
          .update(payload)
          .eq('id', stageDialog.existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('installation_stages')
          .insert({
            installation_id: stageDialog.installationId,
            stage: stageDialog.stage,
            ...payload,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      track('installation_stage_saved', { stage: stageDialog?.stage }, { entity: 'installation_stage', entity_id: stageDialog?.existing?.id });
      queryClient.invalidateQueries({ queryKey: ['installations'] });
      toast.success('Etapa salva!');
      setStageDialog(null);
    },
    onError: (error) => {
      toast.error('Erro ao salvar etapa: ' + error.message);
    },
  });

  const openStageDialog = (installationId: string, stage: StageType, existing?: StageRow) => {
    setStageDialog({ installationId, stage, existing });
    setStageTechnicianId(existing?.technician_user_id || '');
    setStageCsmId(existing?.csm_user_id || '');
    // Instalação is always a técnico's stage — never offer CSM there
    setStageResponsavelTipo(stage !== 'instalacao' && existing?.csm_user_id ? 'csm' : 'tecnico');

    setStagePlannedDate(existing?.planned_date || '');
    setStageTemplateId(existing?.checklist_template_id || '');
    setStageAnexoPath(existing?.sales_email_attachment_path || null);
  };

  // --- Sales e-mail attachment (bucket instalacao-anexos, path <stage_id>/<file>) ---
  const uploadSalesEmail = async (file: File) => {
    const stageId = stageDialog?.existing?.id;
    if (!stageId) {
      toast.error('Salve a etapa antes de anexar o e-mail de venda.');
      return;
    }
    setIsUploadingAnexo(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${stageId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from('instalacao-anexos')
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data, error } = await (supabase as any)
        .from('installation_stages')
        .update({ sales_email_attachment_path: path })
        .eq('id', stageId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('O anexo não foi confirmado pelo servidor. Verifique suas permissões.');
      }

      setStageAnexoPath(path);
      queryClient.invalidateQueries({ queryKey: ['installations'] });
      toast.success('E-mail de venda anexado!');
    } catch (e: any) {
      toast.error('Erro ao anexar: ' + (e?.message || 'falha no envio'));
    } finally {
      setIsUploadingAnexo(false);
    }
  };

  // Preview/open behaviour lives in the shared useAnexoPreview hook


  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <HardHat className="h-6 w-6 text-primary shrink-0" />
          <h1 className="text-xl font-bold truncate">Instalações</h1>
          {etapaFiltro && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {STAGE_LABELS[etapaFiltro]}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nova Instalação
          </Button>
        )}
      </div>

      {(installations && installations.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {([
            { label: 'Total', value: resumo.total },
            { label: 'Concluídas', value: resumo.concluidas },
            { label: 'Em Pré Instalação', value: resumo.emPreInstalacao },
            { label: 'Em Instalação', value: resumo.emInstalacao },
            { label: 'Sem etapa', value: resumo.semEtapa },
          ] as { label: string; value: number }[])
            .filter(r => r.label !== 'Sem etapa' || resumo.semEtapa > 0)
            .map(r => (
              <div
                key={r.label}
                className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs"
              >
                <span className="font-semibold">{r.value}</span>
                <span className="text-muted-foreground">{r.label}</span>
              </div>
            ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !visibleInstallations || visibleInstallations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            {etapaFiltro
              ? `Nenhuma instalação com etapa "${STAGE_LABELS[etapaFiltro]}" encontrada.`
              : isTecnicoCampo
                ? 'Nenhuma etapa de instalação atribuída a você no momento.'
                : 'Nenhuma instalação cadastrada. Crie a primeira para começar.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleInstallations.map((inst) => (
            <Card key={inst.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base min-w-0">
                    <Building2 className="h-5 w-5 text-primary shrink-0" />
                    <span className="truncate">{inst.cliente?.nome || 'Cliente'}</span>
                    {inst.cliente?.fazenda && (
                      <span className="text-sm font-normal text-muted-foreground truncate">
                        — {inst.cliente.fazenda}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={inst.status === 'concluido' ? 'outline' : 'secondary'}>
                      {inst.status === 'concluido' ? 'Concluída' : 'Em Andamento'}
                    </Badge>
                    {canManage && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Excluir instalação de ${inst.cliente?.nome || 'cliente'}`}
                        onClick={() => setInstalacaoParaExcluir(inst)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(inst.allStages ?? inst.stages).length === 0 && canManage && (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    <Settings2 className="h-4 w-4 shrink-0" />
                    <span>Nenhuma etapa configurada ainda — configure a primeira etapa desta instalação.</span>
                  </div>
                )}
                {(etapaFiltro ? [etapaFiltro] : STAGE_ORDER).map((stageType) => {
                  const stage = inst.stages.find(s => s.stage === stageType);
                  const isReadOnlyStage = !!stage && ['concluido', 'aguardando_aprovacao'].includes(stage.status);
                  const preInstalacaoStage = (inst.allStages ?? inst.stages).find(s => s.stage === 'pre_instalacao');
                  // Instalação can only be configured after Pré Instalação is approved
                  const instalacaoBloqueada =
                    stageType === 'instalacao' && preInstalacaoStage?.status !== 'concluido';

                  return (
                    <div
                      key={stageType}
                      className="flex flex-wrap items-center gap-2 rounded-lg border p-3 min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{STAGE_LABELS[stageType]}</span>
                          {stage && (
                            <Badge
                              variant={STAGE_STATUS_VARIANTS[stage.status] || 'secondary'}
                              className={cn('text-xs', stage.status === 'aguardando_aprovacao' && AGUARDANDO_APROVACAO_CLASS)}
                            >
                              {STAGE_STATUS_LABELS[stage.status] || stage.status}
                            </Badge>
                          )}
                        </div>

                        {stage ? (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                            {(stage.technician_user_id || stage.csm_user_id) && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {stage.csm_user_id
                                  ? `${technicianNames?.[stage.csm_user_id] || 'CSM'} (CSM)`
                                  : (technicianNames?.[stage.technician_user_id!] || 'Técnico')}
                              </span>
                            )}
                            {stage.planned_date && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {new Date(stage.planned_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">Etapa não configurada</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {stage && (
                          <Button
                            size="sm"
                            variant={isReadOnlyStage ? 'outline' : 'default'}
                            onClick={() => navigate(`/instalacoes/etapa/${stage.id}`)}
                          >
                            <Play className="h-3.5 w-3.5 mr-1" />
                            {isReadOnlyStage ? 'Ver' : 'Executar'}
                          </Button>
                        )}
                        {canManage && (
                          instalacaoBloqueada ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="h-3.5 w-3.5 shrink-0" />
                              {preInstalacaoStage ? 'Aguardando aprovação da Pré Instalação' : 'Configure a Pré Instalação primeiro'}
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openStageDialog(inst.id, stageType, stage)}
                            >
                              <Settings2 className="h-3.5 w-3.5 mr-1" />
                              {stage ? 'Editar' : 'Configurar'}
                            </Button>
                          )
                        )}
                      </div>

                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create installation dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Instalação</DialogTitle>
            <DialogDescription>
              Selecione o cliente para iniciar o processo de instalação (pré-venda, pré-instalação e instalação).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  <span className="truncate">
                    {clienteId
                      ? (() => {
                          const c = clientes?.find(c => c.id === clienteId);
                          return c ? `${c.nome}${c.fazenda ? ` — ${c.fazenda}` : ''}` : 'Selecione o cliente';
                        })()
                      : 'Selecione o cliente'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {clientes?.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.nome} ${c.fazenda || ''}`}
                          onSelect={() => {
                            setClienteId(c.id);
                            setClientePopoverOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", clienteId === c.id ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{c.nome}{c.fazenda ? ` — ${c.fazenda}` : ''}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!clienteId) {
                  toast.error('Selecione um cliente para criar a instalação.');
                  return;
                }
                createInstallationMutation.mutate(clienteId);
              }}
              disabled={createInstallationMutation.isPending}
            >
              {createInstallationMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage management dialog */}
      <Dialog open={!!stageDialog} onOpenChange={(open) => !open && setStageDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {stageDialog?.existing ? 'Editar' : 'Configurar'} etapa: {stageDialog ? STAGE_LABELS[stageDialog.stage] : ''}
            </DialogTitle>
            <DialogDescription>
              {stageDialog?.stage === 'instalacao'
                ? 'Defina o técnico responsável, a data planejada e o template de checklist desta etapa.'
                : 'Defina o responsável (técnico ou CSM), a data planejada e o template de checklist desta etapa.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de responsável</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={stageResponsavelTipo === 'tecnico' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStageResponsavelTipo('tecnico'); setStageCsmId(''); }}
                >
                  Técnico
                </Button>
                {/* Instalação is always executed by a técnico, never a CSM */}
                {stageDialog?.stage !== 'instalacao' && (
                <Button
                  type="button"
                  variant={stageResponsavelTipo === 'csm' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStageResponsavelTipo('csm'); setStageTechnicianId(''); }}
                >
                  CSM
                </Button>
                )}
              </div>

            </div>
            {stageResponsavelTipo === 'tecnico' ? (
              <div className="space-y-2">
                <Label>Técnico responsável</Label>
                <Select value={stageTechnicianId} onValueChange={setStageTechnicianId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o técnico" />
                  </SelectTrigger>
                  <SelectContent>
                    {tecnicos?.map(t => (
                      <SelectItem key={t.user_id} value={t.user_id}>{t.nome}</SelectItem>
                    ))}
                    {tecnicos?.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground">Nenhum técnico de campo ativo.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>CSM responsável</Label>
                <Select value={stageCsmId} onValueChange={setStageCsmId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o CSM" />
                  </SelectTrigger>
                  <SelectContent>
                    {csms?.map(c => (
                      <SelectItem key={c.user_id} value={c.user_id}>{c.nome}</SelectItem>
                    ))}
                    {csms?.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground">Nenhum CSM ativo.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Data planejada</Label>
              <Input
                type="date"
                value={stagePlannedDate}
                onChange={(e) => setStagePlannedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Template de checklist</Label>
              <Select value={stageTemplateId} onValueChange={setStageTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sales e-mail attachment — Pré Instalação only */}
            {stageDialog?.stage === 'pre_instalacao' && (
              <div className="space-y-2">
                <Label>E-mail de venda (opcional)</Label>
                {stageAnexoPath ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm hover:bg-muted/50 min-w-0"
                    onClick={() => handleAnexoClick(stageAnexoPath)}
                    onDoubleClick={() => handleAnexoDoubleClick(stageAnexoPath)}
                  >
                    <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate min-w-0">{stageAnexoPath.split('/').pop()}</span>
                  </button>
                ) : null}
                {stageDialog?.existing ? (
                  <>
                    <Input
                      type="file"
                      disabled={isUploadingAnexo}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) uploadSalesEmail(file);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {isUploadingAnexo
                        ? 'Enviando anexo...'
                        : 'Um clique no anexo abre a pré-visualização; dois cliques abrem em outra guia.'}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Salve a etapa primeiro para poder anexar o e-mail de venda.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (stageResponsavelTipo === 'tecnico' && !stageTechnicianId) {
                  toast.error('Selecione o técnico responsável pela etapa.');
                  return;
                }
                if (stageResponsavelTipo === 'csm' && !stageCsmId) {
                  toast.error('Selecione o CSM responsável pela etapa.');
                  return;
                }
                saveStageMutation.mutate();
              }}
              disabled={saveStageMutation.isPending}
            >
              {saveStageMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales e-mail attachment inline preview */}
      <AnexoPreviewDialog preview={anexoPreview} onClose={() => setAnexoPreview(null)} />


      {/* Delete installation confirmation */}
      <AlertDialog open={!!instalacaoParaExcluir} onOpenChange={(open) => !open && !deleteInstallationMutation.isPending && setInstalacaoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir instalação permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível e remove a instalação de{' '}
              <strong>{instalacaoParaExcluir?.cliente?.nome || 'cliente'}</strong> junto com{' '}
              <strong>todas as suas etapas, checklists respondidos e consumo de peças</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInstallationMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteInstallationMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (instalacaoParaExcluir) {
                  deleteInstallationMutation.mutate(instalacaoParaExcluir.id);
                }
              }}
            >
              {deleteInstallationMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
