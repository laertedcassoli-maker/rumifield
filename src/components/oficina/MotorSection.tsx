import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Wrench, ChevronDown, ChevronRight, Pencil, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MotorReplacementHistory {
  id: string;
  replaced_at_meter_hours: number;
  motor_hours_used: number;
  old_motor_code: string | null;
  new_motor_code: string | null;
  replaced_at: string;
  notes: string | null;
}

interface MotorSectionProps {
  workshopItemId: string;
  isAdmin: boolean;
}

export function MotorSection({ workshopItemId, isAdmin }: MotorSectionProps) {
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newMotorCode, setNewMotorCode] = useState('');

  // Fetch workshop item details
  const { data: workshopItem } = useQuery({
    queryKey: ['workshop-item-motor', workshopItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_items')
        .select('*')
        .eq('id', workshopItemId)
        .single();
      if (error) throw error;
      return data as {
        id: string;
        current_motor_code?: string | null;
        meter_hours_last: number | null;
        motor_replaced_at_meter_hours: number | null;
      };
    },
    enabled: !!workshopItemId,
  });

  // Fetch motor replacement history
  const { data: motorHistory = [] } = useQuery({
    queryKey: ['motor-history', workshopItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('motor_replacement_history')
        .select('*')
        .eq('workshop_item_id', workshopItemId)
        .order('replaced_at', { ascending: false });
      if (error) throw error;
      return data as MotorReplacementHistory[];
    },
    enabled: !!workshopItemId,
  });

  // Update motor code mutation (admin only)
  const updateMotorCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const codePattern = /^DD-\d{5}$/;
      if (code && !codePattern.test(code)) {
        throw new Error('Código deve seguir o formato DD-XXXXX (5 dígitos)');
      }

      const { error } = await supabase
        .from('workshop_items')
        .update({ current_motor_code: code || null } as never)
        .eq('id', workshopItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-item-motor', workshopItemId] });
      setEditDialogOpen(false);
      setNewMotorCode('');
      toast.success('Código do motor atualizado!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const currentMotorCode = (workshopItem as { current_motor_code?: string | null } | undefined)?.current_motor_code;
  const meterHoursLast = workshopItem?.meter_hours_last ?? 0;
  const motorReplacedAt = workshopItem?.motor_replaced_at_meter_hours ?? 0;
  const motorHours = meterHoursLast - motorReplacedAt;

  return (
    <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Motor
        </p>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => {
              setNewMotorCode(currentMotorCode || '');
              setEditDialogOpen(true);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Current motor info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Motor Atual:</span>
          <p className="font-mono font-medium">
            {currentMotorCode || <span className="text-muted-foreground italic">Não informado</span>}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Horas Motor:</span>
          <p className="font-mono font-medium">{motorHours.toFixed(0)}h</p>
        </div>
      </div>

      {/* History collapsible */}
      {motorHistory.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between p-2 h-auto">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <History className="h-3 w-3" />
                Histórico de Trocas ({motorHistory.length})
              </span>
              {historyOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2 text-xs">
              {motorHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="p-2 border rounded bg-background flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {format(new Date(entry.replaced_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {entry.motor_hours_used.toFixed(0)}h usadas
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-muted-foreground">
                      {entry.old_motor_code || '(sem cód)'}
                    </span>
                    <span>→</span>
                    <span className="font-medium">
                      {entry.new_motor_code || '(sem cód)'}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    Horímetro: {entry.replaced_at_meter_hours.toFixed(0)}h
                  </p>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {motorHistory.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Nenhuma troca de motor registrada
        </p>
      )}

      {/* Edit motor code dialog (admin only) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Código do Motor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código do Motor Atual</Label>
              <Input
                placeholder="DD-00000"
                value={newMotorCode}
                onChange={(e) => setNewMotorCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formato: DD-XXXXX (5 dígitos). Deixe vazio para remover.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => updateMotorCodeMutation.mutate(newMotorCode)}
              disabled={updateMotorCodeMutation.isPending}
            >
              {updateMotorCodeMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
