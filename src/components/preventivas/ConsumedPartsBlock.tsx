import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '@/integrations/supabase/client';
import { offlineChecklistDb } from '@/lib/offline-checklist-db';
import { offlineDb } from '@/lib/offline-db';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Package, ChevronUp, ChevronDown, Warehouse, Truck, Plus, Trash2, Check, ChevronsUpDown, PenLine, ShoppingCart, ArrowLeft } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ConsumedPart {
  id: string;
  part_id: string;
  part_code_snapshot: string;
  part_name_snapshot: string;
  quantity: number;
  unit_cost_snapshot: number | null;
  stock_source: 'fazenda' | 'tecnico' | 'novo_pedido' | null;
  asset_unique_code: string | null;
  notes: string | null;
  is_manual: boolean;
  consumed_at: string;
}

interface ConsumedPartsBlockProps {
  preventiveId: string;
  isCompleted?: boolean;
}

export default function ConsumedPartsBlock({ preventiveId, isCompleted = false }: ConsumedPartsBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPartSelectorOpen, setIsPartSelectorOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [stockSource, setStockSource] = useState<'tecnico' | 'fazenda' | 'novo_pedido'>('tecnico');
  const [dialogAssetCode, setDialogAssetCode] = useState('');
  const [deleteConfirmPartId, setDeleteConfirmPartId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Online: fetch consumed parts from Supabase
  const { data: onlineParts, isLoading: onlineLoading } = useQuery({
    queryKey: ['preventive-consumed-parts', preventiveId],
    queryFn: async ({ queryKey }) => {
      const { data, error } = await supabase
        .from('preventive_part_consumption')
        .select('id, part_id, part_code_snapshot, part_name_snapshot, quantity, unit_cost_snapshot, stock_source, asset_unique_code, notes, is_manual, consumed_at, exec_item_id, exec_nonconformity_id')
        .eq('preventive_id', preventiveId)
        .order('consumed_at', { ascending: true });

      if (error) throw error;
      const serverItems = (data || []) as (ConsumedPart & { exec_item_id?: string; exec_nonconformity_id?: string })[];

      // Merge-by-ID: preserve optimistic items not yet on server
      const existingCache = queryClient.getQueryData<any[]>(queryKey) || [];
      const serverIds = new Set(serverItems.map(i => i.id));
      // Keep optimistic items that haven't appeared on server yet
      const optimisticOnly = existingCache.filter((c: any) => !serverIds.has(c.id) && c._optimistic);

      // Fetch is_asset for each unique part_id
      const allItems = [...serverItems, ...optimisticOnly];
      const partIds = [...new Set(allItems.map(i => i.part_id))];
      if (partIds.length > 0) {
        const { data: pecasData } = await supabase
          .from('pecas')
          .select('id, is_asset')
          .in('id', partIds);
        const assetMap = new Map((pecasData || []).map((p: any) => [p.id, p.is_asset ?? false]));
        return allItems.map(i => ({ ...i, is_asset: assetMap.get(i.part_id) ?? false }));
      }

      return allItems.map(i => ({ ...i, is_asset: false }));
    },
    enabled: !!preventiveId,
    staleTime: 30_000,
    retry: 2,
    refetchOnWindowFocus: false,
    placeholderData: (prev: any) => prev,
  });

  // Always show Dexie parts reactively (includes pending items)
  const allLocalParts = useLiveQuery(
    () => preventiveId
      ? offlineChecklistDb.partConsumptions
          .filter(pc => pc.preventive_id === preventiveId)
          .toArray()
      : Promise.resolve([]),
    [preventiveId]
  );

  // Merge: always use query cache as base, overlay pending local records (deduplicate by id)
  const parts: (ConsumedPart & { is_asset: boolean })[] | undefined = (() => {
    const base = onlineParts || [];
    const baseIds = new Set(base.map(p => p.id));
    const pendingLocal = (allLocalParts || [])
      .filter(item => item._pendingSync && !baseIds.has(item.id))
      .map(item => ({
        id: item.id,
        part_id: item.part_id,
        part_code_snapshot: item.part_code_snapshot,
        part_name_snapshot: item.part_name_snapshot,
        quantity: item.quantity,
        unit_cost_snapshot: null,
        stock_source: (item.stock_source as ConsumedPart['stock_source']) || null,
        asset_unique_code: (item.asset_unique_code as string) || null,
        notes: (item.notes as string) || null,
        is_manual: item.is_manual || false,
        consumed_at: item.consumed_at || new Date().toISOString(),
        is_asset: false,
      }));
    return [...base, ...pendingLocal];
  })();
  const isLoading = onlineLoading && !onlineParts;

  // Fetch available parts for manual addition (with offline fallback)
  const { data: availableParts } = useOfflineQuery<{ id: string; codigo: string; nome: string; familia: string | null; is_asset?: boolean }[]>({
    queryKey: ['parts-catalog-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pecas')
        .select('id, codigo, nome, familia, is_asset')
        .eq('ativo', true)
        .order('familia')
        .order('nome');

      if (error) throw error;
      return data as { id: string; codigo: string; nome: string; familia: string | null; is_asset?: boolean }[];
    },
    offlineFn: async () => {
      const items = await offlineDb.pecas
        .filter(p => p.ativo !== false)
        .toArray();
      return items
        .map(p => ({
          id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          familia: p.familia ?? null,
          is_asset: p.is_asset ?? false,
        }))
        .sort((a, b) => (a.familia ?? '').localeCompare(b.familia ?? '') || a.nome.localeCompare(b.nome));
    },
    enabled: isAddDialogOpen,
  });

  // Group parts by family for display
  type PartType = { id: string; codigo: string; nome: string; familia: string | null; is_asset?: boolean };
  const groupedParts = availableParts?.reduce<Record<string, PartType[]>>((acc, part) => {
    const family = part.familia || 'Sem família';
    if (!acc[family]) acc[family] = [];
    acc[family].push(part);
    return acc;
  }, {});

  const selectedPart = availableParts?.find(p => p.id === selectedPartId);

  // Update stock source mutation
  const updateStockSourceMutation = useMutation({
    mutationFn: async ({ partId, stockSource }: { partId: string; stockSource: string }) => {
      const updateData: Record<string, unknown> = { stock_source: stockSource };
      if (stockSource !== 'tecnico') {
        updateData.asset_unique_code = null;
      }

      if (!isOnline) {
        await offlineChecklistDb.partConsumptions.update(partId, { stock_source: stockSource, _pendingSync: true });
        await offlineChecklistDb.addToSyncQueue('preventive_part_consumption', 'update', { id: partId, ...updateData });
        return;
      }

      const { error } = await supabase
        .from('preventive_part_consumption')
        .update(updateData)
        .eq('id', partId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
    },
    onError: (error: Error) => {
      if (!isOnline) return;
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  // Update asset unique code mutation
  const updateAssetCodeMutation = useMutation({
    mutationFn: async ({ partId, assetCode }: { partId: string; assetCode: string }) => {
      const value = assetCode || null;

      if (!isOnline) {
        await offlineChecklistDb.partConsumptions.update(partId, { _pendingSync: true });
        await offlineChecklistDb.addToSyncQueue('preventive_part_consumption', 'update', { id: partId, asset_unique_code: value });
        return;
      }

      const { error } = await supabase
        .from('preventive_part_consumption')
        .update({ asset_unique_code: value })
        .eq('id', partId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
    },
    onError: (error: Error) => {
      if (!isOnline) return;
      toast({ title: 'Erro ao salvar código', description: error.message, variant: 'destructive' });
    },
  });

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ partId, notes }: { partId: string; notes: string }) => {
      const value = notes || null;

      if (!isOnline) {
        await offlineChecklistDb.partConsumptions.update(partId, { _pendingSync: true });
        await offlineChecklistDb.addToSyncQueue('preventive_part_consumption', 'update', { id: partId, notes: value });
        return;
      }

      const { error } = await supabase
        .from('preventive_part_consumption')
        .update({ notes: value })
        .eq('id', partId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
    },
    onError: (error: Error) => {
      if (!isOnline) return;
      toast({ title: 'Erro ao salvar observação', description: error.message, variant: 'destructive' });
    },
  });

  // Add manual part mutation (local-first with online Supabase insert)
  const addManualPartMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPartId || !selectedPart) throw new Error('Selecione uma peça');

      const newId = crypto.randomUUID();
      const assetCode = stockSource === 'tecnico' && dialogAssetCode.trim() ? dialogAssetCode.trim() : null;

      const payload = {
        id: newId,
        preventive_id: preventiveId,
        part_id: selectedPartId,
        part_code_snapshot: selectedPart.codigo,
        part_name_snapshot: selectedPart.nome,
        quantity: parseFloat(quantity) || 1,
        stock_source: stockSource,
        exec_item_id: null,
        exec_nonconformity_id: null,
        is_manual: true,
        notes: notes || null,
        asset_unique_code: assetCode,
      };

      // Always save locally first for instant UI feedback
      await offlineChecklistDb.addPartConsumptionLocally(payload);

      if (isOnline) {
        // Online: also insert directly into Supabase
        const { error } = await (supabase as any)
          .from('preventive_part_consumption')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Optimistic: add to cache immediately
      if (selectedPartId && selectedPart) {
        const assetCode = stockSource === 'tecnico' && dialogAssetCode.trim() ? dialogAssetCode.trim() : null;
        queryClient.setQueryData(['preventive-consumed-parts', preventiveId], (old: any[]) => {
          const newPart = {
            id: crypto.randomUUID(), // approximate — reconciled on next fetch
            part_id: selectedPartId,
            part_code_snapshot: selectedPart.codigo,
            part_name_snapshot: selectedPart.nome,
            quantity: parseFloat(quantity) || 1,
            unit_cost_snapshot: null,
            stock_source: stockSource,
            asset_unique_code: assetCode,
            notes: notes || null,
            is_manual: true,
            consumed_at: new Date().toISOString(),
            is_asset: selectedPart.is_asset ?? false,
          };
          return [...(old || []), newPart];
        });
      }
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId], refetchType: 'none' });
      toast({ title: 'Peça adicionada!' });
      resetAddDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar peça', description: error.message, variant: 'destructive' });
    },
  });

  // Delete manual part mutation
  const deleteManualPartMutation = useMutation({
    mutationFn: async (partId: string) => {
      // Always remove from Dexie to prevent stale local records from reappearing
      try {
        await offlineChecklistDb.partConsumptions.delete(partId);
      } catch (_) { /* may not exist locally */ }

      if (!isOnline) {
        await offlineChecklistDb.addToSyncQueue('preventive_part_consumption', 'delete', { id: partId });
        return;
      }

      const { error } = await supabase
        .from('preventive_part_consumption')
        .delete()
        .eq('id', partId);
      if (error) throw error;
    },
    onSuccess: (_, partId) => {
      // Optimistic: remove from cache immediately
      queryClient.setQueryData(['preventive-consumed-parts', preventiveId], (old: any[]) => {
        if (!old) return old;
        return old.filter((p: any) => p.id !== partId);
      });
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId], refetchType: 'none' });
      toast({ title: 'Peça removida com sucesso' });
    },
    onError: (error: Error) => {
      if (!isOnline) {
        toast({ title: 'Peça removida com sucesso' });
        return;
      }
      toast({ title: 'Erro ao remover peça', description: error.message, variant: 'destructive' });
    },
  });

  const resetAddDialog = () => {
    setIsAddDialogOpen(false);
    setSelectedPartId(null);
    setQuantity('1');
    setNotes('');
    setStockSource('tecnico');
    setDialogAssetCode('');
    setIsPartSelectorOpen(false);
  };

  const handleStockSourceChange = (partId: string, value: string) => {
    if (value && (value === 'fazenda' || value === 'tecnico' || value === 'novo_pedido')) {
      updateStockSourceMutation.mutate({ partId, stockSource: value });
    }
  };

  const handleAssetCodeChange = (partId: string, code: string) => {
    updateAssetCodeMutation.mutate({ partId, assetCode: code });
  };

  // Calculate totals
  const totalParts = parts?.length || 0;
  const totalQuantity = parts?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;
  const totalCost = parts?.reduce((sum, p) => sum + ((p.quantity || 0) * (p.unit_cost_snapshot || 0)), 0) || 0;

  const hasParts = totalParts > 0;

  return (
    <>
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Peças</CardTitle>
                {hasParts && (
                  <Badge variant="secondary" className="ml-1">
                    {totalParts}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!hasParts && !isLoading && (
                  <span className="text-xs text-muted-foreground">Nenhuma peça</span>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
          <CardContent className="pt-0 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !hasParts ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Package className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p>Nenhuma peça registrada</p>
                <p className="text-xs mt-1">Adicione manualmente ou selecione falhas no checklist</p>
              </div>
            ) : (
              <>
                {/* Parts List */}
                <div className="space-y-3">
                  {parts?.map((part) => (
                    <PartItem
                      key={part.id}
                      part={part}
                      isCompleted={isCompleted}
                      onStockSourceChange={handleStockSourceChange}
                      onAssetCodeChange={handleAssetCodeChange}
                      onNotesChange={(partId, notes) => updateNotesMutation.mutate({ partId, notes })}
                      onDelete={(partId) => setDeleteConfirmPartId(partId)}
                    />
                  ))}
                </div>

                {/* Summary */}
                <div className="border-t pt-3 mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total de itens:</span>
                    <span className="font-medium">{totalQuantity} peça(s)</span>
                  </div>
                  {totalCost > 0 && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Custo estimado:</span>
                      <span className="font-medium">
                        {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Add Part Button */}
            {!isCompleted && (
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) resetAddDialog(); else setIsAddDialogOpen(true); }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Peça
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Adicionar Peça Manual</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Part Selector */}
                    <div className="space-y-2">
                      <Label>Peça *</Label>
                      <Popover open={isPartSelectorOpen} onOpenChange={setIsPartSelectorOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between h-auto min-h-10 whitespace-normal text-left"
                          >
                            {selectedPart ? (
                              <span className="break-words">
                                {selectedPart.codigo} - {selectedPart.nome}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Selecione uma peça...</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0" align="start">
                          <Command
                            filter={(value, search) => {
                              if (!search) return 1;
                              const searchWords = search.toLowerCase().split(/\s+/).filter(Boolean);
                              const itemText = value.toLowerCase();
                              return searchWords.every(word => itemText.includes(word)) ? 1 : 0;
                            }}
                          >
                            <CommandInput placeholder="Buscar peça..." />
                            <CommandList className="max-h-64">
                              <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
                              {groupedParts && Object.entries(groupedParts).map(([family, familyParts]) => (
                                <CommandGroup key={family} heading={family}>
                                  {familyParts?.map(part => (
                                    <CommandItem
                                      key={part.id}
                                      value={`${part.codigo} ${part.nome} ${part.familia || ''}`}
                                      onSelect={() => {
                                        setSelectedPartId(part.id);
                                        setIsPartSelectorOpen(false);
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <Check
                                        className={cn(
                                          "h-4 w-4",
                                          selectedPartId === part.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <span className="truncate">
                                        {part.codigo} - {part.nome}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Quantity */}
                    <div className="space-y-2">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="1"
                      />
                    </div>

                    {/* Stock Source */}
                    <div className="space-y-2">
                      <Label>Origem do Estoque</Label>
                      <ToggleGroup
                        type="single"
                        value={stockSource}
                        onValueChange={(value) => value && setStockSource(value as 'tecnico' | 'fazenda' | 'novo_pedido')}
                        className="justify-start"
                      >
                        <ToggleGroupItem
                          value="tecnico"
                          size="sm"
                          className="gap-1 data-[state=on]:bg-blue-500/10 data-[state=on]:text-blue-600"
                        >
                          <Truck className="h-3 w-3" />
                          Técnico
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="fazenda"
                          size="sm"
                          className="gap-1 data-[state=on]:bg-green-500/10 data-[state=on]:text-green-600"
                        >
                          <Warehouse className="h-3 w-3" />
                          Fazenda
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="novo_pedido"
                          size="sm"
                          className="gap-1 data-[state=on]:bg-violet-500/10 data-[state=on]:text-violet-600"
                        >
                          <ShoppingCart className="h-3 w-3" />
                          Novo Pedido
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    {/* Asset Unique Code - only when tecnico AND is_asset */}
                    {stockSource === 'tecnico' && selectedPart && (selectedPart as any).is_asset && (
                      <div className="space-y-2">
                        <Label>Cód. Unívoco do Ativo</Label>
                        <AssetCodeSelect
                          value={dialogAssetCode}
                          onChange={setDialogAssetCode}
                          partId={selectedPartId || undefined}
                        />
                      </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label>Observação</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Motivo da adição, número de série, etc."
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={resetAddDialog}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => addManualPartMutation.mutate()}
                      disabled={!selectedPartId || addManualPartMutation.isPending}
                    >
                      {addManualPartMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmPartId} onOpenChange={(open) => { if (!open) setDeleteConfirmPartId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const partToDelete = parts?.find(p => p.id === deleteConfirmPartId);
                return partToDelete
                  ? `Você realmente deseja excluir a peça ${partToDelete.part_code_snapshot} — ${partToDelete.part_name_snapshot}?`
                  : 'Você realmente deseja excluir esta peça?';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmPartId) {
                  deleteManualPartMutation.mutate(deleteConfirmPartId);
                  setDeleteConfirmPartId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Asset code select with dropdown filtered by part type
const NEW_CODE_SENTINEL = '__NEW_CODE__';

function AssetCodeSelect({ value, onChange, onBlurSave, partId }: { value: string; onChange: (v: string) => void; onBlurSave?: (v: string) => void; partId?: string }) {
  const [mode, setMode] = useState<'select' | 'manual'>(value ? 'manual' : 'select');
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: assets, isLoading } = useQuery({
    queryKey: ['workshop-items-by-part', partId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_items')
        .select('id, unique_code, status')
        .eq('omie_product_id', partId!)
        .order('unique_code');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partId,
  });

  // Filter assets based on search term
  const filteredAssets = assets?.filter(asset =>
    asset.unique_code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // If no partId or no assets loaded, fallback to manual input
  if (!partId) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlurSave?.(value)}
        placeholder="Digite o código unívoco..."
      />
    );
  }

  // Check if current value matches an existing asset
  const existingAsset = assets?.find(a => a.unique_code === value);

  if (mode === 'manual' || (value && !existingAsset && assets && assets.length > 0 && mode !== 'select')) {
    return (
      <div className="space-y-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onBlurSave?.(value)}
          placeholder="Digite o código unívoco..."
        />
        {assets && assets.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => {
              setMode('select');
              onChange('');
              onBlurSave?.('');
            }}
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Voltar para lista
          </Button>
        )}
        {value.trim() && !existingAsset && (
          <p className="text-xs text-muted-foreground">
            Código novo — será criado ao encerrar a visita
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Carregando ativos...
        </div>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              className="w-full justify-between"
            >
              {existingAsset ? (
                <span>
                  {existingAsset.unique_code} ({existingAsset.status || 'disponível'})
                </span>
              ) : (
                <span className="text-muted-foreground">Selecione um ativo...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Buscar ativo..."
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList className="max-h-64">
                <CommandEmpty>Nenhum ativo encontrado.</CommandEmpty>
                {filteredAssets.length > 0 ? (
                  <>
                    {filteredAssets.map((asset) => (
                      <CommandItem
                        key={asset.id}
                        value={asset.unique_code}
                        onSelect={(currentValue) => {
                          onChange(currentValue);
                          onBlurSave?.(currentValue);
                          setIsOpen(false);
                          setSearchTerm('');
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === asset.unique_code ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate">
                          {asset.unique_code} ({asset.status || 'disponível'})
                        </span>
                      </CommandItem>
                    ))}
                    <CommandItem
                      value={NEW_CODE_SENTINEL}
                      onSelect={() => {
                        setMode('manual');
                        onChange('');
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className="text-primary font-medium"
                    >
                      + Novo código...
                    </CommandItem>
                  </>
                ) : (
                  <CommandItem
                    value={NEW_CODE_SENTINEL}
                    onSelect={() => {
                      setMode('manual');
                      onChange('');
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className="text-primary font-medium"
                  >
                    + Novo código...
                  </CommandItem>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {existingAsset && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <Check className="h-3 w-3" />
          Ativo encontrado — {existingAsset.status || 'disponível'}
        </p>
      )}
    </div>
  );
}

// Part item component
interface PartItemProps {
  part: ConsumedPart & { is_asset?: boolean };
  isCompleted: boolean;
  onStockSourceChange: (partId: string, value: string) => void;
  onAssetCodeChange: (partId: string, code: string) => void;
  onNotesChange: (partId: string, notes: string) => void;
  onDelete: (partId: string) => void;
}

function PartItem({ part, isCompleted, onStockSourceChange, onAssetCodeChange, onNotesChange, onDelete }: PartItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localNotes, setLocalNotes] = useState(part.notes || '');
  const [localAssetCode, setLocalAssetCode] = useState(part.asset_unique_code || '');

  const handleSaveNotes = () => {
    onNotesChange(part.id, localNotes);
    setIsEditing(false);
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      {/* Part Info */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs shrink-0">
              {part.part_code_snapshot}
            </Badge>
            <Badge variant="secondary" className="shrink-0">
              Qtd: {part.quantity}
            </Badge>
            {part.is_manual && (
              <Badge variant="outline" className="text-xs shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                Manual
              </Badge>
            )}
          </div>
          <p className="text-sm mt-1.5 leading-tight">
            {part.part_name_snapshot}
          </p>
        </div>
        {/* Delete button for all parts */}
        {!isCompleted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive shrink-0"
            onClick={() => onDelete(part.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Stock Source Toggle */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <span className="text-xs text-muted-foreground shrink-0">Origem:</span>
        <ToggleGroup
          type="single"
          value={part.stock_source || ''}
          onValueChange={(value) => {
            onStockSourceChange(part.id, value);
            if (value !== 'tecnico') {
              setLocalAssetCode('');
            }
          }}
          disabled={isCompleted}
          className="gap-1"
        >
          <ToggleGroupItem
            value="tecnico"
            aria-label="Estoque do técnico"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs gap-1",
              !part.stock_source && "border-amber-400 animate-pulse",
              "data-[state=on]:bg-blue-500/10 data-[state=on]:text-blue-600 data-[state=on]:border-blue-500/30"
            )}
          >
            <Truck className="h-3 w-3" />
            Técnico
          </ToggleGroupItem>
          <ToggleGroupItem
            value="fazenda"
            aria-label="Estoque da fazenda"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs gap-1",
              !part.stock_source && "border-amber-400 animate-pulse",
              "data-[state=on]:bg-green-500/10 data-[state=on]:text-green-600 data-[state=on]:border-green-500/30"
            )}
          >
            <Warehouse className="h-3 w-3" />
            Fazenda
          </ToggleGroupItem>
          <ToggleGroupItem
            value="novo_pedido"
            aria-label="Novo pedido"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs gap-1",
              !part.stock_source && "border-amber-400 animate-pulse",
              "data-[state=on]:bg-violet-500/10 data-[state=on]:text-violet-600 data-[state=on]:border-violet-500/30"
            )}
          >
            <ShoppingCart className="h-3 w-3" />
            Pedido
          </ToggleGroupItem>
        </ToggleGroup>
        {!part.stock_source && !isCompleted && (
          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 bg-amber-500/10">
            Pendente
          </Badge>
        )}
      </div>

      {/* Asset Unique Code - only when tecnico AND is_asset */}
      {part.stock_source === 'tecnico' && part.is_asset && !isCompleted && (
        <div className="pt-1">
          <AssetCodeSelect
            value={localAssetCode}
            onChange={setLocalAssetCode}
            onBlurSave={(code) => onAssetCodeChange(part.id, code)}
            partId={part.part_id}
          />
        </div>
      )}
      {part.stock_source === 'tecnico' && part.is_asset && isCompleted && part.asset_unique_code && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 font-mono">
          Ativo: {part.asset_unique_code}
        </div>
      )}

      {/* Notes Section */}
      {!isCompleted && !isEditing && !part.notes && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={() => setIsEditing(true)}
        >
          <PenLine className="h-3 w-3 mr-1" />
          Adicionar observação
        </Button>
      )}

      {(part.notes || isEditing) && (
        <div className="pt-1">
          {isEditing && !isCompleted ? (
            <div className="space-y-2">
              <Textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="Observação..."
                rows={2}
                className="text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setLocalNotes(part.notes || '');
                    setIsEditing(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button size="sm" className="h-7" onClick={handleSaveNotes}>
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "text-xs text-muted-foreground bg-muted/50 rounded p-2",
                !isCompleted && "cursor-pointer hover:bg-muted/70"
              )}
              onClick={() => !isCompleted && setIsEditing(true)}
            >
              <span className="font-medium">Obs:</span> {part.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
