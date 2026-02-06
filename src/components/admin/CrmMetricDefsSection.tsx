import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import type { ProductCode } from '@/hooks/useCrmData';

interface MetricDef {
  id: string;
  product_code: string;
  metric_key: string;
  label: string;
  value_type: string;
  unit: string | null;
  group_name: string | null;
  priority: number;
  is_active: boolean;
}

const VALUE_TYPES = [
  { value: 'number', label: 'Número' },
  { value: 'percentage', label: 'Percentual' },
  { value: 'text', label: 'Texto' },
  { value: 'boolean', label: 'Sim/Não' },
];

export function CrmMetricDefsSection({ productCode }: { productCode: ProductCode }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MetricDef | null>(null);
  const [form, setForm] = useState({ metric_key: '', label: '', value_type: 'number', unit: '', group_name: '', priority: 0, is_active: true });

  const { data: metrics } = useQuery({
    queryKey: ['crm-metric-defs-admin', productCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_metric_definitions')
        .select('*')
        .eq('product_code', productCode)
        .order('priority');
      if (error) throw error;
      return data as MetricDef[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        metric_key: form.metric_key.trim(),
        label: form.label.trim(),
        value_type: form.value_type,
        unit: form.unit.trim() || null,
        group_name: form.group_name.trim() || null,
        priority: form.priority,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from('crm_metric_definitions').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crm_metric_definitions').insert({ ...payload, product_code: productCode as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Métrica atualizada!' : 'Métrica criada!');
      queryClient.invalidateQueries({ queryKey: ['crm-metric-defs-admin', productCode] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_metric_definitions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Métrica removida!');
      queryClient.invalidateQueries({ queryKey: ['crm-metric-defs-admin', productCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    const nextPriority = ((metrics || []).length + 1) * 10;
    setForm({ metric_key: '', label: '', value_type: 'number', unit: '', group_name: '', priority: nextPriority, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (m: MetricDef) => {
    setEditing(m);
    setForm({ metric_key: m.metric_key, label: m.label, value_type: m.value_type, unit: m.unit || '', group_name: m.group_name || '', priority: m.priority, is_active: m.is_active });
    setDialogOpen(true);
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-muted-foreground mb-3">Métricas de Saúde</h4>

      {(metrics || []).length === 0 ? (
        <p className="text-sm text-muted-foreground mb-2">Nenhuma métrica cadastrada</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {(metrics || []).map(m => (
            <div key={m.id} className="flex items-center justify-between bg-muted/40 rounded px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{m.label}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{m.metric_key}</Badge>
                {m.unit && <Badge variant="secondary" className="text-[10px] shrink-0">{m.unit}</Badge>}
                {!m.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(m)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { if (confirm('Remover esta métrica?')) remove.mutate(m.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button size="sm" variant="outline" onClick={openNew}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Métrica
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Métrica' : 'Nova Métrica de Saúde'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Chave (metric_key)</Label>
                <Input value={form.metric_key} onChange={e => setForm(p => ({ ...p, metric_key: e.target.value }))} className="mt-1" placeholder="ex: ccs_media" />
              </div>
              <div>
                <Label>Label</Label>
                <Input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} className="mt-1" placeholder="ex: CCS Média" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.value_type} onValueChange={v => setForm(p => ({ ...p, value_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VALUE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} className="mt-1" placeholder="ex: mil/ml" />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Input type="number" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Grupo</Label>
              <Input value={form.group_name} onChange={e => setForm(p => ({ ...p, group_name: e.target.value }))} className="mt-1" placeholder="ex: Qualidade do Leite" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.metric_key.trim() || !form.label.trim() || save.isPending}>
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
