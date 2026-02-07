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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PRODUCT_LABELS, PRODUCT_ORDER, type ProductCode } from '@/hooks/useCrmData';

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

export function CrmMetricDefsTable() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MetricDef | null>(null);
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [form, setForm] = useState({
    product_code: '' as string,
    metric_key: '',
    label: '',
    value_type: 'number',
    unit: '',
    group_name: '',
    priority: 0,
    is_active: true,
  });

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['crm-metric-defs-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_metric_definitions')
        .select('*')
        .order('product_code')
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
        const { error } = await supabase.from('crm_metric_definitions').insert({ ...payload, product_code: form.product_code as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Métrica atualizada!' : 'Métrica criada!');
      queryClient.invalidateQueries({ queryKey: ['crm-metric-defs-all'] });
      queryClient.invalidateQueries({ queryKey: ['crm-metric-defs-admin'] });
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
      queryClient.invalidateQueries({ queryKey: ['crm-metric-defs-all'] });
      queryClient.invalidateQueries({ queryKey: ['crm-metric-defs-admin'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    const nextPriority = ((metrics || []).length + 1) * 10;
    setForm({ product_code: filterProduct !== 'all' ? filterProduct : PRODUCT_ORDER[0], metric_key: '', label: '', value_type: 'number', unit: '', group_name: '', priority: nextPriority, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (m: MetricDef) => {
    setEditing(m);
    setForm({ product_code: m.product_code, metric_key: m.metric_key, label: m.label, value_type: m.value_type, unit: m.unit || '', group_name: m.group_name || '', priority: m.priority, is_active: m.is_active });
    setDialogOpen(true);
  };

  const filtered = filterProduct === 'all'
    ? (metrics || [])
    : (metrics || []).filter(m => m.product_code === filterProduct);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Métricas de Saúde</h2>
          <p className="text-xs text-muted-foreground">Defina os indicadores de saúde monitorados por produto</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova Métrica
        </Button>
      </div>

      <Select value={filterProduct} onValueChange={setFilterProduct}>
        <SelectTrigger className="w-48 h-8 text-sm">
          <SelectValue placeholder="Filtrar por produto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os produtos</SelectItem>
          {PRODUCT_ORDER.map(code => (
            <SelectItem key={code} value={code}>{PRODUCT_LABELS[code]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhuma métrica cadastrada</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Produto</TableHead>
                <TableHead className="text-xs">Label</TableHead>
                <TableHead className="text-xs">Chave</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Unidade</TableHead>
                <TableHead className="text-xs">Grupo</TableHead>
                <TableHead className="text-xs text-center">Prioridade</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="py-2 text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {PRODUCT_LABELS[m.product_code as ProductCode] || m.product_code}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-sm font-medium">{m.label}</TableCell>
                  <TableCell className="py-2">
                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{m.metric_key}</code>
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {VALUE_TYPES.find(v => v.value === m.value_type)?.label || m.value_type}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">{m.unit || '—'}</TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">{m.group_name || '—'}</TableCell>
                  <TableCell className="py-2 text-xs text-center">{m.priority}</TableCell>
                  <TableCell className="py-2 text-center">
                    <Badge variant={m.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {m.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(m)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { if (confirm('Remover esta métrica?')) remove.mutate(m.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Métrica' : 'Nova Métrica de Saúde'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produto</Label>
              <Select value={form.product_code} onValueChange={v => setForm(p => ({ ...p, product_code: v }))} disabled={!!editing}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_ORDER.map(code => (
                    <SelectItem key={code} value={code}>{PRODUCT_LABELS[code]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <Button onClick={() => save.mutate()} disabled={!form.metric_key.trim() || !form.label.trim() || !form.product_code || save.isPending}>
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
