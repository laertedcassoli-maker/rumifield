import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '@/integrations/supabase/client';
import { offlineDb } from '@/lib/offline-db';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Plus, Minus, X, Loader2, Save, Undo2, ImageIcon, History, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EditarPedidoSolicitadoProps {
  pedido: any;
  onSaved: (updatedPedido: any) => void;
  onCancel: () => void;
}

interface PendingChange {
  type: 'cancel' | 'add' | 'qty_change';
  itemId?: string;
  pecaId?: string;
  oldQty?: number;
  newQty?: number;
}

interface LogEntry {
  id: string;
  action: string;
  peca_codigo: string | null;
  peca_nome: string | null;
  old_quantity: number | null;
  new_quantity: number | null;
  created_at: string;
  user_id: string;
}

export default function EditarPedidoSolicitado({ pedido, onSaved, onCancel }: EditarPedidoSolicitadoProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const pecas = useLiveQuery(() => offlineDb.pecas.filter(p => p.ativo !== false).toArray(), []);

  // Local state for editing
  const [items, setItems] = useState<any[]>(() =>
    (pedido.pedido_itens || []).map((it: any) => ({ ...it, _cancelled: !!it.cancelled_at }))
  );
  const [newItems, setNewItems] = useState<{ peca_id: string; quantidade: number }[]>([]);
  const [qtyChanges, setQtyChanges] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pecaSearches, setPecaSearches] = useState<Record<number, string>>({});
  const [imagePreview, setImagePreview] = useState<{ url: string; nome: string } | null>(null);

  const activeItems = items.filter(i => !i._cancelled);
  const cancelledItems = items.filter(i => i._cancelled);

  // Items already in use (to prevent duplicates)
  const usedPecaIds = [
    ...activeItems.map(i => i.peca_id),
    ...newItems.map(i => i.peca_id),
  ];

  const hasChanges = 
    items.some(i => i._cancelled && !i.cancelled_at) || // newly cancelled
    newItems.length > 0 ||
    Object.keys(qtyChanges).length > 0;

  const handleCancelItem = (itemId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, _cancelled: true } : i));
  };

  const handleUncancelItem = (itemId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, _cancelled: false } : i));
  };

  const handleQtyChange = (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    const original = pedido.pedido_itens?.find((i: any) => i.id === itemId);
    if (original && original.quantidade === newQty) {
      const next = { ...qtyChanges };
      delete next[itemId];
      setQtyChanges(next);
    } else {
      setQtyChanges(prev => ({ ...prev, [itemId]: newQty }));
    }
  };

  const addNewItem = () => {
    setNewItems(prev => [...prev, { peca_id: '', quantidade: 1 }]);
  };

  const updateNewItem = (index: number, field: 'peca_id' | 'quantidade', value: string | number) => {
    setNewItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeNewItem = (index: number) => {
    setNewItems(prev => prev.filter((_, i) => i !== index));
  };

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('pedido_item_log')
        .select('*')
        .eq('pedido_id', pedido.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar histórico' });
    } finally {
      setLoadingHistory(false);
    }
  }, [pedido.id, toast]);

  const handleToggleHistory = () => {
    if (!showHistory) {
      loadHistory();
    }
    setShowHistory(prev => !prev);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const logs: any[] = [];

      // 1. Cancel items (soft delete)
      const newlyCancelled = items.filter(i => i._cancelled && !i.cancelled_at);
      for (const item of newlyCancelled) {
        const peca = pecas?.find(p => p.id === item.peca_id) || item.pecas;
        await supabase.from('pedido_itens').update({
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
        } as any).eq('id', item.id);

        logs.push({
          pedido_id: pedido.id,
          pedido_item_id: item.id,
          peca_id: item.peca_id,
          peca_codigo: peca?.codigo || null,
          peca_nome: peca?.nome || null,
          action: 'removed',
          old_quantity: qtyChanges[item.id] ?? item.quantidade,
          new_quantity: 0,
          user_id: user.id,
        });
      }

      // 2. Quantity changes
      for (const [itemId, newQty] of Object.entries(qtyChanges)) {
        const item = items.find(i => i.id === itemId);
        if (!item || item._cancelled) continue;
        const peca = pecas?.find(p => p.id === item.peca_id) || item.pecas;

        await supabase.from('pedido_itens').update({ quantidade: newQty }).eq('id', itemId);

        logs.push({
          pedido_id: pedido.id,
          pedido_item_id: itemId,
          peca_id: item.peca_id,
          peca_codigo: peca?.codigo || null,
          peca_nome: peca?.nome || null,
          action: 'qty_changed',
          old_quantity: item.quantidade,
          new_quantity: newQty,
          user_id: user.id,
        });
      }

      // 3. Add new items
      for (const newItem of newItems) {
        if (!newItem.peca_id) continue;
        const peca = pecas?.find(p => p.id === newItem.peca_id);

        const { data: inserted, error } = await supabase
          .from('pedido_itens')
          .insert({
            pedido_id: pedido.id,
            peca_id: newItem.peca_id,
            quantidade: newItem.quantidade,
          })
          .select()
          .single();
        if (error) throw error;

        logs.push({
          pedido_id: pedido.id,
          pedido_item_id: inserted.id,
          peca_id: newItem.peca_id,
          peca_codigo: peca?.codigo || null,
          peca_nome: peca?.nome || null,
          action: 'added',
          old_quantity: 0,
          new_quantity: newItem.quantidade,
          user_id: user.id,
        });
      }

      // 4. Write all logs
      if (logs.length > 0) {
        const { error: logError } = await supabase.from('pedido_item_log').insert(logs);
        if (logError) console.error('Error writing logs:', logError);
      }

      // 5. Re-fetch the updated pedido
      const { data: refreshed } = await supabase
        .from('pedidos')
        .select('*, clientes(nome, fazenda), pedido_itens(*, pecas(nome, codigo, familia, is_asset), workshop_items:workshop_item_id(id, unique_code))')
        .eq('id', pedido.id)
        .single();

      toast({ title: 'Pedido atualizado!', description: `${logs.length} alteração(ões) registrada(s).` });
      onSaved(refreshed);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const actionLabel: Record<string, string> = {
    added: 'Adicionado',
    removed: 'Cancelado',
    qty_changed: 'Qtde alterada',
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-y-auto">
      {/* Active Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Itens do Pedido</Label>
          <Button type="button" size="sm" onClick={addNewItem} className="bg-success hover:bg-success/90 text-success-foreground h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" />
            Adicionar Item
          </Button>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {activeItems.map((item) => {
            const peca = pecas?.find(p => p.id === item.peca_id) || item.pecas;
            const currentQty = qtyChanges[item.id] ?? item.quantidade;
            const qtyChanged = qtyChanges[item.id] !== undefined;

            return (
              <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                {/* Image */}
                <div className="w-10 h-10 rounded border flex items-center justify-center bg-muted shrink-0">
                  {peca?.imagem_url ? (
                    <img src={peca.imagem_url} alt={peca?.nome} className="w-full h-full object-cover rounded" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs font-medium">{peca?.codigo}</span>
                  <p className="text-xs text-muted-foreground truncate">{peca?.nome}</p>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQtyChange(item.id, currentQty - 1)} disabled={currentQty <= 1}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className={cn("w-8 text-center font-bold text-sm", qtyChanged && "text-warning")}>{currentQty}</span>
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQtyChange(item.id, currentQty + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Cancel button */}
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => handleCancelItem(item.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          {/* New items being added */}
          {newItems.map((item, index) => {
            const selectedPeca = pecas?.find(p => p.id === item.peca_id);
            const availablePecas = pecas?.filter(p => !usedPecaIds.includes(p.id) || p.id === item.peca_id) || [];

            return (
              <div key={`new-${index}`} className="p-2 rounded-lg border border-dashed border-success/50 bg-success/5 space-y-2">
                {selectedPeca ? (
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded border flex items-center justify-center bg-muted shrink-0">
                      {selectedPeca.imagem_url ? (
                        <img src={selectedPeca.imagem_url} alt={selectedPeca.nome} className="w-full h-full object-cover rounded" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-medium">{selectedPeca.codigo}</span>
                      <p className="text-xs text-muted-foreground truncate">{selectedPeca.nome}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => updateNewItem(index, 'quantidade', Math.max(1, item.quantidade - 1))} disabled={item.quantidade <= 1}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-bold text-sm">{item.quantidade}</span>
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => updateNewItem(index, 'quantidade', item.quantidade + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeNewItem(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Buscar peça..."
                        value={pecaSearches[index] || ''}
                        onChange={(e) => setPecaSearches(prev => ({ ...prev, [index]: e.target.value }))}
                        className="h-8 text-xs"
                        autoFocus
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeNewItem(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto border rounded bg-background">
                      {availablePecas
                        .filter(p => {
                          const terms = (pecaSearches[index] || '').toLowerCase().split(/\s+/).filter(Boolean);
                          if (terms.length === 0) return true;
                          return terms.every(t => p.codigo.toLowerCase().includes(t) || p.nome.toLowerCase().includes(t));
                        })
                        .slice(0, 15)
                        .map(p => (
                          <div
                            key={p.id}
                            className="px-2 py-1.5 cursor-pointer hover:bg-muted border-b last:border-b-0 text-xs"
                            onClick={() => {
                              updateNewItem(index, 'peca_id', p.id);
                              setPecaSearches(prev => ({ ...prev, [index]: '' }));
                            }}
                          >
                            <span className="font-mono font-medium">{p.codigo}</span>
                            <span className="text-muted-foreground ml-2">{p.nome}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cancelled items (greyed out) */}
      {cancelledItems.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Itens Cancelados</Label>
          {cancelledItems.map((item) => {
            const peca = pecas?.find(p => p.id === item.peca_id) || item.pecas;
            const isNewlyCancelled = !item.cancelled_at;

            return (
              <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 opacity-60">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs line-through">{peca?.codigo} - {peca?.nome}</span>
                  <span className="text-xs text-muted-foreground ml-2">x{item.quantidade}</span>
                </div>
                {isNewlyCancelled && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleUncancelItem(item.id)}>
                    <Undo2 className="h-3 w-3 mr-1" />
                    Desfazer
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Total (active only) */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border text-sm">
        <span className="text-muted-foreground">Total ativo</span>
        <span className="font-bold">
          {activeItems.length} {activeItems.length === 1 ? 'peça' : 'peças'},{' '}
          {activeItems.reduce((sum, i) => sum + (qtyChanges[i.id] ?? i.quantidade), 0)} un.
        </span>
      </div>

      <Separator />

      {/* History toggle */}
      <Button type="button" variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={handleToggleHistory}>
        <History className="h-3 w-3" />
        {showHistory ? 'Ocultar Histórico' : 'Ver Histórico de Alterações'}
      </Button>

      {showHistory && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {loadingHistory ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhuma alteração registrada ainda.</p>
          ) : (
            history.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs p-1.5 rounded bg-muted/30">
                <Clock className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "font-medium",
                    log.action === 'added' && 'text-success',
                    log.action === 'removed' && 'text-destructive',
                    log.action === 'qty_changed' && 'text-warning',
                  )}>
                    {actionLabel[log.action] || log.action}
                  </span>
                  {' '}
                  <span className="font-mono">{log.peca_codigo}</span>
                  {' '}
                  <span className="text-muted-foreground">{log.peca_nome}</span>
                  {log.action === 'qty_changed' && (
                    <span className="text-muted-foreground"> ({log.old_quantity} → {log.new_quantity})</span>
                  )}
                  {log.action === 'added' && log.new_quantity && (
                    <span className="text-muted-foreground"> (x{log.new_quantity})</span>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0">
                  {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2 sticky bottom-0 bg-background pb-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
