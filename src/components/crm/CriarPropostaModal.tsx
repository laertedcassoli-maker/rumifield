import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { PRODUCT_LABELS, type ProductCode } from '@/hooks/useCrmData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientProductId: string;
  productCode: ProductCode;
  onCreated?: () => void;
}

export function CriarPropostaModal({ open, onOpenChange, clientProductId, productCode, onCreated }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [sentAt, setSentAt] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      // @ts-ignore
      const { error: propErr } = await supabase.from('crm_proposals').insert({
        client_product_id: clientProductId,
        proposed_value: value ? Number(value) : null,
        valid_until: validUntil || null,
        sent_at: sentAt ? new Date(sentAt).toISOString() : null,
        notes: notes || null,
        created_by: user!.id,
      });
      if (propErr) throw propErr;

      // @ts-ignore
      const { error: stageErr } = await supabase
        .from('crm_client_products')
        .update({ stage: 'em_negociacao', stage_updated_at: new Date().toISOString() })
        .eq('id', clientProductId);
      if (stageErr) throw stageErr;
    },
    onSuccess: () => {
      toast.success('Proposta criada!');
      queryClient.invalidateQueries({ queryKey: ['crm-'] });
      queryClient.invalidateQueries({ queryKey: ['crm-360'] });
      onOpenChange(false);
      setValue(''); setValidUntil(''); setSentAt(''); setNotes('');
      onCreated?.();
    },
    onError: () => toast.error('Erro ao criar proposta'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Proposta - {PRODUCT_LABELS[productCode]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Valor proposto (R$)</Label>
            <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label>Validade</Label>
            <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
          </div>
          <div>
            <Label>Data de envio</Label>
            <Input type="date" value={sentAt} onChange={e => setSentAt(e.target.value)} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Criar Proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
