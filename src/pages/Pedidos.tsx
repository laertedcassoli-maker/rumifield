import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflinePedidos } from '@/hooks/useOfflinePedidos';
import { useOffline } from '@/contexts/OfflineContext';
import { offlineDb } from '@/lib/offline-db';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, Loader2, Trash2, Minus, ArrowUpDown, Search, X, Eye, Pencil, CloudOff, ShoppingCart, Package, ImageIcon, Send, FileText, ChevronLeft, ChevronRight, Truck, HandHelping, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import PedidoKanban from '@/components/pedidos/PedidoKanban';
import AssetSearchField from '@/components/pedidos/AssetSearchField';
import EditarPedidoSolicitado from '@/components/pedidos/EditarPedidoSolicitado';

const statusColors: Record<string, string> = {
  rascunho: 'bg-muted text-muted-foreground border-muted-foreground/30',
  solicitado: 'bg-info/10 text-info border-info/20',
  processamento: 'bg-warning/10 text-warning border-warning/20',
  faturado: 'bg-primary/10 text-primary border-primary/20',
  enviado: 'bg-success/10 text-success border-success/20',
  entregue: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  solicitado: 'Solicitado',
  processamento: 'Em Processamento',
  faturado: 'Faturado',
  enviado: 'Enviado',
  entregue: 'Entregue',
};

