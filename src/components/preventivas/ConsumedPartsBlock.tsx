import { useState, useEffect, useRef } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import {
  refreshEstoqueCache, getSaldoTecnico, findItemByPeca, registrarMovimentoVisita, fetchMovimentosVisita,
  saidaAtivaDaPeca, itensPurosAtivos, notePeca, noteEstorno, NOTE_PURE, type VisitaMov,
} from '@/lib/estoque-consumo-visita';

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
  canForceDeleteLinked?: boolean;
}

export default function ConsumedPartsBlock({ preventiveId, isCompleted = false, canForceDeleteLinked = true }: ConsumedPartsBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const prevPartsCountRef = useRef(0);
  const [pollPausedUntil, setPollPausedUntil] = useState(0);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPartSelectorOpen, setIsPartSelectorOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [selectedUcItemId, setSelectedUcItemId] = useState<string | null>(null);
  const [deleteUcMovId, setDeleteUcMovId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [stockSource, setStockSource] = useState<'tecnico' | 'fazenda' | 'novo_pedido'>('tecnico');
  const [dialogAssetCode, setDialogAssetCode] = useState('');
  const [dialogSolenoideModelo, setDialogSolenoideModelo] = useState<'2x' | '3x' | ''>(() => {
    if (typeof window === 'undefined') return '';
    const v = sessionStorage.getItem(`solenoide_modelo_${preventiveId}`);
    return (v === '2x' || v === '3x') ? v : '';
  });
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

  // Online: fetch consumed parts from Supabase (simple server fetch, no merge-by-ID)
  const { data: onlineParts, isLoading: onlineLoading } = useQuery({
    queryKey: ['preventive-consumed-parts', preventiveId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_part_consumption')
        .select('id, part_id, part_code_snapshot, part_name_snapshot, quantity, unit_cost_snapshot, stock_source, asset_unique_code, notes, is_manual, consumed_at, exec_item_id, exec_nonconformity_id')
        .eq('preventive_id', preventiveId)
        .order('consumed_at', { ascending: true });

      if (error) throw error;
      const serverItems = (data || []) as (ConsumedPart & { exec_item_id?: string; exec_nonconformity_id?: string })[];

      // Fetch is_asset for each unique part_id
      const partIds = [...new Set(serverItems.map(i => i.part_id))];
      if (partIds.length > 0) {
        const { data: pecasData } = await supabase
          .from('pecas')
          .select('id, is_asset')
          .in('id', partIds);
        const assetMap = new Map((pecasData || []).map((p: any) => [p.id, p.is_asset ?? false]));
        return serverItems.map(i => ({ ...i, is_asset: assetMap.get(i.part_id) ?? false }));
      }

      return serverItems.map(i => ({ ...i, is_asset: false }));
    },
    enabled: !!preventiveId,
    staleTime: Date.now() < pollPausedUntil ? 15000 : 2000,
    refetchInterval: Date.now() < pollPausedUntil ? false : 5000,
    retry: 2,
  });

  // Listen for optimistic cache updates and pause polling to protect them
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event?.query?.queryKey?.[0] === 'preventive-consumed-parts' &&
        event?.query?.queryKey?.[1] === preventiveId &&
        event?.type === 'updated'
      ) {
        const data = event.query.state.data as any[];
        if (data?.some((p: any) => p._optimistic)) {
          setPollPausedUntil(Date.now() + 15000);
        }
      }
    });
    return () => unsubscribe();
  }, [queryClient, preventiveId]);

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

  // ============ Estoque Uso/Consumo (estoque pessoal do técnico) ============
  const { user } = useAuth();
  const { data: tecnicoId } = useQuery({
    queryKey: ['preventive-technician', preventiveId],
    queryFn: async () => {
      const cacheKey = `prev_tech_${preventiveId}`;
      try {
        const { data } = await supabase.from('preventive_maintenance').select('technician_user_id').eq('id', preventiveId).maybeSingle();
        const t = (data as any)?.technician_user_id as string | null;
        if (t) { try { localStorage.setItem(cacheKey, t); } catch (_) {} return t; }
      } catch (_) { /* offline */ }
      try { return localStorage.getItem(cacheKey) || user?.id || null; } catch (_) { return user?.id || null; }
    },
    enabled: !!preventiveId && !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: serverMovs } = useQuery({
    queryKey: ['visita-estoque-movs', preventiveId],
    queryFn: () => fetchMovimentosVisita(preventiveId),
    enabled: !!preventiveId && isOnline,
    refetchInterval: 15000,
    retry: 1,
  });
  const localMovs = useLiveQuery(
    () => preventiveId ? offlineChecklistDb.estoqueMovimentosLocais.where('origem_id').equals(preventiveId).toArray() : Promise.resolve([]),
    [preventiveId],
  );
  const ucItemsCache = useLiveQuery(() => offlineChecklistDb.estoqueConsumoItens.toArray(), []);
  const ucNome = new Map((ucItemsCache || []).map(i => [i.id, i]));
  const visitMovs: VisitaMov[] = (() => {
    const base = serverMovs || [];
    const ids = new Set(base.map(m => m.id));
    const pend = (localMovs || []).filter(m => !ids.has(m.id) && (m._pendingSync || !serverMovs))
      .map(m => ({ ...m, item_codigo: ucNome.get(m.item_id)?.codigo, item_descricao: ucNome.get(m.item_id)?.descricao }));
    return [...base, ...pend].sort((a, b) => a.created_at.localeCompare(b.created_at));
  })();
  const ucAtivos = itensPurosAtivos(visitMovs);
  const pendingMovIds = new Set((localMovs || []).filter(m => m._pendingSync).map(m => m.id));
  const ucPureItems = (ucItemsCache || []).filter(i => i.ativo && !i.peca_id).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const selectedUcItem = ucPureItems.find(i => i.id === selectedUcItemId) || null;

  useEffect(() => {
    if (isAddDialogOpen && isOnline && tecnicoId) refreshEstoqueCache(tecnicoId).catch(e => console.error('[estoque cache]', e));
  }, [isAddDialogOpen, isOnline, tecnicoId]);

  const invalidateMovs = () => queryClient.invalidateQueries({ queryKey: ['visita-estoque-movs', preventiveId] });

  /** Confere saldo do item rastreado; lança erro se insuficiente. */
  const assertSaldo = async (itemId: string, q: number) => {
    if (!tecnicoId) throw new Error('Técnico da visita não identificado.');
    if (isOnline) { try { await refreshEstoqueCache(tecnicoId); } catch (_) {} }
    const saldo = await getSaldoTecnico(tecnicoId, itemId);
    if (q > saldo) throw new Error(`Saldo insuficiente no seu estoque (disponível: ${saldo.toLocaleString('pt-BR')}).`);
  };

  const darSaidaPeca = async (consumptionId: string, pecaId: string, q: number) => {
    const item = await findItemByPeca(pecaId);
    if (!item || !tecnicoId) return;
    await registrarMovimentoVisita({
      item_id: item.id, tipo: 'saida', quantidade: q, tecnico_user_id: tecnicoId, origem_id: preventiveId,
      notes: notePeca(consumptionId), created_by_user_id: user?.id ?? null,
    }, isOnline);
    invalidateMovs();
  };

  const estornarPeca = async (consumptionId: string) => {
    const saida = saidaAtivaDaPeca(visitMovs, consumptionId);
    if (!saida) return;
    await registrarMovimentoVisita({
      item_id: saida.item_id, tipo: 'entrada', quantidade: saida.quantidade, tecnico_user_id: saida.tecnico_user_id,
      origem_id: preventiveId, notes: noteEstorno(notePeca(consumptionId)), created_by_user_id: user?.id ?? null,
    }, isOnline);
    invalidateMovs();
  };

  const addUcMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUcItem) throw new Error('Selecione um item');
      const q = parseFloat(quantity.replace(',', '.'));
      if (!Number.isFinite(q) || q <= 0) throw new Error('Informe uma quantidade maior que zero.');
      await assertSaldo(selectedUcItem.id, q);
      await registrarMovimentoVisita({
        item_id: selectedUcItem.id, tipo: 'saida', quantidade: q, tecnico_user_id: tecnicoId!, origem_id: preventiveId,
        notes: NOTE_PURE, created_by_user_id: user?.id ?? null,
      }, isOnline);
    },
    onSuccess: () => { invalidateMovs(); setIsExpanded(true); resetAddDialog(); toast({ title: 'Item registrado' }); },
    onError: (e: Error) => toast({ title: 'Erro ao registrar item', description: e.message, variant: 'destructive' }),
  });

  const deleteUcMutation = useMutation({
    mutationFn: async (movId: string) => {
      const m = visitMovs.find(x => x.id === movId);
      if (!m) return;
      await registrarMovimentoVisita({
        item_id: m.item_id, tipo: 'entrada', quantidade: m.quantidade, tecnico_user_id: m.tecnico_user_id,
        origem_id: preventiveId, notes: noteEstorno(m.id), created_by_user_id: user?.id ?? null,
      }, isOnline);
    },
    onSuccess: () => { invalidateMovs(); toast({ title: 'Item removido' }); },
    onError: (e: Error) => toast({ title: 'Erro ao remover item', description: e.message, variant: 'destructive' }),
  });

  // Auto-expand when parts appear for the first time
  useEffect(() => {
    const count = parts?.length || 0;
    if (prevPartsCountRef.current === 0 && count > 0) {
      setIsExpanded(true);
    }
    prevPartsCountRef.current = count;
  }, [parts?.length]);

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

  // ============ Auto-vínculo PRD00605 → PRD00639 (×3) ============
  const SOLENOIDE_TRIGGER_CODE = 'PRD00605';
  const SOLENOIDE_TARGET_CODE = 'PRD00639';
  const SOLENOIDE_TARGET_QTY = 3;
  const SOLENOIDE_LINK_MARKER = '[AUTO PRD00605→PRD00639 x3]';
  // Linha individual: cada PRD00605 gera uma linha PRD00639 separada (×3),
  // preservando rastreabilidade da origem (auto via não-conformidade vs. manual).
  const buildMarker = (triggerRowId: string) => `${SOLENOIDE_LINK_MARKER} src=${triggerRowId}`;
  const extractSrcId = (notes: string | null | undefined): string | null => {
    if (!notes || !notes.startsWith(SOLENOIDE_LINK_MARKER)) return null;
    const m = notes.match(/src=([0-9a-f-]{36})/i);
    return m ? m[1] : null;
  };

  const syncSolenoidLink = async () => {
    if (!isOnline) return;
    const { data: pecas } = await supabase
      .from('pecas')
      .select('id, codigo, nome')
      .in('codigo', [SOLENOIDE_TRIGGER_CODE, SOLENOIDE_TARGET_CODE]);
    const trigger = pecas?.find((p: any) => p.codigo === SOLENOIDE_TRIGGER_CODE);
    const target = pecas?.find((p: any) => p.codigo === SOLENOIDE_TARGET_CODE);
    if (!trigger || !target) return;

    const { data: triggerRows } = await supabase
      .from('preventive_part_consumption')
      .select('id, quantity, exec_nonconformity_id, is_manual, notes')
      .eq('preventive_id', preventiveId)
      .eq('part_id', trigger.id);

    const { data: existingTargets } = await supabase
      .from('preventive_part_consumption')
      .select('id, quantity, notes')
      .eq('preventive_id', preventiveId)
      .eq('part_id', target.id)
      .like('notes', `${SOLENOIDE_LINK_MARKER}%`);

    const triggers = triggerRows || [];
    const targets = existingTargets || [];

    // Index targets by source trigger id
    const targetBySrc = new Map<string, { id: string; quantity: number }>();
    const orphans: string[] = [];
    for (const t of targets) {
      const src = extractSrcId(t.notes as string | null);
      if (!src || !triggers.some((tr: any) => tr.id === src)) {
        orphans.push(t.id as string);
      } else {
        targetBySrc.set(src, { id: t.id as string, quantity: Number(t.quantity || 0) });
      }
    }

    // Delete orphans (their source PRD00605 was removed)
    if (orphans.length > 0) {
      await supabase.from('preventive_part_consumption').delete().in('id', orphans);
    }

    // Ensure each trigger row has its own target row with qty = trigger.qty * 3
    for (const tr of triggers) {
      if ((tr as any).notes === '[solenoide-link-disabled]') continue;
      const desiredQty = Number(tr.quantity || 0) * SOLENOIDE_TARGET_QTY;
      if (desiredQty <= 0) continue;
      const existing = targetBySrc.get(tr.id as string);
      if (!existing) {
        await (supabase as any).from('preventive_part_consumption').insert({
          id: crypto.randomUUID(),
          preventive_id: preventiveId,
          part_id: target.id,
          part_code_snapshot: target.codigo,
          part_name_snapshot: target.nome,
          quantity: desiredQty,
          stock_source: 'novo_pedido',
          is_manual: true,
          notes: buildMarker(tr.id as string),
        });
      } else if (existing.quantity !== desiredQty) {
        await supabase
          .from('preventive_part_consumption')
          .update({ quantity: desiredQty })
          .eq('id', existing.id);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
  };

  // Identify all auto-linked PRD00639 rows in the current list (so UI can lock each one)
  const linkedTargetRowIds = (() => {
    const set = new Set<string>();
    for (const p of parts || []) {
      if (
        (p as any).part_code_snapshot === SOLENOIDE_TARGET_CODE &&
        typeof (p as any).notes === 'string' &&
        ((p as any).notes as string).startsWith(SOLENOIDE_LINK_MARKER)
      ) {
        set.add((p as any).id);
      }
    }
    return set;
  })();

  // Reconcile auto-link whenever parts change (covers PRD00605 inserted via checklist non-conformity flow).
  // Only triggers sync when current target rows don't match the expected per-trigger 1:1 mapping.
  const reconcileRef = useRef(false);
  useEffect(() => {
    if (!parts || !isOnline || reconcileRef.current) return;
    const triggerRows = parts.filter((p: any) => p.part_code_snapshot === SOLENOIDE_TRIGGER_CODE);
    const targetRows = parts.filter(
      (p: any) =>
        p.part_code_snapshot === SOLENOIDE_TARGET_CODE &&
        typeof p.notes === 'string' &&
        (p.notes as string).startsWith(SOLENOIDE_LINK_MARKER),
    );
    const triggerIds = new Set(triggerRows.map((t: any) => t.id));
    const expected = triggerRows.map((t: any) => ({ src: t.id as string, qty: Number(t.quantity || 0) * SOLENOIDE_TARGET_QTY }));
    let needsSync = false;
    for (const tg of targetRows) {
      const src = extractSrcId((tg as any).notes);
      if (!src || !triggerIds.has(src)) { needsSync = true; break; }
    }
    if (!needsSync) {
      for (const e of expected) {
        const match = targetRows.find((tg: any) => extractSrcId((tg as any).notes) === e.src);
        if (!match || Number((match as any).quantity) !== e.qty) { needsSync = true; break; }
      }
    }
    if (needsSync) {
      reconcileRef.current = true;
      syncSolenoidLink()
        .catch((err) => console.error('[solenoid reconcile]', err))
        .finally(() => { reconcileRef.current = false; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, isOnline]);

  // Update stock source mutation
  const updateStockSourceMutation = useMutation({
    mutationFn: async ({ partId, stockSource }: { partId: string; stockSource: string }) => {
      const current = parts?.find(p => p.id === partId);
      if (current && current.stock_source !== 'tecnico' && stockSource === 'tecnico') {
        const item = await findItemByPeca(current.part_id);
        if (item) await assertSaldo(item.id, Number(current.quantity) || 0);
      }
      const updateData: Record<string, unknown> = { stock_source: stockSource };
      if (stockSource !== 'tecnico') {
        updateData.asset_unique_code = null;
      }

      if (!isOnline) {
        await offlineChecklistDb.partConsumptions.update(partId, { stock_source: stockSource, _pendingSync: true });
        await offlineChecklistDb.addToSyncQueue('preventive_part_consumption', 'update', { id: partId, ...updateData });
      } else {
        const { error } = await supabase
          .from('preventive_part_consumption')
          .update(updateData)
          .eq('id', partId);
        if (error) throw error;
      }
      // Estoque Uso/Consumo: acompanha a troca de origem
      if (current) {
        try {
          if (current.stock_source === 'tecnico' && stockSource !== 'tecnico') await estornarPeca(partId);
          if (current.stock_source !== 'tecnico' && stockSource === 'tecnico') await darSaidaPeca(partId, current.part_id, Number(current.quantity) || 0);
        } catch (e: any) {
          toast({ title: 'Origem alterada, mas o estoque do técnico não foi atualizado', description: e.message, variant: 'destructive' });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
    },
    onError: (error: Error) => {
      if (!isOnline && !error.message.startsWith('Saldo insuficiente')) return;
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
      const qtdNum = parseFloat(quantity) || 1;
      if (qtdNum <= 0) throw new Error('Informe uma quantidade maior que zero.');
      const trackedItem = stockSource === 'tecnico' ? await findItemByPeca(selectedPartId) : null;
      if (trackedItem) await assertSaldo(trackedItem.id, qtdNum);

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

      if (trackedItem) {
        try { await darSaidaPeca(newId, selectedPartId, qtdNum); }
        catch (e: any) { toast({ title: 'Peça registrada, mas o estoque do técnico não foi descontado', description: e.message, variant: 'destructive' }); }
      }

      return { newId };
    },
    onSuccess: (result) => {
      // Optimistic: add to cache immediately using the SAME ID from mutationFn
      if (selectedPartId && selectedPart) {
        const assetCode = stockSource === 'tecnico' && dialogAssetCode.trim() ? dialogAssetCode.trim() : null;
        queryClient.cancelQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
        queryClient.setQueryData(['preventive-consumed-parts', preventiveId], (old: any[]) => {
          const newPart = {
            id: result?.newId || crypto.randomUUID(),
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
            _optimistic: true,
          };
          return [...(old || []), newPart];
        });
      }
      // Persist Solenoide model selection (used by checkout to skip prompt)
      if (selectedPart?.codigo === 'PRD00605' && (dialogSolenoideModelo === '2x' || dialogSolenoideModelo === '3x')) {
        try { sessionStorage.setItem(`solenoide_modelo_${preventiveId}`, dialogSolenoideModelo); } catch (_) {}
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
      // If deleting an auto-linked PRD00639, persist user intent on the source PRD00605
      const target = parts?.find((p: any) => p.id === partId) as any;
      if (
        target &&
        target.part_code_snapshot === SOLENOIDE_TARGET_CODE &&
        typeof target.notes === 'string' &&
        (target.notes as string).startsWith(SOLENOIDE_LINK_MARKER)
      ) {
        const srcId = extractSrcId(target.notes);
        if (srcId && isOnline) {
          await supabase
            .from('preventive_part_consumption')
            .update({ notes: '[solenoide-link-disabled]' })
            .eq('id', srcId);
        }
      }

      // Estoque Uso/Consumo: devolve ao estoque do técnico se houve saída
      if (target?.stock_source === 'tecnico') {
        try { await estornarPeca(partId); }
        catch (e: any) { throw new Error(`Não foi possível devolver ao estoque do técnico: ${e.message}`); }
      }

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
      const deleted = parts?.find((p: any) => p.id === partId);
      // Cancel in-flight queries and remove from cache immediately
      queryClient.cancelQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
      queryClient.setQueryData(['preventive-consumed-parts', preventiveId], (old: any[]) => {
        if (!old) return old;
        return old.filter((p: any) => p.id !== partId);
      });
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId], refetchType: 'none' });
      // Auto-vínculo: ressincroniza PRD00639 quando PRD00605 é removido
      if (deleted?.part_code_snapshot === SOLENOIDE_TRIGGER_CODE) {
        syncSolenoidLink().catch((e) => console.error('[solenoid sync] delete', e));
      }
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
    setSelectedUcItemId(null);
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
  const totalParts = (parts?.length || 0) + ucAtivos.length;
  const totalQuantity = (parts?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0) + ucAtivos.reduce((s, m) => s + m.quantidade, 0);
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
                      isLinked={linkedTargetRowIds.has(part.id)}
                      linkedLabel={`Vinculado ao ${SOLENOIDE_TRIGGER_CODE} (×${SOLENOIDE_TARGET_QTY})`}
                      canForceDeleteLinked={canForceDeleteLinked}
                      onStockSourceChange={handleStockSourceChange}
                      onAssetCodeChange={handleAssetCodeChange}
                      onNotesChange={(partId, notes) => updateNotesMutation.mutate({ partId, notes })}
                      onDelete={(partId) => setDeleteConfirmPartId(partId)}
                    />
                  ))}
                  {ucAtivos.map((m) => (
                    <div key={m.id} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{m.item_codigo ?? '—'}</span>
                            <Badge variant="outline" className="text-xs">Uso/Consumo</Badge>
                            {pendingMovIds.has(m.id) && <Badge variant="secondary" className="text-xs">Aguardando envio</Badge>}
                          </div>
                          <p className="text-sm font-medium break-words">{m.item_descricao ?? 'Item Uso/Consumo'}</p>
                          <p className="text-xs text-muted-foreground">Qtd: {m.quantidade.toLocaleString('pt-BR')} · Estoque do técnico</p>
                        </div>
                        {!isCompleted && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" aria-label="Remover item"
                            disabled={deleteUcMutation.isPending} onClick={() => setDeleteUcMovId(m.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
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
                            {selectedUcItem ? (
                              <span className="break-words">
                                {selectedUcItem.codigo} - {selectedUcItem.descricao}
                              </span>
                            ) : selectedPart ? (
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
                                        setSelectedUcItemId(null);
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
                                      <span className="truncate flex-1">
                                        {part.codigo} - {part.nome}
                                      </span>
                                      {stockSource === 'tecnico' && <Badge variant="secondary" className="text-[10px] shrink-0">Catálogo</Badge>}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ))}
                              {stockSource === 'tecnico' && ucPureItems.length > 0 && (
                                <CommandGroup heading="Estoque Uso/Consumo">
                                  {ucPureItems.map(item => (
                                    <CommandItem
                                      key={item.id}
                                      value={`uc ${item.codigo} ${item.descricao}`}
                                      onSelect={() => {
                                        setSelectedUcItemId(item.id);
                                        setSelectedPartId(null);
                                        setIsPartSelectorOpen(false);
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <Check className={cn("h-4 w-4", selectedUcItemId === item.id ? "opacity-100" : "opacity-0")} />
                                      <span className="truncate flex-1">{item.codigo} - {item.descricao}</span>
                                      <Badge variant="outline" className="text-[10px] shrink-0">Uso/Consumo</Badge>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
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
                        onValueChange={(value) => {
                          if (!value) return;
                          setStockSource(value as 'tecnico' | 'fazenda' | 'novo_pedido');
                          if (value !== 'tecnico') setSelectedUcItemId(null);
                        }}
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

                    {/* Modelo do Solenóide - apenas para PRD00605 */}
                    {selectedPart?.codigo === 'PRD00605' && (
                      <div className="space-y-2">
                        <Label>
                          Modelo do Solenóide <span className="text-destructive">*</span>
                        </Label>
                        <ToggleGroup
                          type="single"
                          value={dialogSolenoideModelo}
                          onValueChange={(v) => v && setDialogSolenoideModelo(v as '2x' | '3x')}
                          className="justify-start"
                        >
                          <ToggleGroupItem value="2x" className="font-mono">2x</ToggleGroupItem>
                          <ToggleGroupItem value="3x" className="font-mono">3x</ToggleGroupItem>
                        </ToggleGroup>
                        <p className="text-xs text-muted-foreground">
                          Necessário para gerar o pedido de reposição.
                        </p>
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
                      onClick={() => (selectedUcItem ? addUcMutation.mutate() : addManualPartMutation.mutate())}
                      disabled={
                        (!selectedPartId && !selectedUcItem) ||
                        addManualPartMutation.isPending ||
                        addUcMutation.isPending ||
                        (selectedPart?.codigo === 'PRD00605' && !dialogSolenoideModelo)
                      }
                    >
                      {(addManualPartMutation.isPending || addUcMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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

      <AlertDialog open={!!deleteUcMovId} onOpenChange={(open) => { if (!open) setDeleteUcMovId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item Uso/Consumo?</AlertDialogTitle>
            <AlertDialogDescription>A quantidade volta para o estoque do técnico.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteUcMovId) deleteUcMutation.mutate(deleteUcMovId); setDeleteUcMovId(null); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  isLinked?: boolean;
  linkedLabel?: string;
  canForceDeleteLinked?: boolean;
  onStockSourceChange: (partId: string, value: string) => void;
  onAssetCodeChange: (partId: string, code: string) => void;
  onNotesChange: (partId: string, notes: string) => void;
  onDelete: (partId: string) => void;
}

function PartItem({ part, isCompleted, isLinked, linkedLabel, canForceDeleteLinked, onStockSourceChange, onAssetCodeChange, onNotesChange, onDelete }: PartItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localNotes, setLocalNotes] = useState(part.notes || '');
  const [localAssetCode, setLocalAssetCode] = useState(part.asset_unique_code || '');

  const handleSaveNotes = () => {
    onNotesChange(part.id, localNotes);
    setIsEditing(false);
  };

  return (
    <div className={cn("border rounded-lg p-3 space-y-2", isLinked && "border-primary/40 bg-primary/5")}>
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
            {part.is_manual && !isLinked && (
              <Badge variant="outline" className="text-xs shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                Manual
              </Badge>
            )}
            {isLinked && (
              <Badge variant="outline" className="text-[10px] shrink-0 bg-primary/10 text-primary border-primary/30">
                {linkedLabel || 'Vinculado'}
              </Badge>
            )}
          </div>
          <p className="text-sm mt-1.5 leading-tight">
            {part.part_name_snapshot}
          </p>
        </div>
        {/* Delete button for all parts (including linked repair cards) */}
        {!isCompleted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive shrink-0"
            onClick={() => onDelete(part.id)}
            disabled={false}
            title={isLinked ? 'Excluir este card de reparo (o PRD00605 permanece)' : undefined}
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
