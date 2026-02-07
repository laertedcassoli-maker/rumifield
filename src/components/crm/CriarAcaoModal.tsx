import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientProductId?: string | null;
  onCreated?: () => void;
}

export function CriarAcaoModal({ open, onOpenChange, clientId, clientProductId, onCreated }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('tarefa');
  const [priority, setPriority] = useState('3');
  const [dueAt, setDueAt] = useState('');
  const [status, setStatus] = useState<string>('pendente');

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('crm_actions').insert([{
        client_id: clientId,
        client_product_id: clientProductId || null,
        title,
        description: description || null,
        type: type as any,
        status: status as any,
        priority: Number(priority),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        owner_user_id: user!.id,
        created_by: user!.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ação criada!');
      queryClient.invalidateQueries({ queryKey: ['crm-'] });
      queryClient.invalidateQueries({ queryKey: ['crm-360-actions'] });
      onOpenChange(false);
      setTitle(''); setDescription(''); setType('tarefa'); setPriority('3'); setDueAt(''); setStatus('pendente');
      onCreated?.();
    },
    onError: () => toast.error('Erro ao criar ação'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Ação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Agendar reunião de apresentação" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tarefa">Tarefa</SelectItem>
                  <SelectItem value="pendencia">Pendência</SelectItem>
                  <SelectItem value="oportunidade">Oportunidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Alta</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3 - Média</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5 - Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prazo</Label>
            <Input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!title.trim() || mutation.isPending}>
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
