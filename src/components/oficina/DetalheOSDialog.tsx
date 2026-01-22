import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Play, Pause, Square, Plus, Trash2, Clock, Package, CheckCircle, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WorkOrder {
  id: string;
  code: string;
  activity_id: string;
  status: 'aguardando' | 'em_manutencao' | 'concluido';
  assigned_to_user_id: string | null;
  total_time_seconds: number;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  activities?: {
    id: string;
    name: string;
    execution_type: string;
  };
}

interface TimeEntry {
  id: string;
  work_order_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: 'running' | 'paused' | 'finished';
}

interface PartUsed {
  id: string;
  work_order_id: string;
  omie_product_id: string;
  quantity: number;
  notes: string | null;
  pecas?: {
    nome: string;
    codigo: string;
  };
}

interface WorkOrderItem {
  id: string;
  workshop_item_id: string | null;
  omie_product_id: string | null;
  meter_hours_entry: number | null;
  meter_hours_exit: number | null;
  workshop_items?: {
    unique_code: string;
    meter_hours_last: number | null;
    motor_replaced_at_meter_hours: number | null;
    omie_product_id?: string;
  } | null;
  product_name?: string;
}

interface Peca {
  id: string;
  codigo: string;
  nome: string;
}

interface DetalheOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder;
  onUpdate: () => void;
}

