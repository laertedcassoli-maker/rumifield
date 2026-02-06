import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string;
  clientId: string;
  onFinalized: () => void;
}

interface QuickAction {
  title: string;
  due_days: number;
}

export function FinalizarVisitaModal({ open, onOpenChange, visitId, clientId, onFinalized }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const geo = useGeolocation();

  const [summary, setSummary] = useState('');
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [newActionTitle, setNewActionTitle] = useState('');

  const addAction = () => {
    if (!newActionTitle.trim()) return;
    setQuickActions(prev => [...prev, { title: newActionTitle.trim(), due_days: 7 }]);
    setNewActionTitle('');
  };

  const removeAction = (index: number) => {
    setQuickActions(prev => prev.filter((_, i) => i !== index));
  };

  // @ts-ignore
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!summary.trim()) throw new Error('Resumo é obrigatório');

      let lat: number | null = null;
      let lon: number | null = null;
      try {
        await geo.getLocation();
        lat = geo.latitude;
        lon = geo.longitude;
      } catch { /* proceed */ }

      // Update visit
      const { error } = await supabase
        .from('crm_visits')
        .update({
          status: 'concluida',
          summary: summary.trim(),
          checkout_at: new Date().toISOString(),
          checkout_lat: lat,
          checkout_lon: lon,
        })
        .eq('id', visitId);
      if (error) throw error;

      // Create batch actions
      if (quickActions.length > 0) {
        const actionInserts = quickActions.map(a => ({
          client_id: clientId,
          title: a.title,
          type: 'tarefa' as const,
          status: 'aberta' as const,
          priority: 3,
          due_at: new Date(Date.now() + a.due_days * 86400000).toISOString(),
          owner_user_id: user!.id,
          created_by: user!.id,
        }));
        const { error: actErr } = await supabase.from('crm_actions').insert(actionInserts);
        if (actErr) throw actErr;
      }
    },
    onSuccess: () => {
      toast({ title: 'Visita finalizada com sucesso!' });
      onOpenChange(false);
      onFinalized();
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar Visita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Resumo da visita *</Label>
            <Textarea
              placeholder="O que foi realizado nesta visita..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Quick actions */}
          <div className="space-y-2">
            <Label>Ações de follow-up (opcional)</Label>
            {quickActions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{a.title}</span>
                <span className="text-muted-foreground shrink-0">{a.due_days}d</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAction(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Título da ação..."
                value={newActionTitle}
                onChange={e => setNewActionTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAction())}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={addAction} disabled={!newActionTitle.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending || !summary.trim()}>
            {finalizeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Finalizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
