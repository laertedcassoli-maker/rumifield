import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
}

export default function FinalizarChamadoDialog({ open, onOpenChange, ticketId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [resolutionSummary, setResolutionSummary] = useState('');

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();

      const { error } = await withTimeout(
        supabase
          .from('technical_tickets')
          .update({
            status: 'resolvido',
            substatus: null,
            resolved_at: now,
            resolution_summary: resolutionSummary.trim() || null,
          })
          .eq('id', ticketId)
      );

      if (error) throw error;

      const { error: tlError } = await supabase.from('ticket_timeline').insert({
        ticket_id: ticketId,
        user_id: user!.id,
        event_type: 'status_change',
        event_description: 'Chamado finalizado e marcado como resolvido',
      });
      if (tlError) throw tlError;
    },
    onSuccess: () => {
      toast({ title: 'Chamado finalizado com sucesso!' });
      setResolutionSummary('');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-timeline', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['technical-tickets'] });
      navigate('/chamados');
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao finalizar', description: e.message });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar Chamado</AlertDialogTitle>
          <AlertDialogDescription>
            O chamado será marcado como resolvido. Descreva brevemente a resolução aplicada.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="resolution">Resumo da resolução (opcional)</Label>
            <Textarea
              id="resolution"
              placeholder="Descreva o que foi feito para resolver o problema..."
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={finalizeMutation.isPending}>Cancelar</AlertDialogCancel>
          <Button
            onClick={() => finalizeMutation.mutate()}
            disabled={finalizeMutation.isPending}
          >
            {finalizeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Finalizar Chamado
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