export function DetalheOSDialog({ open, onOpenChange, workOrder, onUpdate }: DetalheOSDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [elapsedTime, setElapsedTime] = useState(workOrder.total_time_seconds);
  const [addPartDialogOpen, setAddPartDialogOpen] = useState(false);
  const [selectedPecaId, setSelectedPecaId] = useState('');
  const [partQuantity, setPartQuantity] = useState(1);
  const [meterHoursExit, setMeterHoursExit] = useState('');
  const [isMotorReplacement, setIsMotorReplacement] = useState(false);

  // Fetch active time entry for this user on this OS
  const { data: activeTimeEntry } = useQuery({
    queryKey: ['active-time-entry', workOrder.id, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('work_order_time_entries')
        .select('*')
        .eq('work_order_id', workOrder.id)
        .eq('user_id', user.id)
        .eq('status', 'running')
        .maybeSingle();
      if (error) throw error;
      return data as TimeEntry | null;
    },
    enabled: open && !!user?.id,
    refetchInterval: (query) => query.state.data ? 1000 : false,
  });

  // Fetch parts used
  const { data: partsUsed = [] } = useQuery({
    queryKey: ['parts-used', workOrder.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_order_parts_used')
        .select(`
          *,
          pecas:omie_product_id (nome, codigo)
        `)
        .eq('work_order_id', workOrder.id)
        .order('created_at');
      if (error) throw error;
      return data as PartUsed[];
    },
    enabled: open,
  });

  // Fetch work order items
  const { data: workOrderItems = [] } = useQuery({
    queryKey: ['work-order-items', workOrder.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_order_items')
        .select(`
          *,
          workshop_items:workshop_item_id (unique_code, meter_hours_last, motor_replaced_at_meter_hours, omie_product_id)
        `)
        .eq('work_order_id', workOrder.id);
      if (error) throw error;

      // Fetch product names for workshop items
      const productIds: string[] = [];
      data?.forEach(item => {
        if (item.workshop_items?.omie_product_id) {
          productIds.push(item.workshop_items.omie_product_id);
        } else if (item.omie_product_id) {
          productIds.push(item.omie_product_id);
        }
      });

      let productsMap: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('pecas')
          .select('id, nome')
          .in('id', productIds);
        productsMap = (products || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome }), {});
      }

      return (data || []).map(item => {
        const productId = item.workshop_items?.omie_product_id || item.omie_product_id;
        return {
          ...item,
          product_name: productId ? productsMap[productId] : undefined,
        };
      }) as WorkOrderItem[];
    },
    enabled: open,
  });

  // Fetch pecas for adding parts
  const { data: pecas = [] } = useQuery({
    queryKey: ['pecas-for-parts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pecas')
        .select('id, codigo, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as Peca[];
    },
    enabled: addPartDialogOpen,
  });

  // Timer effect
  useEffect(() => {
    const currentEntry = activeTimeEntry;
    if (!currentEntry) {
      setElapsedTime(workOrder.total_time_seconds);
      return;
    }

    const interval = setInterval(() => {
      const runningTime = Math.floor((Date.now() - new Date(currentEntry.started_at).getTime()) / 1000);
      setElapsedTime(workOrder.total_time_seconds + runningTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimeEntry, workOrder.total_time_seconds]);

  // Start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Check for existing running timer for this user
      const { data: existingTimer } = await supabase
        .from('work_order_time_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'running')
        .maybeSingle();

      if (existingTimer) {
        throw new Error('Você já tem um cronômetro ativo em outra OS');
      }

      // Update OS status to em_manutencao if aguardando
      if (workOrder.status === 'aguardando') {
        const { error: updateError } = await supabase
          .from('work_orders')
          .update({ 
            status: 'em_manutencao',
            start_time: new Date().toISOString(),
          })
          .eq('id', workOrder.id);
        if (updateError) throw updateError;
      }

      // Create time entry
      const { error } = await supabase
        .from('work_order_time_entries')
        .insert({
          work_order_id: workOrder.id,
          user_id: user.id,
          status: 'running',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-time-entry', workOrder.id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      onUpdate();
      toast.success('Cronômetro iniciado!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: async () => {
      if (!activeTimeEntry) throw new Error('Nenhum cronômetro ativo');

      const endedAt = new Date();
      const durationSeconds = Math.floor((endedAt.getTime() - new Date(activeTimeEntry.started_at).getTime()) / 1000);

      // Update time entry
      const { error: entryError } = await supabase
        .from('work_order_time_entries')
        .update({
          ended_at: endedAt.toISOString(),
          duration_seconds: durationSeconds,
          status: 'finished',
        })
        .eq('id', activeTimeEntry.id);
      if (entryError) throw entryError;

      // Update work order total time
      const { error: osError } = await supabase
        .from('work_orders')
        .update({
          total_time_seconds: workOrder.total_time_seconds + durationSeconds,
        })
        .eq('id', workOrder.id);
      if (osError) throw osError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-time-entry', workOrder.id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      onUpdate();
      toast.success('Cronômetro parado!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Add part mutation
  const addPartMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedPecaId) throw new Error('Dados obrigatórios não preenchidos');

      const { error } = await supabase
        .from('work_order_parts_used')
        .insert({
          work_order_id: workOrder.id,
          omie_product_id: selectedPecaId,
          quantity: partQuantity,
          added_by_user_id: user.id,
        });
      if (error) throw error;

      // Check if added part contains "motor" in name - auto-mark replacement
      const addedPart = pecas.find(p => p.id === selectedPecaId);
      if (addedPart?.nome?.toLowerCase().includes('motor')) {
        return { isMotorPart: true, partName: addedPart.nome };
      }
      return { isMotorPart: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['parts-used', workOrder.id] });
      setAddPartDialogOpen(false);
      setSelectedPecaId('');
      setPartQuantity(1);
      
      if (result?.isMotorPart) {
        setIsMotorReplacement(true);
        toast.success(`Peça "${result.partName}" adicionada! Troca de motor marcada automaticamente.`, {
          duration: 5000,
        });
      } else {
        toast.success('Peça adicionada!');
      }
    },
    onError: (error) => {
      toast.error('Erro ao adicionar peça: ' + error.message);
    },
  });

  // Remove part mutation
  const removePartMutation = useMutation({
    mutationFn: async (partId: string) => {
      const { error } = await supabase
        .from('work_order_parts_used')
        .delete()
        .eq('id', partId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-used', workOrder.id] });
      toast.success('Peça removida!');
    },
  });

  // Complete OS mutation
  const completeOSMutation = useMutation({
    mutationFn: async () => {
      // Stop any active timer first
      if (activeTimeEntry) {
        await stopTimerMutation.mutateAsync();
      }

      // Update meter hours exit if provided
      const univocaItem = workOrderItems.find(item => item.workshop_item_id);
      if (univocaItem && meterHoursExit) {
        const exitValue = parseFloat(meterHoursExit);
        
        // Update work order item
        const { error: itemError } = await supabase
          .from('work_order_items')
          .update({ meter_hours_exit: exitValue })
          .eq('id', univocaItem.id);
        if (itemError) throw itemError;

        // Update workshop item meter hours
        if (univocaItem.workshop_item_id) {
          const workshopUpdate: { 
            meter_hours_last: number; 
            status: string; 
            motor_replaced_at_meter_hours?: number; 
          } = {
            meter_hours_last: exitValue,
            status: 'disponivel',
          };

          // If motor was replaced, set the motor replacement marker
          if (isMotorReplacement) {
            workshopUpdate.motor_replaced_at_meter_hours = exitValue;
          }

          const { error: workshopError } = await supabase
            .from('workshop_items')
            .update(workshopUpdate)
            .eq('id', univocaItem.workshop_item_id);
          if (workshopError) throw workshopError;

          // Create meter reading record
          const { error: readingError } = await supabase
            .from('asset_meter_readings')
            .insert({
              workshop_item_id: univocaItem.workshop_item_id,
              work_order_id: workOrder.id,
              reading_value: exitValue,
              user_id: user?.id,
              notes: isMotorReplacement ? 'Troca de motor realizada' : null,
            });
          if (readingError) throw readingError;
        }
      } else if (univocaItem?.workshop_item_id) {
        // Just update status to disponivel
        const { error: workshopError } = await supabase
          .from('workshop_items')
          .update({ status: 'disponivel' })
          .eq('id', univocaItem.workshop_item_id);
        if (workshopError) throw workshopError;
      }

      // Complete the work order
      const { error } = await supabase
        .from('work_orders')
        .update({
          status: 'concluido',
          end_time: new Date().toISOString(),
        })
        .eq('id', workOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['workshop-items'] });
      onUpdate();
      onOpenChange(false);
      toast.success('OS concluída com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao concluir OS: ' + error.message);
    },
  });

  // Check if any part contains "motor" in name - for visual indicator
  const hasMotorPart = partsUsed.some(part => 
    part.pecas?.nome?.toLowerCase().includes('motor')
  );

  // Auto-detect motor parts when parts list changes
  useEffect(() => {
    if (hasMotorPart && !isMotorReplacement) {
      setIsMotorReplacement(true);
    }
  }, [hasMotorPart]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const statusLabels: Record<string, string> = {
    aguardando: 'Aguardando',
    em_manutencao: 'Em Manutenção',
    concluido: 'Concluído',
  };

  const univocaItem = workOrderItems.find(item => item.workshop_item_id);
  const requiresMeterHoursExit = workOrder.activities?.execution_type === 'UNIVOCA' && univocaItem;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{workOrder.code}</span>
              <Badge variant={workOrder.status === 'concluido' ? 'default' : 'secondary'}>
                {statusLabels[workOrder.status]}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Activity Info */}
            <div>
              <p className="text-sm text-muted-foreground">Atividade</p>
              <p className="font-medium">{workOrder.activities?.name}</p>
              <Badge variant="outline" className="mt-1">
                {workOrder.activities?.execution_type}
              </Badge>
            </div>

            {/* Timer Section */}
            {workOrder.status !== 'concluido' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Cronômetro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl">{formatTime(elapsedTime)}</span>
                    <div className="flex gap-2">
                      {!activeTimeEntry ? (
                        <Button
                          size="sm"
                          onClick={() => startTimerMutation.mutate()}
                          disabled={startTimerMutation.isPending}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Iniciar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => stopTimerMutation.mutate()}
                          disabled={stopTimerMutation.isPending}
                        >
                          <Square className="h-4 w-4 mr-1" />
                          Parar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Item Info (if UNIVOCA) */}
            {univocaItem && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Item</p>
                <div className="p-3 border rounded-lg space-y-3">
                  <div>
                    <Badge variant="secondary" className="font-mono text-sm">
                      {univocaItem.workshop_items?.unique_code}
                    </Badge>
                    {univocaItem.product_name && (
                      <p className="text-sm text-muted-foreground break-words whitespace-normal mt-1">
                        {univocaItem.product_name}
                      </p>
                    )}
                  </div>

                  {/* Meter readings section - simplified */}
                  {univocaItem.workshop_items?.meter_hours_last != null && (
                    <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-slate-300 dark:border-slate-600">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Horas total:</span>
                        <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                          {univocaItem.workshop_items.meter_hours_last.toFixed(0)}h
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <Wrench className="h-4 w-4" />
                          Horas motor:
                        </span>
                        <span className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400">
                          {univocaItem.workshop_items.motor_replaced_at_meter_hours != null
                            ? (univocaItem.workshop_items.meter_hours_last - univocaItem.workshop_items.motor_replaced_at_meter_hours).toFixed(0)
                            : univocaItem.workshop_items.meter_hours_last.toFixed(0)
                          }h
                        </span>
                      </div>
                      {univocaItem.workshop_items.motor_replaced_at_meter_hours != null && (
                        <p className="text-xs text-muted-foreground mt-1 text-right">
                          (troca registrada em {univocaItem.workshop_items.motor_replaced_at_meter_hours}h)
                        </p>
                      )}
                    </div>
                  )}

                  {univocaItem.meter_hours_entry && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Horímetro entrada nesta OS: {univocaItem.meter_hours_entry}h
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Parts Used Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  Peças Utilizadas
                </p>
                {workOrder.status !== 'concluido' && (
                  <Button size="sm" variant="outline" onClick={() => setAddPartDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                )}
              </div>
              {partsUsed.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg">
                  Nenhuma peça registrada
                </div>
              ) : (
                <div className="space-y-2">
                  {partsUsed.map((part) => {
                    const isMotor = part.pecas?.nome?.toLowerCase().includes('motor');
                    return (
                      <div
                        key={part.id}
                        className={`flex items-center justify-between p-2 border rounded-lg ${
                          isMotor ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isMotor && (
                            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          )}
                          <div>
                            <p className={`font-medium text-sm ${isMotor ? 'text-amber-800 dark:text-amber-200' : ''}`}>
                              {part.pecas?.nome}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {part.pecas?.codigo} • Qtd: {part.quantity}
                            </p>
                          </div>
                        </div>
                        {workOrder.status !== 'concluido' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removePartMutation.mutate(part.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Complete Section */}
            {workOrder.status !== 'concluido' && (
              <div className="space-y-4">
                {requiresMeterHoursExit && (
                  <>
                    <div>
                      <Label>Horímetro na Saída (horas)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={meterHoursExit}
                        onChange={(e) => setMeterHoursExit(e.target.value)}
                        placeholder={univocaItem?.workshop_items?.meter_hours_last 
                          ? `Último: ${univocaItem.workshop_items.meter_hours_last}h` 
                          : '0'}
                      />
                    </div>
                    {/* Motor replacement checkbox */}
                    <div 
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        isMotorReplacement 
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setIsMotorReplacement(!isMotorReplacement)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isMotorReplacement ? 'bg-amber-200 dark:bg-amber-800' : 'bg-muted'}`}>
                          <Wrench className={`h-4 w-4 ${isMotorReplacement ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isMotorReplacement ? 'text-amber-800 dark:text-amber-200' : ''}`}>
                            Troca de Motor
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Marque se o motor foi substituído nesta manutenção
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isMotorReplacement 
                            ? 'bg-amber-500 border-amber-500' 
                            : 'border-muted-foreground'
                        }`}>
                          {isMotorReplacement && <CheckCircle className="h-4 w-4 text-white" />}
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <Button
                  className="w-full"
                  onClick={() => completeOSMutation.mutate()}
                  disabled={completeOSMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {completeOSMutation.isPending ? 'Concluindo...' : 'Concluir OS'}
                </Button>
              </div>
            )}

            {/* Notes */}
            {workOrder.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Observações</p>
                <p className="text-sm">{workOrder.notes}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-muted-foreground">
              Criada em: {format(new Date(workOrder.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Part Dialog */}
      <Dialog open={addPartDialogOpen} onOpenChange={setAddPartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Peça</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Peça</Label>
              <Select value={selectedPecaId} onValueChange={setSelectedPecaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a peça" />
                </SelectTrigger>
                <SelectContent>
                  {pecas.map((peca) => (
                    <SelectItem key={peca.id} value={peca.id}>
                      {peca.nome} ({peca.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={partQuantity}
                onChange={(e) => setPartQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPartDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => addPartMutation.mutate()} 
              disabled={!selectedPecaId || addPartMutation.isPending}
            >
              {addPartMutation.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
