import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Wrench, ChevronDown, ChevronRight, Pencil, History, Shield, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface WarrantyBatch {
  batch_number: string;
  status: string;
}

interface MotorReplacementHistory {
  id: string;
  replaced_at_meter_hours: number;
  motor_hours_used: number;
  old_motor_code: string | null;
  new_motor_code: string | null;
  replaced_at: string;
  notes: string | null;
  work_order_id: string | null;
  warranty_batch_id: string | null;
  warranty_batches?: WarrantyBatch | null;
}

interface MotorSectionProps {
  workshopItemId: string;
  isAdmin: boolean;
  currentMeterValue?: number;
  workOrderId?: string;
  workOrderStatus?: 'aguardando' | 'em_manutencao' | 'concluido';
}

export function MotorSection({ 
  workshopItemId, 
  isAdmin, 
  currentMeterValue,
  workOrderId,
  workOrderStatus 
}: MotorSectionProps) {
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

  // Fetch motor replacement history with warranty batch info
  const { data: motorHistory = [] } = useQuery({
    queryKey: ['motor-history', workshopItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('motor_replacement_history')
        .select(`
          *,
          warranty_batches:warranty_batch_id (batch_number, status)
        `)
        .eq('workshop_item_id', workshopItemId)
        .order('replaced_at', { ascending: false });
      if (error) throw error;
      return data as unknown as MotorReplacementHistory[];
    },
    enabled: !!workshopItemId,
  });

  // Fetch warranty hours config
  const { data: warrantyHoursConfig } = useQuery({
    queryKey: ['warranty-hours-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'garantia_motor_horas')
        .maybeSingle();
      if (error) throw error;
      return data?.valor ? parseInt(data.valor) : 400;
    },
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

  const warrantyLimit = warrantyHoursConfig ?? 400;
  const isCompleted = workOrderStatus === 'concluido';
  
  // Check if there was a motor replacement in THIS work order
  const replacementInThisOS = workOrderId 
    ? motorHistory.find(h => h.work_order_id === workOrderId)
    : null;

  // Determine what to display based on OS status and motor replacement
  let displayMotorCode: string | null = null;
  let displayMotorHours: number = 0;
  let displayLabel: string = 'Motor Atual';
  let showReplacedMotor = false;

  if (isCompleted && replacementInThisOS) {
    // OS concluída COM troca de motor - mostrar motor RETIRADO
    displayMotorCode = replacementInThisOS.old_motor_code;
    displayMotorHours = replacementInThisOS.motor_hours_used;
    displayLabel = 'Motor Retirado';
    showReplacedMotor = true;
  } else {
    // OS em andamento ou sem troca - mostrar motor ATUAL
    const currentMotorCode = (workshopItem as { current_motor_code?: string | null } | undefined)?.current_motor_code;
    const meterHoursLast = workshopItem?.meter_hours_last ?? 0;
    const motorReplacedAt = workshopItem?.motor_replaced_at_meter_hours ?? 0;
    const effectiveMeter = currentMeterValue ?? meterHoursLast;
    
    displayMotorCode = currentMotorCode ?? null;
    displayMotorHours = Math.max(0, effectiveMeter - motorReplacedAt);
    displayLabel = 'Motor Atual';
  }

  const isWithinWarranty = displayMotorHours < warrantyLimit;

  // Filter history to exclude the motor shown in main display (if showing replaced motor)
  const historyToShow = showReplacedMotor
    ? motorHistory.filter(h => h.id !== replacementInThisOS?.id)
    : motorHistory;

  return (
    <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Motor
          {showReplacedMotor && (
            <Badge variant="outline" className="text-xs font-normal">
              Troca nesta OS
            </Badge>
          )}
        </p>
        <div className="flex items-center gap-2">
          {isAdmin && !isCompleted && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => {
                setNewMotorCode(displayMotorCode || '');
                setEditDialogOpen(true);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Motor info with warranty badge inline */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">{displayLabel}:</span>
          <p className="font-mono font-medium">
            {displayMotorCode || <span className="text-muted-foreground italic">Não informado</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div>
            <span className="text-muted-foreground">Horas Motor:</span>
            <p className="font-mono font-medium">{displayMotorHours.toFixed(0)}h</p>
          </div>
          <Badge 
            variant={isWithinWarranty ? "default" : "secondary"}
            className={`text-xs ${isWithinWarranty 
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100" 
              : "bg-muted text-muted-foreground"
            }`}
          >
            <Shield className="h-3 w-3 mr-1" />
            {isWithinWarranty ? 'Garantia' : 'S/ Garantia'}
          </Badge>
        </div>
      </div>

      {/* Show new motor installed if this OS had a replacement */}
      {showReplacedMotor && replacementInThisOS?.new_motor_code && (
        <div className="text-sm pt-2 border-t">
          <span className="text-muted-foreground">Motor Instalado:</span>
          <p className="font-mono font-medium">{replacementInThisOS.new_motor_code}</p>
        </div>
      )}

      {/* History collapsible */}
      {historyToShow.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between p-2 h-auto">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <History className="h-3 w-3" />
                Histórico de Trocas ({historyToShow.length})
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
              {historyToShow.map((entry) => {
                const entryWithinWarranty = entry.motor_hours_used < warrantyLimit;
                const batchInfo = entry.warranty_batches;
                return (
                  <div
                    key={entry.id}
                    className="p-2 border rounded bg-background space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">
                        {entry.old_motor_code || '(sem cód)'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className="font-mono text-xs"
                        >
                          {entry.motor_hours_used.toFixed(0)}h
                        </Badge>
                        <Badge 
                          variant={entryWithinWarranty ? "default" : "secondary"}
                          className={`text-xs ${entryWithinWarranty 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" 
                            : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {entryWithinWarranty ? 'Garantia' : 'S/ Garantia'}
                        </Badge>
                      </div>
                    </div>
                    {/* Show warranty batch info if exists */}
                    {batchInfo && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span className="font-mono">{batchInfo.batch_number}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] px-1 py-0 ${
                            batchInfo.status === 'finalizada' 
                              ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400' 
                              : ''
                          }`}
                        >
                          {batchInfo.status === 'finalizada' ? 'Finalizada' : 'Aberta'}
                        </Badge>
                      </div>
                    )}
                    {/* Show pending warranty indicator */}
                    {!batchInfo && entryWithinWarranty && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <FileText className="h-3 w-3" />
                        <span>Pendente de requisição</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {historyToShow.length === 0 && !showReplacedMotor && (
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
