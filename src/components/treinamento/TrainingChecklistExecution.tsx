import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, CloudOff, GraduationCap, Loader2 } from 'lucide-react';
import { useOfflineTrainingChecklist } from '@/hooks/useOfflineTrainingChecklist';
import type { OfflineTrainingTemplate } from '@/lib/offline-checklist-db';

interface TrainingChecklistExecutionProps {
  clienteId: string;
  /** Técnico ou CSM responsável pelo atendimento em andamento */
  responsavelUserId: string;
  /** Define em qual coluna o responsável é gravado (técnico x CSM) */
  responsavelTipo?: 'tecnico' | 'csm';
  /** Modo "visita existente" (fluxo avulso): carrega a visita em vez de criar uma nova */
  existingVisitId?: string;
  /** Chamado após a conclusão (ex.: fechar o diálogo) */
  onCompleted?: () => void;
}

/**
 * Treinamento combinado a uma visita (corretiva, preventiva ou etapa de instalação),
 * ou conclusão de uma visita avulsa já existente (existingVisitId).
 * Independente do ChecklistExecution compartilhado: grava offline-first em
 * training_visits / training_checklist_responses.
 */
export default function TrainingChecklistExecution({
  clienteId,
  responsavelUserId,
  responsavelTipo = 'tecnico',
  existingVisitId,
  onCompleted,
}: TrainingChecklistExecutionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    isOnline,
    pendingCount,
    createTrainingVisit,
    updateTrainingVisit,
    setResponse,
    getResponses,
    getTrainingVisit,
    completeTraining,
    cacheTemplates,
    getCachedTemplates,
  } = useOfflineTrainingChecklist();

  const [templateId, setTemplateId] = useState('');
  const [visitId, setVisitId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [cachedTemplates, setCachedTemplates] = useState<OfflineTrainingTemplate[]>([]);
  const [loadingVisit, setLoadingVisit] = useState(false);
  const [visitHadTemplate, setVisitHadTemplate] = useState(false);

  // Modo "visita existente": carrega a visita, pré-preenche contato/checklist e respostas
  useEffect(() => {
    if (!existingVisitId) return;
    let active = true;
    setLoadingVisit(true);
    (async () => {
      try {
        const visit = await getTrainingVisit(existingVisitId);
        if (!active) return;
        setVisitId(visit.id);
        if (visit.checklist_template_id) {
          setTemplateId(visit.checklist_template_id);
          setVisitHadTemplate(true);
        }
        setContactName(visit.contact_name ?? '');
        setContactPhone(visit.contact_phone ?? '');
        const existing = await getResponses(visit.id);
        if (!active) return;
        setCheckedItems(
          existing.reduce<Record<string, boolean>>((acc, r) => {
            acc[r.checklist_template_item_id] = r.checked;
            return acc;
          }, {})
        );
      } catch (error) {
        console.error(error);
        if (active) {
          toast.error(
            error instanceof Error && error.message.includes('offline')
              ? error.message
              : 'Não foi possível carregar a visita de treinamento.'
          );
        }
      } finally {
        if (active) setLoadingVisit(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [existingVisitId, getTrainingVisit, getResponses]);

  // Templates ativos com blocos e itens. Quando online, alimenta o cache offline.
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['training-combined-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select(`
          id, name, description,
          blocks:checklist_template_blocks(
            id, block_name, order_index,
            items:checklist_template_items(id, item_name, order_index, active)
          )
        `)
        .eq('active', true)
        .order('name');
      if (error) throw error;

      const normalized = (data || []).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description ?? null,
        blocks: [...((t.blocks as any[]) || [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map(b => ({
            id: b.id,
            block_name: b.block_name,
            order_index: b.order_index,
            items: [...(b.items || [])]
              .filter((i: any) => i.active !== false)
              .sort((a: any, b2: any) => a.order_index - b2.order_index)
              .map((i: any) => ({ id: i.id, item_name: i.item_name, order_index: i.order_index })),
          })),
      }));

      await cacheTemplates(normalized);
      return normalized;
    },
    enabled: isOnline,
    staleTime: 5 * 60 * 1000,
  });

  // Fallback offline: lê os templates do cache local
  useEffect(() => {
    if (templates?.length) return;
    let active = true;
    getCachedTemplates().then(list => {
      if (active) setCachedTemplates(list);
    });
    return () => {
      active = false;
    };
  }, [templates, getCachedTemplates]);

  const availableTemplates = useMemo(
    () => (templates?.length ? templates : cachedTemplates),
    [templates, cachedTemplates]
  );

  const selectedTemplate = availableTemplates.find(t => t.id === templateId);

  // Ao escolher o checklist: modo existente grava na própria visita; modo combinado cria a visita local
  const handleSelectTemplate = useCallback(
    async (newTemplateId: string) => {
      setTemplateId(newTemplateId);
      if (existingVisitId) {
        if (visitHadTemplate || !visitId) return;
        try {
          await updateTrainingVisit(visitId, { checklist_template_id: newTemplateId });
          setVisitHadTemplate(true);
        } catch (error) {
          console.error(error);
          toast.error('Não foi possível gravar o checklist na visita.');
        }
        return;
      }
      if (visitId) return; // visita já criada nesta sessão
      setCreating(true);
      try {
        const id = await createTrainingVisit({
          clienteId,
          checklistTemplateId: newTemplateId,
          technicianUserId: responsavelTipo === 'tecnico' ? responsavelUserId : null,
          csmUserId: responsavelTipo === 'csm' ? responsavelUserId : null,
          createdByUserId: user!.id,
          plannedDate: new Date().toISOString().slice(0, 10),
        });
        setVisitId(id);
        const existing = await getResponses(id);
        setCheckedItems(
          existing.reduce<Record<string, boolean>>((acc, r) => {
            acc[r.checklist_template_item_id] = r.checked;
            return acc;
          }, {})
        );
      } catch (error) {
        console.error(error);
        toast.error('Não foi possível iniciar o treinamento.');
      } finally {
        setCreating(false);
      }
    },
    [
      clienteId,
      createTrainingVisit,
      existingVisitId,
      getResponses,
      responsavelTipo,
      responsavelUserId,
      updateTrainingVisit,
      user,
      visitHadTemplate,
      visitId,
    ]
  );

  const handleToggleItem = async (itemId: string, checked: boolean) => {
    if (!visitId) return;
    setCheckedItems(prev => ({ ...prev, [itemId]: checked }));
    try {
      await setResponse(visitId, itemId, { checked });
    } catch (error) {
      console.error(error);
      setCheckedItems(prev => ({ ...prev, [itemId]: !checked }));
      toast.error('Não foi possível salvar o item.');
    }
  };

  const handleComplete = async () => {
    if (!visitId) {
      toast.error('Selecione o checklist do treinamento.');
      return;
    }
    if (!contactName.trim() || !contactPhone.trim()) {
      toast.error('Informe o nome e o telefone de quem recebeu o treinamento.');
      return;
    }
    // Fluxo avulso (visita existente): todos os itens do checklist são obrigatórios
    if (existingVisitId && totalItems > 0 && markedItems < totalItems) {
      toast.error(`Marque todos os itens do checklist (${markedItems} de ${totalItems}).`);
      return;
    }
    setCompleting(true);
    try {
      await completeTraining(visitId, {
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
      });
      setCompleted(true);
      queryClient.invalidateQueries({ queryKey: ['training-visits'] });
      toast.success(
        isOnline
          ? 'Treinamento concluído!'
          : 'Treinamento salvo no aparelho. Será enviado quando houver conexão.'
      );
      onCompleted?.();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível concluir o treinamento.');
    } finally {
      setCompleting(false);
    }
  };

  const totalItems = selectedTemplate?.blocks.reduce((acc, b) => acc + b.items.length, 0) ?? 0;
  const markedItems = Object.values(checkedItems).filter(Boolean).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4" />
            Treinamento
          </CardTitle>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <Badge variant="outline" className="gap-1">
                <CloudOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
            {pendingCount > 0 && (
              <Badge variant="outline">{pendingCount} pendente(s) de envio</Badge>
            )}
            {completed && (
              <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle2 className="h-3 w-3" />
                Concluído
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Checklist do treinamento */}
        <div className="space-y-2">
          <Label>Checklist do treinamento *</Label>
          <Select value={templateId} onValueChange={handleSelectTemplate} disabled={creating || completed}>
            <SelectTrigger>
              <SelectValue
                placeholder={templatesLoading ? 'Carregando...' : 'Selecione o checklist'}
              />
            </SelectTrigger>
            <SelectContent>
              {availableTemplates.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableTemplates.length === 0 && !templatesLoading && (
            <p className="text-sm text-muted-foreground">
              Nenhum checklist disponível no aparelho. Conecte-se à internet uma vez para baixá-los.
            </p>
          )}
        </div>

        {/* Dados de quem recebeu o treinamento */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 min-w-0">
            <Label>Nome do responsável treinado *</Label>
            <Input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Quem recebeu o treinamento"
              disabled={completed}
            />
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Telefone *</Label>
            <Input
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              disabled={completed}
            />
          </div>
        </div>

        {/* Itens do checklist */}
        {creating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Iniciando treinamento...
          </div>
        )}

        {selectedTemplate && visitId && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {markedItems} de {totalItems} item(ns) marcado(s)
            </p>
            {selectedTemplate.blocks.map(block => (
              <div key={block.id} className="space-y-2">
                <p className="text-sm font-medium">{block.block_name}</p>
                <div className="space-y-2 pl-1">
                  {block.items.map(item => (
                    <label
                      key={item.id}
                      className="flex items-start gap-2 text-sm cursor-pointer min-w-0"
                    >
                      <Checkbox
                        checked={!!checkedItems[item.id]}
                        onCheckedChange={v => handleToggleItem(item.id, v === true)}
                        disabled={completed}
                      />
                      <span className="min-w-0">{item.item_name}</span>
                    </label>
                  ))}
                  {block.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum item neste bloco.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleComplete} disabled={completing || completed} className="w-full sm:w-auto">
          {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Concluir Treinamento
        </Button>
      </CardContent>
    </Card>
  );
}
