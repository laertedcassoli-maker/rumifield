import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductBadge } from '@/components/crm/ProductBadge';
import { Clock, CheckCircle2, DollarSign, Calendar } from 'lucide-react';

import type {
  UnifiedAction,
  ActionStatus,
  ActionType,
  ProposalStatus,
} from '@/hooks/useCrmAcoesData';

interface EditarAcaoSheetProps {
  action: UnifiedAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_STATUS_OPTIONS: { value: ActionStatus; label: string; className: string; icon: React.ElementType }[] = [
  { value: 'aberta', label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200', icon: Clock },
  { value: 'em_execucao', label: 'Em Execução', className: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200', icon: Clock },
  { value: 'concluida', label: 'Concluída', className: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200', icon: CheckCircle2 },
];

const PROPOSAL_STATUS_OPTIONS: { value: ProposalStatus; label: string; className: string }[] = [
  { value: 'ativa', label: 'Ativa', className: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200' },
  { value: 'aceita', label: 'Aceita', className: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200' },
  { value: 'recusada', label: 'Recusada', className: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200' },
];

export function EditarAcaoSheet({ action, open, onOpenChange }: EditarAcaoSheetProps) {
  const queryClient = useQueryClient();

  // Local form state for actions
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState<number>(1);
  const [type, setType] = useState<ActionType>('tarefa');

  // Reset form when action changes
  useEffect(() => {
    if (action && action._source === 'action') {
      setTitle(action.title || '');
      setDescription(action.description || '');
      setDueAt(action.due_at ? action.due_at.slice(0, 10) : '');
      setPriority(action.priority);
      setType(action.type);
    }
  }, [action]);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-actions-flat'] });
    queryClient.invalidateQueries({ queryKey: ['crm-proposals-flat'] });
  };

  // --- Action mutations ---
  const updateActionStatus = useMutation({
    mutationFn: async (status: ActionStatus) => {
      const { error } = await supabase
        .from('crm_actions')
        .update({ status })
        .eq('id', action!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status atualizado');
      invalidateQueries();
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const updateActionFields = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('crm_actions')
        .update({
          title,
          description: description || null,
          due_at: dueAt || null,
          priority,
          type,
        })
        .eq('id', action!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ação atualizada');
      invalidateQueries();
      onOpenChange(false);
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  // --- Proposal mutations ---
  const updateProposalStatus = useMutation({
    mutationFn: async (status: ProposalStatus) => {
      const { error } = await supabase
        .from('crm_proposals')
        .update({ status })
        .eq('id', action!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status da proposta atualizado');
      invalidateQueries();
    },
    onError: () => toast.error('Erro ao atualizar proposta'),
  });

  if (!action) return null;

  const isAction = action._source === 'action';
  const isProposal = action._source === 'proposal';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isAction ? 'Editar Ação' : 'Proposta Comercial'}</SheetTitle>
          <SheetDescription>
            {action.clientes && (
              <Link
                to={`/crm/${action.clientes.id}`}
                state={{ from: '/crm/acoes', fromLabel: 'Ações' }}
                className="text-primary hover:underline font-medium"
              >
                {action.clientes.nome}
              </Link>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* ===== ACTION EDITING ===== */}
          {isAction && (
            <>
              {/* Quick status buttons */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <div className="flex gap-2">
                  {ACTION_STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = action.status === opt.value;
                    return (
                      <Button
                        key={opt.value}
                        variant="outline"
                        size="sm"
                        disabled={updateActionStatus.isPending}
                        className={`flex-1 text-xs gap-1 ${active ? opt.className + ' ring-2 ring-offset-1' : ''}`}
                        onClick={() => updateActionStatus.mutate(opt.value)}
                      >
                        <Icon className="h-3 w-3" />
                        {opt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="type">Tipo</Label>
                    <Select value={type} onValueChange={(v) => setType(v as ActionType)}>
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tarefa">Tarefa</SelectItem>
                        <SelectItem value="pendencia">Pendência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select value={String(priority)} onValueChange={(v) => setPriority(Number(v))}>
                      <SelectTrigger id="priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">P1 - Baixa</SelectItem>
                        <SelectItem value="2">P2 - Média</SelectItem>
                        <SelectItem value="3">P3 - Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="due_at">Prazo</Label>
                  <Input
                    id="due_at"
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  disabled={updateActionFields.isPending || !title.trim()}
                  onClick={() => updateActionFields.mutate()}
                >
                  {updateActionFields.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </>
          )}

          {/* ===== PROPOSAL EDITING ===== */}
          {isProposal && (
            <>
              {/* Product badge */}
              {action.product_code && (
                <div>
                  <Label className="text-xs text-muted-foreground">Produto</Label>
                  <div className="mt-1">
                    <ProductBadge productCode={action.product_code} />
                  </div>
                </div>
              )}

              {/* Read-only fields */}
              {action.proposed_value != null && (
                <div>
                  <Label className="text-xs text-muted-foreground">Valor proposto</Label>
                  <p className="text-lg font-semibold flex items-center gap-1 mt-1">
                    <DollarSign className="h-4 w-4" />
                    {action.proposed_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              )}

              {action.due_at && (
                <div>
                  <Label className="text-xs text-muted-foreground">Validade</Label>
                  <p className="flex items-center gap-1 mt-1 text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(action.due_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}

              {action.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Observações</Label>
                  <p className="text-sm mt-1">{action.description}</p>
                </div>
              )}

              {/* Quick status buttons */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <div className="flex gap-2">
                  {PROPOSAL_STATUS_OPTIONS.map((opt) => {
                    const active = action.proposal_status === opt.value;
                    return (
                      <Button
                        key={opt.value}
                        variant="outline"
                        size="sm"
                        disabled={updateProposalStatus.isPending}
                        className={`flex-1 text-xs ${active ? opt.className + ' ring-2 ring-offset-1' : ''}`}
                        onClick={() => updateProposalStatus.mutate(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
