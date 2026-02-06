import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, ChevronDown, Pencil, Trash2, GripVertical } from 'lucide-react';
import { PRODUCT_LABELS, type ProductCode, PRODUCT_ORDER } from '@/hooks/useCrmData';

const ANSWER_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'date', label: 'Data' },
  { value: 'choice', label: 'Escolha' },
];

interface QualTemplate {
  id: string;
  product_code: ProductCode;
  name: string;
  is_active: boolean;
}

interface QualItem {
  id: string;
  template_id: string;
  question: string;
  answer_type: string;
  is_required: boolean;
  sort_order: number;
}

export default function CrmConfig() {
  const queryClient = useQueryClient();
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QualTemplate | null>(null);
  const [editingItem, setEditingItem] = useState<QualItem | null>(null);
  const [selectedProductForTemplate, setSelectedProductForTemplate] = useState<ProductCode | ''>('');
  const [templateForm, setTemplateForm] = useState({ name: '', is_active: true });
  const [itemForm, setItemForm] = useState({ question: '', answer_type: 'text', is_required: false, sort_order: 0 });
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // Fetch all templates
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['qual-templates-admin'],
    queryFn: async () => {
      // @ts-ignore
      const { data, error } = await supabase
        .from('crm_product_qualification_templates')
        .select('*')
        .order('product_code');
      if (error) throw error;
      return data as QualTemplate[];
    },
  });

  // Fetch all items
  const { data: allItems, isLoading: loadingItems } = useQuery({
    queryKey: ['qual-items-admin'],
    queryFn: async () => {
      // @ts-ignore
      const { data, error } = await supabase
        .from('crm_product_qualification_items')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as QualItem[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['qual-templates-admin'] });
    queryClient.invalidateQueries({ queryKey: ['qual-items-admin'] });
  };

  // Save template
  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (editingTemplate) {
        // @ts-ignore
        const { error } = await supabase
          .from('crm_product_qualification_templates')
          .update({ name: templateForm.name, is_active: templateForm.is_active })
          .eq('id', editingTemplate.id);
        if (error) throw error;
      } else {
        if (!selectedProductForTemplate) throw new Error('Selecione um produto');
        // @ts-ignore
        const { error } = await supabase
          .from('crm_product_qualification_templates')
          .insert({ product_code: selectedProductForTemplate, name: templateForm.name, is_active: templateForm.is_active });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingTemplate ? 'Template atualizado!' : 'Template criado!');
      invalidateAll();
      setTemplateDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      // @ts-ignore
      const { error } = await supabase.from('crm_product_qualification_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Template removido!'); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Save item
  const saveItem = useMutation({
    mutationFn: async () => {
      if (!activeTemplateId) throw new Error('Template não selecionado');
      if (editingItem) {
        // @ts-ignore
        const { error } = await supabase
          .from('crm_product_qualification_items')
          .update({
            question: itemForm.question,
            answer_type: itemForm.answer_type,
            is_required: itemForm.is_required,
            sort_order: itemForm.sort_order,
          })
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        // @ts-ignore
        const { error } = await supabase
          .from('crm_product_qualification_items')
          .insert({
            template_id: activeTemplateId,
            question: itemForm.question,
            answer_type: itemForm.answer_type,
            is_required: itemForm.is_required,
            sort_order: itemForm.sort_order,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingItem ? 'Pergunta atualizada!' : 'Pergunta adicionada!');
      invalidateAll();
      setItemDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete item
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      // @ts-ignore
      const { error } = await supabase.from('crm_product_qualification_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Pergunta removida!'); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNewTemplate = (productCode: ProductCode) => {
    setEditingTemplate(null);
    setSelectedProductForTemplate(productCode);
    setTemplateForm({ name: `Qualificação ${PRODUCT_LABELS[productCode]}`, is_active: true });
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (t: QualTemplate) => {
    setEditingTemplate(t);
    setSelectedProductForTemplate(t.product_code);
    setTemplateForm({ name: t.name, is_active: t.is_active });
    setTemplateDialogOpen(true);
  };

  const openNewItem = (templateId: string) => {
    setEditingItem(null);
    setActiveTemplateId(templateId);
    const existingItems = (allItems || []).filter(i => i.template_id === templateId);
    setItemForm({ question: '', answer_type: 'text', is_required: false, sort_order: (existingItems.length + 1) * 10 });
    setItemDialogOpen(true);
  };

  const openEditItem = (item: QualItem) => {
    setEditingItem(item);
    setActiveTemplateId(item.template_id);
    setItemForm({ question: item.question, answer_type: item.answer_type, is_required: item.is_required, sort_order: item.sort_order });
    setItemDialogOpen(true);
  };

  const toggleProduct = (code: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  if (loadingTemplates || loadingItems) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Configuração CRM</h1>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Configuração CRM</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie os formulários de qualificação por produto</p>
      </div>

      <div className="space-y-3">
        {PRODUCT_ORDER.map(productCode => {
          const productTemplates = (templates || []).filter(t => t.product_code === productCode);
          const isExpanded = expandedProducts.has(productCode);

          return (
            <Card key={productCode}>
              <Collapsible open={isExpanded} onOpenChange={() => toggleProduct(productCode)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base">{PRODUCT_LABELS[productCode]}</CardTitle>
                        <Badge variant={productTemplates.length > 0 ? 'default' : 'outline'} className="text-xs">
                          {productTemplates.length} template{productTemplates.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {productTemplates.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground mb-3">Nenhum template de qualificação configurado</p>
                        <Button size="sm" onClick={() => openNewTemplate(productCode)}>
                          <Plus className="h-4 w-4 mr-1" /> Criar Template
                        </Button>
                      </div>
                    ) : (
                      productTemplates.map(template => {
                        const templateItems = (allItems || []).filter(i => i.template_id === template.id);
                        return (
                          <div key={template.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{template.name}</span>
                                <Badge variant={template.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                  {template.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTemplate(template)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => { if (confirm('Remover template e todas as perguntas?')) deleteTemplate.mutate(template.id); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Items list */}
                            {templateItems.length > 0 && (
                              <div className="space-y-1.5">
                                {templateItems.map((item, idx) => (
                                  <div key={item.id} className="flex items-center justify-between bg-muted/40 rounded px-3 py-2 text-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <span className="truncate">{item.question}</span>
                                      <Badge variant="outline" className="text-[10px] shrink-0">
                                        {ANSWER_TYPES.find(a => a.value === item.answer_type)?.label || item.answer_type}
                                      </Badge>
                                      {item.is_required && (
                                        <Badge variant="destructive" className="text-[10px] shrink-0">Obrigatório</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditItem(item)}>
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-destructive"
                                        onClick={() => { if (confirm('Remover esta pergunta?')) deleteItem.mutate(item.id); }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <Button size="sm" variant="outline" onClick={() => openNewItem(template.id)}>
                              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Pergunta
                            </Button>
                          </div>
                        );
                      })
                    )}

                    {productTemplates.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => openNewTemplate(productCode)}>
                        <Plus className="h-4 w-4 mr-1" /> Novo Template
                      </Button>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produto</Label>
              <Input value={PRODUCT_LABELS[selectedProductForTemplate as ProductCode] || ''} disabled className="mt-1" />
            </div>
            <div>
              <Label>Nome do Template</Label>
              <Input
                value={templateForm.name}
                onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={templateForm.is_active} onCheckedChange={v => setTemplateForm(p => ({ ...p, is_active: v }))} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveTemplate.mutate()} disabled={!templateForm.name || saveTemplate.isPending}>
              {saveTemplate.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Pergunta' : 'Nova Pergunta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pergunta</Label>
              <Input
                value={itemForm.question}
                onChange={e => setItemForm(p => ({ ...p, question: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tipo de Resposta</Label>
              <Select value={itemForm.answer_type} onValueChange={v => setItemForm(p => ({ ...p, answer_type: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANSWER_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordem</Label>
              <Input
                type="number"
                value={itemForm.sort_order}
                onChange={e => setItemForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={itemForm.is_required} onCheckedChange={v => setItemForm(p => ({ ...p, is_required: v }))} />
              <Label>Obrigatório</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveItem.mutate()} disabled={!itemForm.question || saveItem.isPending}>
              {saveItem.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
