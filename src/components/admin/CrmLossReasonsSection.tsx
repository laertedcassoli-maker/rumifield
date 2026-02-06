import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import type { ProductCode } from '@/hooks/useCrmData';

interface LossReason {
  id: string;
  product_code: string;
  reason: string;
  sort_order: number;
  is_active: boolean;
}

export function CrmLossReasonsSection({ productCode }: { productCode: ProductCode }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LossReason | null>(null);
  const [form, setForm] = useState({ reason: '', sort_order: 0, is_active: true });

  const { data: reasons } = useQuery({
    queryKey: ['crm-loss-reasons-admin', productCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_loss_reasons')
        .select('*')
        .eq('product_code', productCode)
        .order('sort_order');
      if (error) throw error;
      return data as LossReason[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from('crm_loss_reasons')
          .update({ reason: form.reason.trim(), sort_order: form.sort_order, is_active: form.is_active })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_loss_reasons')
          .insert({ product_code: productCode as any, reason: form.reason.trim(), sort_order: form.sort_order, is_active: form.is_active });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Motivo atualizado!' : 'Motivo criado!');
      queryClient.invalidateQueries({ queryKey: ['crm-loss-reasons-admin', productCode] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_loss_reasons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Motivo removido!');
      queryClient.invalidateQueries({ queryKey: ['crm-loss-reasons-admin', productCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    const nextOrder = ((reasons || []).length + 1) * 10;
    setForm({ reason: '', sort_order: nextOrder, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (r: LossReason) => {
    setEditing(r);
    setForm({ reason: r.reason, sort_order: r.sort_order, is_active: r.is_active });
    setDialogOpen(true);
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-muted-foreground mb-3">Motivos de Perda</h4>

      {(reasons || []).length === 0 ? (
        <p className="text-sm text-muted-foreground mb-2">Nenhum motivo cadastrado</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {(reasons || []).map(r => (
            <div key={r.id} className="flex items-center justify-between bg-muted/40 rounded px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{r.reason}</span>
                {!r.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(r)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { if (confirm('Remover este motivo?')) remove.mutate(r.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button size="sm" variant="outline" onClick={openNew}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Motivo
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Motivo' : 'Novo Motivo de Perda'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo</Label>
              <Input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.reason.trim() || save.isPending}>
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
