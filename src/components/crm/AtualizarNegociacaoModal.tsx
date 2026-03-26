import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { PRODUCT_LABELS, type ProductCode, type CrmStage } from '@/hooks/useCrmData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientProductId: string;
  productCode: ProductCode;
  currentStage: CrmStage;
  lossReasons: any[];
  onUpdated?: () => void;
}

export function AtualizarNegociacaoModal({ open, onOpenChange, clientProductId, productCode, currentStage, lossReasons, onUpdated }: Props) {
  const queryClient = useQueryClient();
  const [newStage, setNewStage] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [lossReasonId, setLossReasonId] = useState('');
  const [lossNotes, setLossNotes] = useState('');

  const filteredReasons = lossReasons.filter(r => r.product_code === productCode);

  const mutation = useMutation({
    mutationFn: async () => {
      const update: any = {
        stage: newStage,
        stage_updated_at: new Date().toISOString(),
        notes: notes || null,
      };
      if (newStage === 'perdido') {
        if (!lossReasonId) throw new Error('Selecione motivo de perda');
        update.loss_reason_id = lossReasonId;
        update.loss_notes = lossNotes || null;
      }
      // @ts-ignore
      const { error } = await supabase
        .from('crm_client_products')
        .update(update)
        .eq('id', clientProductId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Negociação atualizada!');
      queryClient.invalidateQueries({ queryKey: ['crm-'] });
      queryClient.invalidateQueries({ queryKey: ['crm-360'] });
      onOpenChange(false);
      setNewStage(''); setNotes(''); setLossReasonId(''); setLossNotes('');
      onUpdated?.();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  });

  const stageOptions = (() => {
    switch (currentStage) {
      case 'qualificado': return [
        { value: 'em_negociacao', label: 'Iniciar Negociação' },
      ];
      case 'em_negociacao': return [
        { value: 'ganho', label: 'Marcar Ganho' },
        { value: 'perdido', label: 'Marcar Perdido' },
      ];
      case 'perdido': return [
        { value: 'nao_qualificado', label: 'Reabrir (Não Qualificado)' },
      ];
      default: return [];
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar {PRODUCT_LABELS[productCode]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Novo estágio</Label>
            <Select value={newStage} onValueChange={setNewStage}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {stageOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newStage === 'perdido' && (
            <>
              <div>
                <Label>Motivo da perda *</Label>
                <Select value={lossReasonId} onValueChange={setLossReasonId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {filteredReasons.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.reason}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações da perda</Label>
                <Textarea value={lossNotes} onChange={e => setLossNotes(e.target.value)} rows={2} />
              </div>
            </>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!newStage || (newStage === 'perdido' && !lossReasonId) || mutation.isPending}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