export default function Pedidos() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { isOnline, triggerSync, lastSyncTime, syncStatus } = useOffline();
  const [open, setOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<any>(null);
  const [viewingPedido, setViewingPedido] = useState<any>(null);
  const [form, setForm] = useState({ cliente_id: '', observacoes: '', urgencia: 'normal', tipo_envio: '' });
  const [itens, setItens] = useState<{ peca_id: string; quantidade: number }[]>([]);
  const [viewAll, setViewAll] = useState(false);
  const [solicitanteFilter, setSolicitanteFilter] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; nome: string } | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [editingAssetItemId, setEditingAssetItemId] = useState<string | null>(null);
  const [isEditingSolicitado, setIsEditingSolicitado] = useState(false);
  const [consultorNames, setConsultorNames] = useState<Record<string, string>>({});
  
  const isAdmin = role === 'admin' || role === 'coordenador_rplus' || role === 'coordenador_servicos' || role === 'coordenador_logistica';
  const canManagePedidos = role === 'admin' || role === 'coordenador_logistica';

  // Use offline data
  const clientes = useLiveQuery(() => offlineDb.clientes.toArray(), []);
  const pecas = useLiveQuery(() => offlineDb.pecas.filter(p => p.ativo !== false).toArray(), []);
  const { pedidos, isLoading, createPedido, updatePedido, transmitirPedido, transmitirTodos, deletePedido } = useOfflinePedidos(user?.id, viewAll, isAdmin);

  // Auto-set viewAll for coordinators/admins
  useEffect(() => {
    if (isAdmin) setViewAll(true);
  }, [isAdmin]);

  // Auto-sync when page loads and online
  useEffect(() => {
    if (isOnline) {
      triggerSync();
    }
  }, []);

  // Tab state for drafts vs submitted
  const [activeTab, setActiveTab] = useState<'rascunhos' | 'pedidos'>('pedidos');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({});
  const [clienteSearch, setClienteSearch] = useState('');
  const [pecaSearches, setPecaSearches] = useState<Record<number, string>>({});
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'30' | 'all'>('all');
  const [tipoEnvioFilter, setTipoEnvioFilter] = useState<'all' | 'envio' | 'apenas_nf'>('all');
  const [tipoLogisticaFilter, setTipoLogisticaFilter] = useState<'all' | 'correios' | 'entrega_propria'>('all');
  const [sortField, setSortField] = useState<'created_at' | 'cliente' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Unique solicitantes for filter dropdown
  const solicitantesUnicos = useMemo(() => {
    if (!pedidos) return [];
    const map = new Map<string, string>();
    for (const p of pedidos) {
      if (p.solicitante_id && !map.has(p.solicitante_id)) {
        map.set(p.solicitante_id, (p as any).solicitante?.nome || p.solicitante_id);
      }
    }
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [pedidos]);

  // Separate drafts from transmitted orders
  const rascunhos = useMemo(() => {
    if (!pedidos) return [];
    return pedidos.filter(p => p.status === 'rascunho');
  }, [pedidos]);

  const pedidosTransmitidos = useMemo(() => {
    if (!pedidos) return [];
    return pedidos.filter(p => p.status !== 'rascunho');
  }, [pedidos]);

  const filteredAndSortedPedidos = useMemo(() => {
    // Use different source based on active tab
    const source = activeTab === 'rascunhos' ? rascunhos : pedidosTransmitidos;
    if (!source.length) return [];
    
    let filtered = source.filter(pedido => {
        const searchLower = searchTerm.toLowerCase().trim();
        const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);
        
        const matchesSearch = searchTerm === '' || (() => {
          // Check pedido_code
          if (pedido.pedido_code?.toLowerCase().includes(searchLower)) return true;
          
          // Check if client/farm matches all words
          const clienteNome = pedido.clientes?.nome?.toLowerCase() || '';
          const clienteFazenda = pedido.clientes?.fazenda?.toLowerCase() || '';
          const clienteMatch = searchWords.every(word => 
            clienteNome.includes(word) || clienteFazenda.includes(word)
          );
          if (clienteMatch) return true;
          
          // Check if any part matches all words
          return pedido.pedido_itens?.some((item: any) => {
            const pecaCodigo = item.pecas?.codigo?.toLowerCase() || '';
            const pecaNome = item.pecas?.nome?.toLowerCase() || '';
            return searchWords.every(word => 
              pecaCodigo.includes(word) || pecaNome.includes(word)
            );
          });
        })();
      
      // Status filter only applies to transmitted orders tab
      const matchesStatus = activeTab === 'rascunhos' || statusFilter === 'all' || pedido.status === statusFilter;
      
      // Date filter
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const daysAgo = parseInt(dateFilter);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
        matchesDate = new Date(pedido.created_at) >= cutoffDate;
      }
      
      // Tipo envio filter
      let matchesTipoEnvio = true;
      if (tipoEnvioFilter === 'envio') {
        matchesTipoEnvio = pedido.tipo_envio === 'envio_fisico';
      } else if (tipoEnvioFilter === 'apenas_nf') {
        matchesTipoEnvio = pedido.tipo_envio === 'apenas_nf';
      }

      // Tipo logistica filter
      let matchesTipoLogistica = true;
      if (tipoLogisticaFilter === 'correios') {
        matchesTipoLogistica = pedido.tipo_logistica === 'correios';
      } else if (tipoLogisticaFilter === 'entrega_propria') {
        matchesTipoLogistica = pedido.tipo_logistica === 'entrega_propria';
      }

      // Solicitante filter
      const matchesSolicitante = solicitanteFilter === 'all' || pedido.solicitante_id === solicitanteFilter;

      return matchesSearch && matchesStatus && matchesDate && matchesTipoEnvio && matchesTipoLogistica && matchesSolicitante;
    });
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === 'cliente') {
        comparison = (a.clientes?.nome || '').localeCompare(b.clientes?.nome || '');
      } else if (sortField === 'status') {
        const statusOrder = ['rascunho', 'solicitado', 'processamento', 'faturado', 'enviado', 'entregue'];
        comparison = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [pedidos, rascunhos, pedidosTransmitidos, activeTab, searchTerm, statusFilter, dateFilter, tipoEnvioFilter, tipoLogisticaFilter, solicitanteFilter, sortField, sortOrder]);

  // Paginated data (only for Transmitidos tab)
  const paginatedPedidos = useMemo(() => {
    if (activeTab === 'rascunhos') return filteredAndSortedPedidos;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedPedidos.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedPedidos, currentPage, activeTab, ITEMS_PER_PAGE]);

  const totalPages = useMemo(() => {
    if (activeTab === 'rascunhos') return 1;
    return Math.ceil(filteredAndSortedPedidos.length / ITEMS_PER_PAGE);
  }, [filteredAndSortedPedidos.length, activeTab, ITEMS_PER_PAGE]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, tipoEnvioFilter, tipoLogisticaFilter, solicitanteFilter, activeTab]);

  const toggleSort = (field: 'created_at' | 'cliente' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
    setTipoEnvioFilter('all');
    setTipoLogisticaFilter('all');
    setSolicitanteFilter('all');
  };

  const handleTransmitir = async (pedidoId: string) => {
    setIsTransmitting(true);
    try {
      await transmitirPedido(pedidoId);
      toast({ title: 'Pedido transmitido!', description: 'O pedido foi enviado para processamento.' });
      if (isOnline) {
        setTimeout(() => triggerSync(), 500);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao transmitir', description: error.message });
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleTransmitirTodos = async () => {
    if (rascunhos.length === 0) return;
    setIsTransmitting(true);
    try {
      await transmitirTodos(rascunhos.map(r => r.id));
      toast({ 
        title: 'Todos os rascunhos transmitidos!', 
        description: `${rascunhos.length} pedido(s) enviado(s) para processamento.` 
      });
      setActiveTab('pedidos');
      if (isOnline) {
        setTimeout(() => triggerSync(), 500);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao transmitir', description: error.message });
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleDeletePedido = async () => {
    if (!editingPedido) return;
    setIsDeleting(true);
    try {
      await deletePedido(editingPedido.id);
      toast({ title: 'Rascunho excluído!' });
      setOpen(false);
      setEditingPedido(null);
      setForm({ cliente_id: '', observacoes: '', urgencia: 'normal', tipo_envio: '' });
      setItens([]);
      if (isOnline) {
        setTimeout(() => triggerSync(), 500);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const addItem = () => {
    setItens([...itens, { peca_id: '', quantidade: 1 }]);
  };

  const updateItem = (index: number, field: 'peca_id' | 'quantidade', value: string | number) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], [field]: value };
    setItens(newItens);
  };

  const incrementQuantity = (index: number) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], quantidade: newItens[index].quantidade + 1 };
    setItens(newItens);
  };

  const decrementQuantity = (index: number) => {
    const newItens = [...itens];
    if (newItens[index].quantidade > 1) {
      newItens[index] = { ...newItens[index], quantidade: newItens[index].quantidade - 1 };
      setItens(newItens);
    }
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const getPecaLabel = (pecaId: string) => {
    const peca = pecas?.find(p => p.id === pecaId);
    return peca ? `${peca.codigo} - ${peca.nome}` : 'Selecione a peça';
  };

  const handleEditPedido = (pedido: any) => {
    setEditingPedido(pedido);
    setForm({
      cliente_id: pedido.cliente_id,
      observacoes: pedido.observacoes || '',
      urgencia: pedido.urgencia || 'normal',
      tipo_envio: pedido.tipo_envio || '',
    });
    setItens(
      pedido.pedido_itens?.map((item: any) => ({
        peca_id: item.peca_id,
        quantidade: item.quantidade,
      })) || []
    );
    setOpen(true);
  };

  const handleCloseDialog = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingPedido(null);
      setForm({ cliente_id: '', observacoes: '', urgencia: 'normal', tipo_envio: '' });
      setItens([]);
      setShowConfirmation(false);
      setClienteSearch('');
      setPecaSearches({});
    }
  };

  const handleShowConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id) {
      toast({ variant: 'destructive', title: 'Selecione um cliente' });
      return;
    }
    if (itens.length === 0 || itens.some((i) => !i.peca_id)) {
      toast({ variant: 'destructive', title: 'Adicione pelo menos uma peça válida' });
      return;
    }
    setShowConfirmation(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (editingPedido) {
        await updatePedido(editingPedido.id, {
          cliente_id: form.cliente_id,
          observacoes: form.observacoes,
          itens,
        });
        toast({ title: 'Pedido atualizado!' });
      } else {
        await createPedido({
          solicitante_id: user!.id,
          cliente_id: form.cliente_id,
          observacoes: form.observacoes,
          origem: 'chamado',
          tipo_envio: form.tipo_envio || undefined,
          urgencia: form.urgencia,
          itens,
        });
        toast({ title: 'Rascunho salvo!', description: 'Clique em "Transmitir" para enviar o pedido.' });
        setActiveTab('rascunhos'); // Switch to drafts tab
      }
      setOpen(false);
      setEditingPedido(null);
      setForm({ cliente_id: '', observacoes: '', urgencia: 'normal', tipo_envio: '' });
      setItens([]);
      setShowConfirmation(false);
      setClienteSearch('');
      setPecaSearches({});
      
      // Force sync when online
      if (isOnline) {
        setTimeout(() => {
          triggerSync();
        }, 500);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar pedido', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Processar pedido (solicitado -> processamento, optionally set tipo_logistica)
  const handleProcessar = useCallback(async (pedidoId: string, tipoLogistica?: string, itemsWithAssets?: Record<string, string>) => {
    setIsProcessingAction(true);
    try {
      const updateData: any = { status: 'processamento' };
      if (tipoLogistica) updateData.tipo_logistica = tipoLogistica;
      
      const { error } = await supabase
        .from('pedidos')
        .update(updateData)
        .eq('id', pedidoId);
      if (error) throw error;

      // Save asset associations
      if (itemsWithAssets) {
        for (const [itemId, workshopItemId] of Object.entries(itemsWithAssets)) {
          if (workshopItemId) {
            await supabase.from('pedido_itens').update({ workshop_item_id: workshopItemId }).eq('id', itemId);
          }
        }
      }

      // Update local
      const localUpdate: any = { status: 'processamento' };
      if (tipoLogistica) localUpdate.tipo_logistica = tipoLogistica;
      await offlineDb.pedidos.update(pedidoId, localUpdate);
      toast({ title: 'Pedido movido para processamento!' });
      if (isOnline) setTimeout(() => triggerSync(), 500);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setIsProcessingAction(false);
    }
  }, [isOnline, toast, triggerSync]);

  // Concluir pedido (processamento -> faturado + NF + tipo_logistica)
  const handleConcluir = useCallback(async (pedidoId: string, nfNumero: string, dataFaturamento: string, tipoLogistica: string, itemsWithAssets?: Record<string, string>) => {
    setIsProcessingAction(true);
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ 
          status: 'faturado', 
          omie_nf_numero: nfNumero,
          omie_data_faturamento: dataFaturamento,
          tipo_logistica: tipoLogistica,
        } as any)
        .eq('id', pedidoId);
      if (error) throw error;

      // Save asset associations
      if (itemsWithAssets) {
        for (const [itemId, workshopItemId] of Object.entries(itemsWithAssets)) {
          if (workshopItemId) {
            await supabase.from('pedido_itens').update({ workshop_item_id: workshopItemId }).eq('id', itemId);
          }
        }
      }

      await offlineDb.pedidos.update(pedidoId, { 
        status: 'faturado', 
        omie_nf_numero: nfNumero,
        omie_data_faturamento: dataFaturamento,
        tipo_logistica: tipoLogistica,
      });
      toast({ title: 'Pedido concluído!', description: `NF ${nfNumero} registrada.` });
      if (isOnline) setTimeout(() => triggerSync(), 500);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setIsProcessingAction(false);
    }
  }, [isOnline, toast, triggerSync]);

  // Vincular ativo diretamente no detalhe do pedido
  const handleAssetLinked = useCallback(async (itemId: string, workshopItemId: string | null) => {
    try {
      const { error } = await supabase
        .from('pedido_itens')
        .update({ workshop_item_id: workshopItemId })
        .eq('id', itemId);
      if (error) throw error;

      // Fetch the linked asset's unique_code for UI update
      let workshopItemData: { id: string; unique_code: string } | null = null;
      if (workshopItemId) {
        const { data } = await supabase
          .from('workshop_items')
          .select('id, unique_code')
          .eq('id', workshopItemId)
          .single();
        workshopItemData = data;
      }

      // Update local Dexie
      const localPedido = await offlineDb.pedidos.get(viewingPedido.id);
      if (localPedido && localPedido.pedido_itens) {
        const updatedItens = localPedido.pedido_itens.map((it: any) =>
          it.id === itemId ? { ...it, workshop_item_id: workshopItemId } : it
        );
        await offlineDb.pedidos.update(viewingPedido.id, { pedido_itens: updatedItens });
      }

      // Update viewingPedido state with complete workshop_item object
      setViewingPedido((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          pedido_itens: prev.pedido_itens?.map((it: any) =>
            it.id === itemId
              ? { ...it, workshop_item_id: workshopItemId, workshop_item: workshopItemData }
              : it
          ),
        };
      });

      setEditingAssetItemId(null);
      toast({ title: 'Ativo vinculado com sucesso!' });
      if (isOnline) setTimeout(() => triggerSync(), 500);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao vincular ativo', description: err.message });
    }
  }, [viewingPedido, isOnline, toast, triggerSync]);

  return (
    <div className="space-y-6 animate-fade-in w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Pedidos de Peças</h1>
            {!isOnline && (
              <Badge variant="outline" className="text-orange-500 border-orange-300">
                <CloudOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {syncStatus === 'syncing' ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Sincronizando...
              </span>
            ) : lastSyncTime ? (
              `Última sync: ${format(lastSyncTime, "dd/MM 'às' HH:mm", { locale: ptBR })}`
            ) : (
              'Nunca sincronizado'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={open} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
            <Button className="bg-success hover:bg-success/90 text-success-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Novo pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {showConfirmation && !editingPedido ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Confirmar Rascunho
                    {!isOnline && (
                      <Badge variant="outline" className="text-orange-500 border-orange-300 text-xs">
                        <CloudOff className="h-3 w-3 mr-1" />
                        Offline
                      </Badge>
                    )}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Cliente destaque */}
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                    <p className="font-semibold text-lg">
                      {clientes?.find(c => c.id === form.cliente_id)?.nome}
                    </p>
                    {clientes?.find(c => c.id === form.cliente_id)?.fazenda && (
                      <p className="text-muted-foreground">
                        {clientes?.find(c => c.id === form.cliente_id)?.fazenda}
                      </p>
                    )}
                  </div>

                  {/* Itens do pedido */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Itens do Pedido ({itens.length})</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {itens.map((item, index) => {
                        const peca = pecas?.find(p => p.id === item.peca_id);
                        return (
                          <div key={index} className="p-2 rounded border bg-muted/30 flex gap-3">
                            {peca?.imagem_url ? (
                              <button
                                type="button"
                                onClick={() => setImagePreview({ url: peca.imagem_url!, nome: peca.nome })}
                                className="shrink-0 hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={peca.imagem_url}
                                  alt={peca.nome}
                                  className="h-12 w-12 object-cover rounded"
                                />
                              </button>
                            ) : (
                              <div className="h-12 w-12 flex items-center justify-center bg-muted rounded shrink-0">
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{peca?.codigo}</span>
                                <Badge variant="secondary" className="shrink-0">
                                  x{item.quantidade}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground break-words">
                                {peca?.descricao || peca?.nome}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Observações */}
                  {form.observacoes && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Observações</p>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                        {form.observacoes}
                      </p>
                    </div>
                  )}

                  {/* Botões */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowConfirmation(false)}
                    >
                      Voltar
                    </Button>
                    <Button 
                      type="button" 
                      className="flex-1"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {!isOnline && <CloudOff className="mr-2 h-4 w-4" />}
                          <FileText className="mr-2 h-4 w-4" />
                          Salvar Rascunho
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {editingPedido ? 'Editar Pedido' : 'Novo Pedido de Peças'}
                    {!isOnline && (
                      <Badge variant="outline" className="text-orange-500 border-orange-300 text-xs">
                        <CloudOff className="h-3 w-3 mr-1" />
                        Offline
                      </Badge>
                    )}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={editingPedido ? (e) => { e.preventDefault(); handleSubmit(); } : handleShowConfirmation} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cliente / Fazenda</Label>
                    {form.cliente_id ? (
                      <div className="flex items-center gap-2 p-3 rounded-md border bg-primary/5">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {clientes?.find(c => c.id === form.cliente_id)?.nome}
                          </div>
                          {clientes?.find(c => c.id === form.cliente_id)?.fazenda && (
                            <div className="text-xs text-muted-foreground">
                              {clientes?.find(c => c.id === form.cliente_id)?.fazenda}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setForm({ ...form, cliente_id: '' });
                            setClienteSearch('');
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder="Digite para buscar cliente..."
                          value={clienteSearch}
                          onChange={(e) => setClienteSearch(e.target.value)}
                          className="mb-2"
                        />
                        <div className="max-h-40 overflow-y-auto border rounded-md bg-background">
                          {clientes
                            ?.filter(c => {
                              const search = clienteSearch.toLowerCase();
                              return c.nome.toLowerCase().includes(search) || 
                                     (c.fazenda?.toLowerCase().includes(search) ?? false);
                            })
                            .slice(0, 20)
                            .map((cliente) => (
                              <div
                                key={cliente.id}
                                onClick={() => {
                                  setForm({ ...form, cliente_id: cliente.id });
                                }}
                                className="px-3 py-2 cursor-pointer hover:bg-muted border-b last:border-b-0"
                              >
                                <div className="font-medium text-sm">{cliente.nome}</div>
                                {cliente.fazenda && (
                                  <div className="text-xs text-muted-foreground">{cliente.fazenda}</div>
                                )}
                              </div>
                            ))}
                          {clientes?.filter(c => {
                            const search = clienteSearch.toLowerCase();
                            return c.nome.toLowerCase().includes(search) || 
                                   (c.fazenda?.toLowerCase().includes(search) ?? false);
                          }).length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              Nenhum cliente encontrado
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Peças ({itens.length})</Label>
                      <Button type="button" size="sm" onClick={addItem} className="bg-green-600 hover:bg-green-700 text-white">
                        <Plus className="mr-1 h-3 w-3" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {itens.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Clique em "Adicionar" para incluir peças ao pedido
                        </p>
                      )}
                      {itens.map((item, index) => {
                        const selectedPecaIds = itens.map(i => i.peca_id).filter(id => id !== item.peca_id);
                        const availablePecas = pecas?.filter(p => !selectedPecaIds.includes(p.id)) || [];
                        const selectedPeca = pecas?.find(p => p.id === item.peca_id);
                        
                        return (
                          <div key={index} className="p-2 rounded-lg border bg-muted/30 space-y-2">
                            {selectedPeca ? (
                              <div className="flex items-center gap-3 p-2 rounded-md border bg-primary/5">
                                {selectedPeca.imagem_url ? (
                                  <button
                                    type="button"
                                    onClick={() => setImagePreview({ url: selectedPeca.imagem_url!, nome: selectedPeca.nome })}
                                    className="shrink-0 hover:opacity-80 transition-opacity"
                                  >
                                    <img
                                      src={selectedPeca.imagem_url}
                                      alt={selectedPeca.nome}
                                      className="h-12 w-12 object-cover rounded"
                                    />
                                  </button>
                                ) : (
                                  <div className="h-12 w-12 flex items-center justify-center bg-muted rounded shrink-0">
                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{selectedPeca.codigo}</div>
                                  <div className="text-xs text-muted-foreground break-words">
                                    {selectedPeca.descricao || selectedPeca.nome}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0"
                                  onClick={() => {
                                    updateItem(index, 'peca_id', '');
                                    setPecaSearches({ ...pecaSearches, [index]: '' });
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Input
                                  placeholder="Buscar peça por código ou nome..."
                                  value={pecaSearches[index] || ''}
                                  onChange={(e) => setPecaSearches({ ...pecaSearches, [index]: e.target.value })}
                                  autoFocus
                                />
                                <div className="max-h-40 overflow-y-auto border rounded-md bg-background">
                                  {availablePecas
                                    .filter(p => {
                                      const searchTerms = (pecaSearches[index] || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
                                      if (searchTerms.length === 0) return true;
                                      const searchableText = `${p.codigo} ${p.nome} ${p.descricao || ''}`.toLowerCase();
                                      return searchTerms.every(term => searchableText.includes(term));
                                    })
                                    .slice(0, 15)
                                    .map((peca) => (
                                      <div
                                        key={peca.id}
                                        onClick={() => {
                                          updateItem(index, 'peca_id', peca.id);
                                        }}
                                        className="px-3 py-2 cursor-pointer hover:bg-muted border-b last:border-b-0 text-sm flex items-center gap-2"
                                      >
                                        {peca.imagem_url ? (
                                          <img
                                            src={peca.imagem_url}
                                            alt={peca.nome}
                                            className="h-8 w-8 object-cover rounded shrink-0"
                                          />
                                        ) : (
                                          <div className="h-8 w-8 flex items-center justify-center bg-muted rounded shrink-0">
                                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <span className="font-medium">{peca.codigo}</span>
                                          <span className="text-muted-foreground ml-1 break-words">- {peca.descricao || peca.nome}</span>
                                        </div>
                                      </div>
                                    ))}
                                  {availablePecas.filter(p => {
                                    const searchTerms = (pecaSearches[index] || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
                                    if (searchTerms.length === 0) return true;
                                    const searchableText = `${p.codigo} ${p.nome} ${p.descricao || ''}`.toLowerCase();
                                    return searchTerms.every(term => searchableText.includes(term));
                                  }).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      Nenhuma peça encontrada
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => decrementQuantity(index)}
                                  disabled={item.quantidade <= 1}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <div className="min-w-14 h-9 flex items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-lg px-3">
                                  {item.quantidade}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => incrementQuantity(index)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-destructive hover:text-destructive"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Urgência */}
                  <div className="space-y-2">
                    <Label>Urgência</Label>
                    <ToggleGroup 
                      type="single" 
                      value={form.urgencia} 
                      onValueChange={(v) => v && setForm({ ...form, urgencia: v })}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="baixa" className="text-xs data-[state=on]:bg-muted">Baixa</ToggleGroupItem>
                      <ToggleGroupItem value="normal" className="text-xs data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700">Normal</ToggleGroupItem>
                      <ToggleGroupItem value="alta" className="text-xs data-[state=on]:bg-orange-100 data-[state=on]:text-orange-700">Alta</ToggleGroupItem>
                      <ToggleGroupItem value="critica" className="text-xs data-[state=on]:bg-red-100 data-[state=on]:text-red-700">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Crítica
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                   {/* Tipo de Envio */}
                  <div className="space-y-2">
                    <Label>Tipo de Envio</Label>
                    <ToggleGroup 
                      type="single" 
                      value={form.tipo_envio} 
                      onValueChange={(v) => setForm({ ...form, tipo_envio: v || '' })}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="envio_fisico" className="text-xs gap-1">
                        <Truck className="h-3 w-3" />
                        Envio Físico
                      </ToggleGroupItem>
                      <ToggleGroupItem value="apenas_nf" className="text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        Apenas NF
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      placeholder="Observações adicionais..."
                      value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                      rows={2}
                    />
                  </div>

                  {/* Total de itens */}
                  {itens.length > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="font-bold text-lg">
                        {itens.filter(i => i.peca_id).length} {itens.filter(i => i.peca_id).length === 1 ? 'peça' : 'peças'}, {itens.reduce((sum, item) => sum + item.quantidade, 0)} {itens.reduce((sum, item) => sum + item.quantidade, 0) === 1 ? 'unidade' : 'unidades'}
                      </span>
                    </div>
                  )}

                  {/* Buttons - Delete and Save when editing draft */}
                  <div className="flex gap-2">
                    {editingPedido && editingPedido.status === 'rascunho' && (
                      <Button 
                        type="button" 
                        variant="destructive" 
                        className="flex-1"
                        onClick={handleDeletePedido}
                        disabled={isDeleting || isSubmitting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </>
                        )}
                      </Button>
                    )}
                    <Button type="submit" className={editingPedido?.status === 'rascunho' ? 'flex-1' : 'w-full'} disabled={isSubmitting || isDeleting}>
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {!isOnline && <CloudOff className="mr-2 h-4 w-4" />}
                          Salvar
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Tabs for Drafts and Transmitted Orders */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'rascunhos' | 'pedidos')} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <TabsList className="grid grid-cols-2 w-full sm:w-auto">
            <TabsTrigger value="rascunhos" className="gap-2">
              <FileText className="h-4 w-4" />
              <span>Rascunhos</span>
              {rascunhos.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {rascunhos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-2">
              <Send className="h-4 w-4" />
              <span>Transmitidos</span>
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'rascunhos' && rascunhos.length > 0 && (
            <Button 
              onClick={handleTransmitirTodos}
              disabled={isTransmitting}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              {isTransmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Transmitir Todos ({rascunhos.length})
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente, fazenda, código ou nome da peça..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {activeTab === 'pedidos' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="solicitado">Solicitado</SelectItem>
                    <SelectItem value="processamento">Em Processamento</SelectItem>
                    <SelectItem value="faturado">Faturado</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all' || tipoEnvioFilter !== 'all' || tipoLogisticaFilter !== 'all' || solicitanteFilter !== 'all') && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Date quick filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Período:</span>
              <div className="flex gap-1">
                <Button
                  variant={dateFilter === '30' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter(dateFilter === '30' ? 'all' : '30')}
                  className="h-7 text-xs"
                >
                  30 dias
                </Button>
                <Button
                  variant={dateFilter === 'all' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('all')}
                  className="h-7 text-xs"
                >
                  Todos
                </Button>
              </div>
              
              {/* Tipo envio filter */}
              {activeTab === 'pedidos' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Envio:</span>
                  <div className="flex gap-1">
                    <Button
                      variant={tipoEnvioFilter === 'all' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setTipoEnvioFilter('all')}
                      className="h-7 text-xs"
                    >
                      Todos
                    </Button>
                    <Button
                      variant={tipoEnvioFilter === 'envio' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoEnvioFilter(tipoEnvioFilter === 'envio' ? 'all' : 'envio')}
                      className="h-7 text-xs gap-1"
                    >
                      <Truck className="h-3 w-3" />
                      Envio Físico
                    </Button>
                    <Button
                      variant={tipoEnvioFilter === 'apenas_nf' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoEnvioFilter(tipoEnvioFilter === 'apenas_nf' ? 'all' : 'apenas_nf')}
                      className="h-7 text-xs gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Apenas NF
                    </Button>
                  </div>
                </div>
              )}

              {/* Tipo logistica filter */}
              {activeTab === 'pedidos' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Logística:</span>
                  <div className="flex gap-1">
                    <Button
                      variant={tipoLogisticaFilter === 'all' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setTipoLogisticaFilter('all')}
                      className="h-7 text-xs"
                    >
                      Todos
                    </Button>
                    <Button
                      variant={tipoLogisticaFilter === 'correios' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoLogisticaFilter(tipoLogisticaFilter === 'correios' ? 'all' : 'correios')}
                      className="h-7 text-xs gap-1"
                    >
                      <Truck className="h-3 w-3" />
                      Correios
                    </Button>
                    <Button
                      variant={tipoLogisticaFilter === 'entrega_propria' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoLogisticaFilter(tipoLogisticaFilter === 'entrega_propria' ? 'all' : 'entrega_propria')}
                      className="h-7 text-xs gap-1"
                    >
                      <HandHelping className="h-3 w-3" />
                      Entrega Própria
                    </Button>
                  </div>
                </div>
              )}

              {filteredAndSortedPedidos.length > 0 && (
                <Badge variant="outline" className="ml-2 h-6 px-2">
                  {filteredAndSortedPedidos.length} {filteredAndSortedPedidos.length === 1 ? 'pedido' : 'pedidos'}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pedidos?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Nenhum pedido criado</h3>
            <p className="text-muted-foreground">Clique em "Novo Pedido" para solicitar peças.</p>
          </CardContent>
        </Card>
      ) : activeTab === 'pedidos' ? (
        /* Transmitidos */
        pedidosTransmitidos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Send className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-semibold">Nenhum pedido transmitido</h3>
              <p className="text-muted-foreground">Transmita um rascunho para começar.</p>
            </CardContent>
          </Card>
        ) : canManagePedidos ? (
          <PedidoKanban
            pedidos={filteredAndSortedPedidos}
            onViewPedido={setViewingPedido}
            onProcessar={handleProcessar}
            onConcluir={handleConcluir}
            isProcessing={isProcessingAction}
            consultorNames={consultorNames}
          />
        ) : (
          /* Tabela somente leitura para perfis sem permissão de gestão */
          <div className="space-y-3">
            {paginatedPedidos.map((pedido) => (
              <Card key={pedido.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {pedido.pedido_code && (
                          <span className="font-mono text-xs text-muted-foreground">{pedido.pedido_code}</span>
                        )}
                        <Badge variant="outline" className={cn(statusColors[pedido.status], 'text-xs')}>
                          {statusLabels[pedido.status]}
                        </Badge>
                        {pedido.tipo_envio === 'apenas_nf' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <FileText className="h-3 w-3" />
                            Apenas NF
                          </Badge>
                        )}
                        {pedido.tipo_envio && pedido.tipo_envio !== 'apenas_nf' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Truck className="h-3 w-3" />
                            Envio Físico
                          </Badge>
                        )}
                        {pedido.tipo_logistica === 'correios' && (
                          <Badge variant="outline" className="text-xs gap-1 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-0">
                            <Truck className="h-3 w-3" />
                            Correios
                          </Badge>
                        )}
                        {pedido.tipo_logistica === 'entrega_propria' && (
                          <Badge variant="outline" className="text-xs gap-1 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-0">
                            <HandHelping className="h-3 w-3" />
                            Entrega Própria
                          </Badge>
                        )}
                        {pedido.urgencia === 'urgente' && (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Urgente
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium mt-2 break-words">{pedido.clientes?.nome}</h3>
                      {pedido.clientes?.fazenda && (
                        <p className="text-sm text-muted-foreground break-words">{pedido.clientes.fazenda}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {(pedido.pedido_itens?.filter((i: any) => !i.cancelled_at)?.length || 0)} {(pedido.pedido_itens?.filter((i: any) => !i.cancelled_at)?.length || 0) === 1 ? 'item' : 'itens'} · {format(new Date(pedido.created_at), "dd/MM/yy", { locale: ptBR })}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 shrink-0" onClick={() => setViewingPedido(pedido)}>
                      <Eye className="h-4 w-4" />
                      Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )
      ) : filteredAndSortedPedidos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Nenhum rascunho encontrado</h3>
          </CardContent>
        </Card>
      ) : (
        /* Rascunhos - keep card list */
        <div className="space-y-3">
          {filteredAndSortedPedidos.map((pedido) => (
            <Card key={pedido.id} className={cn(pedido._pendingSync && 'border-orange-300 border-dashed')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn(statusColors[pedido.status], 'text-xs')}>
                        {pedido._pendingSync && <CloudOff className="h-3 w-3 mr-1" />}
                        {statusLabels[pedido.status]}
                      </Badge>
                    </div>
                    <h3 className="font-medium mt-2 break-words">{pedido.clientes?.nome}</h3>
                    {pedido.clientes?.fazenda && (
                      <p className="text-sm text-muted-foreground break-words">{pedido.clientes.fazenda}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleEditPedido(pedido)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-success hover:bg-success/90 text-success-foreground h-9 gap-1"
                      onClick={() => handleTransmitir(pedido.id)}
                      disabled={isTransmitting}
                    >
                      {isTransmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span className="hidden sm:inline">Transmitir</span>
                    </Button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{format(new Date(pedido.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setViewingPedido(pedido)}>
                      <Eye className="h-4 w-4" />
                      Detalhes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </Tabs>

      {/* View Order Dialog (Read-Only) */}
      <Dialog open={!!viewingPedido} onOpenChange={(open) => { if (!open) { setViewingPedido(null); setIsEditingSolicitado(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {isEditingSolicitado ? 'Editar Pedido' : 'Detalhes do Pedido'}
              {viewingPedido?.pedido_code && (
                <span className="font-mono text-sm font-normal text-muted-foreground">{viewingPedido.pedido_code}</span>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEditingSolicitado ? 'Editar itens do pedido' : 'Visualizar detalhes do pedido'}
            </DialogDescription>
          </DialogHeader>
          
          {viewingPedido && isEditingSolicitado ? (
            <EditarPedidoSolicitado
              pedido={viewingPedido}
              onSaved={(updated) => {
                setViewingPedido(updated);
                setIsEditingSolicitado(false);
                triggerSync();
              }}
              onCancel={() => setIsEditingSolicitado(false)}
            />
          ) : viewingPedido && (
            <div className="space-y-4">
              {/* Status Badge + Edit Button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn(statusColors[viewingPedido.status], 'text-sm')}>
                    {statusLabels[viewingPedido.status]}
                  </Badge>
                  {viewingPedido._pendingSync && (
                    <Badge variant="outline" className="text-orange-500 border-orange-300">
                      <CloudOff className="h-3 w-3 mr-1" />
                      Pendente sync
                    </Badge>
                  )}
                </div>
                {canManagePedidos && viewingPedido.status === 'solicitado' && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setIsEditingSolicitado(true)}>
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                )}
              </div>

              {/* Cliente Info */}
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-semibold">{viewingPedido.clientes?.nome}</p>
                {viewingPedido.clientes?.fazenda && (
                  <p className="text-sm text-muted-foreground">{viewingPedido.clientes.fazenda}</p>
                )}
              </div>

              {/* Data */}
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Criado em: </span>
                  <span className="font-medium">
                    {format(new Date(viewingPedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>

              {/* Itens */}
              <div className="space-y-2">
                <Label>Itens do Pedido</Label>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {viewingPedido.pedido_itens?.map((item: any) => {
                    const peca = pecas?.find(p => p.id === item.peca_id) || item.pecas;
                    const isCancelled = !!item.cancelled_at;
                    return (
                      <div
                        key={item.id}
                        className={cn("flex items-center gap-3 p-3 rounded-lg border bg-card", isCancelled && "opacity-50")}
                      >
                        {/* Imagem da peça */}
                        <div 
                          className={cn(
                            "w-14 h-14 rounded-lg border flex items-center justify-center bg-muted shrink-0",
                            peca?.imagem_url && "cursor-pointer hover:ring-2 ring-primary"
                          )}
                          onClick={() => {
                            if (peca?.imagem_url) {
                              setImagePreview({ url: peca.imagem_url, nome: peca.nome });
                            }
                          }}
                        >
                          {peca?.imagem_url ? (
                            <img
                              src={peca.imagem_url}
                              alt={peca?.nome}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("font-mono text-sm font-medium", isCancelled && "line-through")}>{peca?.codigo}</span>
                            {peca?.familia && (
                              <Badge variant="secondary" className="text-[10px] h-5">{peca.familia}</Badge>
                            )}
                            {isCancelled && (
                              <Badge variant="outline" className="text-[10px] h-5 text-destructive border-destructive/30">Cancelado</Badge>
                            )}
                          </div>
                          <p className={cn("text-sm text-muted-foreground break-words whitespace-normal", isCancelled && "line-through")}>{peca?.nome}</p>
                          {(() => {
                            const isEditable = ['solicitado', 'processamento'].includes(viewingPedido.status);
                            const isEditingThis = editingAssetItemId === item.id;
                            
                            if (item.workshop_item?.unique_code) {
                              return (
                                <div className="mt-1">
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-[10px] h-5 font-mono border-primary/40 text-primary bg-primary/5">
                                      🏷️ {item.workshop_item.unique_code}
                                    </Badge>
                                    {isEditable && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => setEditingAssetItemId(isEditingThis ? null : item.id)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                  {isEditingThis && (
                                    <div className="mt-2">
                                      <AssetSearchField
                                        pecaId={item.peca_id}
                                        currentAssetId={item.workshop_item_id}
                                        onAssetSelected={(wsId) => handleAssetLinked(item.id, wsId)}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            } else if (item.pecas?.is_asset) {
                              return (
                                <div className="mt-1">
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-[10px] h-5 font-mono border-destructive/40 text-destructive bg-destructive/5">
                                      ⚠️ Ativo não vinculado
                                    </Badge>
                                    {isEditable && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => setEditingAssetItemId(isEditingThis ? null : item.id)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                  {isEditingThis && (
                                    <div className="mt-2">
                                      <AssetSearchField
                                        pecaId={item.peca_id}
                                        onAssetSelected={(wsId) => handleAssetLinked(item.id, wsId)}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-lg">x{item.quantidade}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Observações */}
              {viewingPedido.observacoes && (
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <p className="text-sm p-3 rounded-lg bg-muted/50 border">
                    {viewingPedido.observacoes}
                  </p>
                </div>
              )}

              {/* Total (excluding cancelled items) */}
              {(() => {
                const activeItems = viewingPedido.pedido_itens?.filter((i: any) => !i.cancelled_at) || [];
                const cancelledItems = viewingPedido.pedido_itens?.filter((i: any) => i.cancelled_at) || [];
                const totalPecas = activeItems.length;
                const totalUnidades = activeItems.reduce((sum: number, item: any) => sum + item.quantidade, 0);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="font-bold text-lg">
                        {totalPecas} {totalPecas === 1 ? 'peça' : 'peças'}, {totalUnidades} {totalUnidades === 1 ? 'unidade' : 'unidades'}
                      </span>
                    </div>
                    {cancelledItems.length > 0 && (
                      <p className="text-xs text-muted-foreground text-right">
                        + {cancelledItems.length} item(ns) cancelado(s)
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* NF Info if exists */}
              {viewingPedido.omie_nf_numero && (
                <div className="flex items-center gap-4 text-sm p-3 rounded-lg bg-success/10 border border-success/20">
                  <div>
                    <span className="text-muted-foreground">NF: </span>
                    <span className="font-medium">{viewingPedido.omie_nf_numero}</span>
                  </div>
                  {viewingPedido.omie_data_faturamento && (
                    <div>
                      <span className="text-muted-foreground">Faturado em: </span>
                      <span className="font-medium">
                        {format(new Date(viewingPedido.omie_data_faturamento), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Close button */}
              <Button variant="outline" className="w-full" onClick={() => setViewingPedido(null)}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!imagePreview} onOpenChange={(open) => !open && setImagePreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{imagePreview?.nome || 'Imagem da Peça'}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            {imagePreview?.url && (
              <img
                src={imagePreview.url}
                alt={imagePreview.nome}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
