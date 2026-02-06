import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PRODUCT_LABELS, type ProductCode } from '@/hooks/useCrmData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientProductId: string;
  productCode: ProductCode;
  onQualified?: () => void;
}

export function QualificarProdutoModal({ open, onOpenChange, clientProductId, productCode, onQualified }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // @ts-ignore
  const { data: template } = useQuery({
    queryKey: ['qual-template', productCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_product_qualification_templates')
        .select('id')
        .eq('product_code', productCode)
        .eq('is_active', true)
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // @ts-ignore
  const { data: items, isLoading } = useQuery({
    queryKey: ['qual-items', template?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_product_qualification_items')
        .select('*')
        .eq('template_id', template!.id)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!template?.id,
  });

  // Load existing answers
  // @ts-ignore
  const { data: existingAnswers } = useQuery({
    queryKey: ['qual-answers', clientProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_client_product_qualification_answers')
        .select('*')
        .eq('client_product_id', clientProductId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!clientProductId,
  });

  useEffect(() => {
    if (existingAnswers) {
      const map: Record<string, any> = {};
      existingAnswers.forEach((a: any) => {
        map[a.item_id] = a.answer_text || a.answer_number || a.answer_date || a.answer_boolean || a.answer_choice || '';
      });
      setAnswers(map);
    }
  }, [existingAnswers]);

  const saveMutation = useMutation({
    mutationFn: async (qualify: boolean) => {
      // Save answers
      const upserts = (items || []).map((item: any) => {
        const val = answers[item.id];
        return {
          client_product_id: clientProductId,
          item_id: item.id,
          answer_text: item.answer_type === 'text' ? (val || null) : null,
          answer_number: item.answer_type === 'number' ? (val ? Number(val) : null) : null,
          answer_date: item.answer_type === 'date' ? (val || null) : null,
          answer_boolean: item.answer_type === 'boolean' ? (val === true || val === 'true') : null,
          answer_choice: (item.answer_type === 'choice' || item.answer_type === 'list') ? (val || null) : null,
          updated_by: user!.id,
          updated_at: new Date().toISOString(),
        };
      }).filter((u: any) => {
        return u.answer_text !== null || u.answer_number !== null || u.answer_date !== null || u.answer_boolean !== null || u.answer_choice !== null;
      });

      if (upserts.length > 0) {
        // @ts-ignore
        const { error } = await supabase
          .from('crm_client_product_qualification_answers')
          .upsert(upserts, { onConflict: 'client_product_id,item_id' });
        if (error) throw error;
      }

      if (qualify) {
        // @ts-ignore
        const { error: stageErr } = await supabase
          .from('crm_client_products')
          .update({ stage: 'qualificado', stage_updated_at: new Date().toISOString() })
          .eq('id', clientProductId);
        if (stageErr) throw stageErr;
      }
    },
    onSuccess: (_, qualify) => {
      toast.success(qualify ? 'Produto qualificado com sucesso!' : 'Respostas salvas!');
      queryClient.invalidateQueries({ queryKey: ['crm-'] });
      queryClient.invalidateQueries({ queryKey: ['qual-answers'] });
      queryClient.invalidateQueries({ queryKey: ['crm-360-products'] });
      queryClient.invalidateQueries({ queryKey: ['crm-carteira'] });
      onOpenChange(false);
      onQualified?.();
    },
    onError: () => toast.error('Erro ao salvar qualificação'),
  });

  const requiredItems = (items || []).filter((i: any) => i.is_required);
  const allRequiredFilled = requiredItems.every((i: any) => {
    const val = answers[i.id];
    return val !== undefined && val !== '' && val !== null;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Qualificar {PRODUCT_LABELS[productCode]}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {(items || []).map((item: any) => (
              <div key={item.id} className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  {item.question}
                  {item.is_required && <Badge variant="outline" className="text-[10px] px-1">Obrigatório</Badge>}
                </Label>
                {item.answer_type === 'text' && (
                  <Textarea
                    value={answers[item.id] || ''}
                    onChange={(e) => setAnswers(p => ({ ...p, [item.id]: e.target.value }))}
                    rows={2}
                  />
                )}
                {item.answer_type === 'number' && (
                  <Input
                    type="number"
                    value={answers[item.id] || ''}
                    onChange={(e) => setAnswers(p => ({ ...p, [item.id]: e.target.value }))}
                  />
                )}
                {item.answer_type === 'date' && (
                  <Input
                    type="date"
                    value={answers[item.id] || ''}
                    onChange={(e) => setAnswers(p => ({ ...p, [item.id]: e.target.value }))}
                  />
                )}
                {item.answer_type === 'boolean' && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={answers[item.id] === true || answers[item.id] === 'true'}
                      onCheckedChange={(v) => setAnswers(p => ({ ...p, [item.id]: v }))}
                    />
                    <span className="text-sm text-muted-foreground">
                      {answers[item.id] === true || answers[item.id] === 'true' ? 'Sim' : 'Não'}
                    </span>
                  </div>
                )}
                {item.answer_type === 'choice' && (
                  <Input
                    value={answers[item.id] || ''}
                    onChange={(e) => setAnswers(p => ({ ...p, [item.id]: e.target.value }))}
                    placeholder="Digite a opção..."
                  />
                )}
                {item.answer_type === 'list' && (
                  <Select
                    value={answers[item.id] || ''}
                    onValueChange={(v) => setAnswers(p => ({ ...p, [item.id]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(item.choice_options || []).map((opt: string) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending}>
            Salvar rascunho
          </Button>
          <Button
            onClick={() => saveMutation.mutate(true)}
            disabled={!allRequiredFilled || saveMutation.isPending}
          >
            Marcar como Qualificado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
