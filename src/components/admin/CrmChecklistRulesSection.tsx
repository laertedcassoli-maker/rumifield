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
import { Plus, Pencil, Trash2, ClipboardList } from 'lucide-react';
import type { ProductCode } from '@/hooks/useCrmData';

interface ChecklistRule {
  id: string;
  product_code: string;
  checklist_template_id: string;
  priority: number;
  is_active: boolean;
}

interface ChecklistTemplate {
  id: string;
  name: string;
  active: boolean;
}

export function CrmChecklistRulesSection({ productCode }: { productCode: ProductCode }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistRule | null>(null);
  const [form, setForm] = useState({ checklist_template_id: '', priority: 0, is_active: true });

  const { data: rules } = useQuery({
    queryKey: ['crm-checklist-rules-admin', productCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_checklist_rules')
        .select('*')
        .eq('product_code', productCode)
        .order('priority');
      if (error) throw error;
      return data as ChecklistRule[];
    },
  });

  const { data: checklistTemplates } = useQuery({
    queryKey: ['checklist-templates-for-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name, active')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as ChecklistTemplate[];
    },
  });

  const templateMap = (checklistTemplates || []).reduce<Record<string, string>>((acc, t) => {
    acc[t.id] = t.name;
    return acc;
  }, {});

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        checklist_template_id: form.checklist_template_id,
        priority: form.priority,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from('crm_checklist_rules').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crm_checklist_rules').insert({ ...payload, product_code: productCode as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Regra atualizada!' : 'Regra criada!');
      queryClient.invalidateQueries({ queryKey: ['crm-checklist-rules-admin', productCode] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_checklist_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Regra removida!');
      queryClient.invalidateQueries({ queryKey: ['crm-checklist-rules-admin', productCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    const nextPriority = ((rules || []).length + 1) * 10;
    setForm({ checklist_template_id: '', priority: nextPriority, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (r: ChecklistRule) => {
    setEditing(r);
    setForm({ checklist_template_id: r.checklist_template_id, priority: r.priority, is_active: r.is_active });
    setDialogOpen(true);
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-muted-foreground mb-3">Regras de Checklist</h4>

      {(rules || []).length === 0 ? (
        <p className="text-sm text-muted-foreground mb-2">Nenhuma regra configurada</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {(rules || []).map(r => (
            <div key={r.id} className="flex items-center justify-between bg-muted/40 rounded px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{templateMap[r.checklist_template_id] || r.checklist_template_id}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">Prioridade: {r.priority}</Badge>
                {!r.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(r)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { if (confirm('Remover esta regra?')) remove.mutate(r.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button size="sm" variant="outline" onClick={openNew}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Regra
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Regra' : 'Nova Regra de Checklist'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Checklist Template</Label>
              <Select value={form.checklist_template_id} onValueChange={v => setForm(p => ({ ...p, checklist_template_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(checklistTemplates || []).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Input type="number" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.checklist_template_id || save.isPending}>
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
