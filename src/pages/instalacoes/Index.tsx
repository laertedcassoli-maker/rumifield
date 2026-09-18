import { useMemo, useRef, useState } from "react";
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
import { HardHat, Plus, Loader2, Play, Settings2, Check, ChevronsUpDown, Building2, CalendarDays, User, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type StageType = 'pre_venda' | 'pre_instalacao' | 'instalacao';

const STAGE_ORDER: StageType[] = ['pre_venda', 'pre_instalacao', 'instalacao'];

const STAGE_LABELS: Record<StageType, string> = {
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

const STAGE_STATUS_VARIANTS: Record<string, 'secondary' | 'default' | 'outline'> = {
  planejado: 'secondary',
  em_andamento: 'default',
  aguardando_aprovacao: 'default',
  concluido: 'outline',
};

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
  const [anexoPreview, setAnexoPreview] = useState<{ url: string; path: string; isImage: boolean } | null>(null);
  const anexoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const visibleInstallations = useMemo(() => {
    if (!installations) return installations;
    if (!etapaFiltro) return installations;
    return installations
      .filter(inst => inst.stages.length === 0 ? canManage : inst.stages.some(s => s.stage === etapaFiltro))
      .map(inst => ({ ...inst, stages: inst.stages.filter(s => s.stage === etapaFiltro) }));
  }, [installations, etapaFiltro, canManage]);

  // Technician names for display
  const technicianIds = Array.from(new Set(
    (installations || []).flatMap(i => i.stages.map(s => s.technician_user_id).filter(Boolean) as string[])
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
      // current filtered view, or Pré Venda when there is no filter active.
      if (data?.id) {
        openStageDialog(data.id, etapaFiltro ?? 'pre_venda');
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
      const payload = {
        technician_user_id: stageTechnicianId || null,
        planned_date: stagePlannedDate || null,
        checklist_template_id: stageTemplateId || null,
      };

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
    setStagePlannedDate(existing?.planned_date || '');
    setStageTemplateId(existing?.checklist_template_id || '');
  };

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
                {inst.stages.length === 0 && canManage && (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    <Settings2 className="h-4 w-4 shrink-0" />
                    <span>Nenhuma etapa configurada ainda — configure a primeira etapa desta instalação.</span>
                  </div>
                )}
                {(etapaFiltro ? [etapaFiltro] : STAGE_ORDER).map((stageType) => {
                  const stage = inst.stages.find(s => s.stage === stageType);
                  return (
                    <div
                      key={stageType}
                      className="flex flex-wrap items-center gap-2 rounded-lg border p-3 min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{STAGE_LABELS[stageType]}</span>
                          {stage && (
                            <Badge variant={STAGE_STATUS_VARIANTS[stage.status] || 'secondary'} className="text-xs">
                              {STAGE_STATUS_LABELS[stage.status] || stage.status}
                            </Badge>
                          )}
                        </div>
                        {stage ? (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                            {stage.technician_user_id && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {technicianNames?.[stage.technician_user_id] || 'Técnico'}
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
                            variant={stage.status === 'concluido' ? 'outline' : 'default'}
                            onClick={() => navigate(`/instalacoes/etapa/${stage.id}`)}
                          >
                            <Play className="h-3.5 w-3.5 mr-1" />
                            {stage.status === 'concluido' ? 'Ver' : 'Executar'}
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openStageDialog(inst.id, stageType, stage)}
                          >
                            <Settings2 className="h-3.5 w-3.5 mr-1" />
                            {stage ? 'Editar' : 'Configurar'}
                          </Button>
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
              Defina o técnico responsável, a data planejada e o template de checklist desta etapa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!stageTechnicianId) {
                  toast.error('Selecione o técnico responsável pela etapa.');
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
