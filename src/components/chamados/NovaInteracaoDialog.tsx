import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Phone, MessageSquare, Clock, FileText } from 'lucide-react';

const interactionTypes = [
  { value: 'call', label: 'Ligação', icon: Phone, color: 'text-blue-600' },
  { value: 'message', label: 'Mensagem', icon: MessageSquare, color: 'text-green-600' },
  { value: 'waiting', label: 'Aguardando', icon: Clock, color: 'text-orange-600' },
  { value: 'note', label: 'Nota Interna', icon: FileText, color: 'text-purple-600' },
];

interface NovaInteracaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
}

export default function NovaInteracaoDialog({
  open,
  onOpenChange,
  ticketId,
}: NovaInteracaoDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [interactionType, setInteractionType] = useState('note');
  const [notes, setNotes] = useState('');

  const createInteraction = useMutation({
    mutationFn: async () => {
      if (!notes.trim()) {
        throw new Error('A descrição da interação é obrigatória.');
      }

      const typeConfig = interactionTypes.find(t => t.value === interactionType);
      const eventDescription = `${typeConfig?.label || 'Interação'}: ${notes.substring(0, 100)}${notes.length > 100 ? '...' : ''}`;

      const { error } = await supabase
        .from('ticket_timeline')
        .insert({
          ticket_id: ticketId,
          user_id: user!.id,
          event_type: 'interaction',
          event_description: eventDescription,
          interaction_type: interactionType,
          notes: notes.trim(),
        });

      if (error) throw error;

      // If interaction type is "waiting", update substatus to aguardando_cliente
      if (interactionType === 'waiting') {
        await supabase
          .from('technical_tickets')
          .update({
            status: 'em_atendimento',
            substatus: 'aguardando_cliente',
          })
          .eq('id', ticketId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-timeline', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
      toast({ title: 'Interação registrada!' });
      setNotes('');
      setInteractionType('note');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const handleSubmit = () => {
    createInteraction.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Interação</DialogTitle>
          <DialogDescription>
            Registre uma interação, ligação, mensagem ou anotação sobre este chamado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Interaction Type */}
          <div className="space-y-2">
            <Label>Tipo de Interação</Label>
            <RadioGroup
              value={interactionType}
              onValueChange={setInteractionType}
              className="grid grid-cols-2 gap-2"
            >
              {interactionTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <div key={type.value}>
                    <RadioGroupItem
                      value={type.value}
                      id={type.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={type.value}
                      className="flex items-center gap-2 rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                    >
                      <Icon className={`h-4 w-4 ${type.color}`} />
                      <span className="text-sm font-medium">{type.label}</span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Descrição</Label>
            <Textarea
              id="notes"
              placeholder="Descreva a interação, conversa ou anotação..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createInteraction.isPending || !notes.trim()}
          >
            {createInteraction.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
