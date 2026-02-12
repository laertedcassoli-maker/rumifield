import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Search,
  Filter,
  X,
  Package,
  Loader2,
  Eye,
  Trash2,
  AlertTriangle,
  CloudOff,
  RefreshCw,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOfflinePedidos, type PedidoComItens } from '@/hooks/useOfflinePedidos';
import { useOffline } from '@/contexts/OfflineContext';
import PedidoKanban from '@/components/pedidos/PedidoKanban';

const statusOptions = [
  { value: 'solicitado', label: 'Solicitado' },
  { value: 'processamento', label: 'Em Processamento' },
  { value: 'faturado', label: 'Faturado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const urgenciaOptions = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

const origemOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'preventiva', label: 'Preventiva' },
  { value: 'corretiva', label: 'Corretiva' },
  { value: 'chamado', label: 'Chamado' },
];

export default function Pedidos() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOnline } = useOffline();
  const { pedidos, isLoading } = useOfflinePedidos();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgenciaFilter, setUrgenciaFilter] = useState<string>('all');
  const [origemFilter, setOrigemFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const [selectedPedido, setSelectedPedido] = useState<PedidoComItens | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const consultorNames = useMemo(() => {
    const names: Record<string, string> = {};
    pedidos.forEach(p => {
      if (p.solicitante_id && p.solicitante?.nome) {
        names[p.solicitante_id] = p.solicitante.nome;
      }
    });
    return names;
  }, [pedidos]);

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(pedido => {
      const matchesSearch = !searchTerm || 
        pedido.clientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.clientes?.fazenda?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.pedido_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.solicitante?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || pedido.status === statusFilter;
      const matchesUrgencia = urgenciaFilter === 'all' || pedido.urgencia === urgenciaFilter;
      const matchesOrigem = origemFilter === 'all' || pedido.origem === origemFilter;

      return matchesSearch && matchesStatus && matchesUrgencia && matchesOrigem;
    });
  }, [pedidos, searchTerm, statusFilter, urgenciaFilter, origemFilter]);

  const handleViewPedido = useCallback((pedido: PedidoComItens) => {
    setSelectedPedido(pedido);
  }, []);

  const handleDeletePedido = useCallback(async (pedidoId: string) => {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
    
    setIsProcessingAction(true);
    try {
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', pedidoId);

      if (error) throw error;

      toast({
        title: 'Pedido excluído',
        description: 'O pedido foi excluído com sucesso.',
      });
      // sync handled by reactivity
    } catch (error) {
      toast({
        title: 'Erro ao excluir pedido',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingAction(false);
    }
  }, [toast]);

  // Processar pedido (solicitado -> processamento, optionally set tipo_logistica)
  const handleProcessar = useCallback(async (pedidoId: string, tipoLogistica?: string, assetCodes?: Record<string, string[]>) => {
    setIsProcessingAction(true);
    try {
      // Update asset codes first if provided
      if (assetCodes) {
        const pedido = pedidos.find(p => p.id === pedidoId);
        if (pedido) {
          for (const item of pedido.pedido_itens || []) {
            if (assetCodes[item.id]) {
              const { error } = await supabase
                .from('pedido_itens')
                .update({ asset_codes: assetCodes[item.id] })
                .eq('id', item.id);
              if (error) throw error;
            }
          }
        }
      }

      const { error } = await supabase
        .from('pedidos')
        .update({ status: 'processamento', tipo_logistica: tipoLogistica || null })
        .eq('id', pedidoId);
      if (error) throw error;

      toast({
        title: 'Pedido processado',
        description: 'O pedido foi movido para processamento.',
      });
      // sync handled by reactivity
    } catch (error) {
      toast({
        title: 'Erro ao processar pedido',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingAction(false);
    }
  }, [pedidos, toast]);

  // Concluir pedido (processamento -> faturado + NF + tipo_logistica)
  const handleConcluir = useCallback(async (pedidoId: string, nfNumero: string, dataFaturamento: string, tipoLogistica: string, assetCodes?: Record<string, string[]>) => {
    setIsProcessingAction(true);
    try {
      // Update asset codes first if provided
      if (assetCodes) {
        const pedido = pedidos.find(p => p.id === pedidoId);
        if (pedido) {
          for (const item of pedido.pedido_itens || []) {
            if (assetCodes[item.id]) {
              const { error } = await supabase
                .from('pedido_itens')
                .update({ asset_codes: assetCodes[item.id] })
                .eq('id', item.id);
              if (error) throw error;
            }
          }
        }
      }

      const { error } = await supabase
        .from('pedidos')
        .update({
          status: 'faturado',
          omie_nf_numero: nfNumero,
          omie_data_faturamento: dataFaturamento,
          tipo_logistica: tipoLogistica,
        })
        .eq('id', pedidoId);
      if (error) throw error;

      toast({
        title: 'Pedido concluído',
        description: 'O pedido foi faturado com sucesso.',
      });
      // sync handled by reactivity
    } catch (error) {
      toast({
        title: 'Erro ao concluir pedido',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingAction(false);
    }
  }, [pedidos, toast]);

  const activeFiltersCount = [
    statusFilter !== 'all',
    urgenciaFilter !== 'all',
    origemFilter !== 'all',
  ].filter(Boolean).length;

  const pendingSyncCount = pedidos.filter(p => p._pendingSync).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">
            Gerencie os pedidos de peças
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <Badge variant="outline" className="gap-1 border-orange-300 text-orange-600">
              <CloudOff className="h-3 w-3" />
              Offline
            </Badge>
          )}
          {pendingSyncCount > 0 && (
            <Badge variant="outline" className="gap-1 border-orange-300 text-orange-600">
              <RefreshCw className="h-3 w-3" />
              {pendingSyncCount} pendente{pendingSyncCount > 1 ? 's' : ''}
            </Badge>
          )}
          <Button onClick={() => navigate('/pedidos/novo')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, fazenda, código ou solicitante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                  className="rounded-r-none"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Urgência</Label>
                  <Select value={urgenciaFilter} onValueChange={setUrgenciaFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {urgenciaOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select value={origemFilter} onValueChange={setOrigemFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {origemOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === 'kanban' ? (
        <PedidoKanban
          pedidos={filteredPedidos}
          onViewPedido={handleViewPedido}
          onProcessar={handleProcessar}
          onConcluir={handleConcluir}
          isProcessing={isProcessingAction}
          consultorNames={consultorNames}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {filteredPedidos.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum pedido encontrado</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredPedidos.map(pedido => (
                  <div key={pedido.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{pedido.clientes?.nome}</span>
                          {pedido._pendingSync && (
                            <Badge variant="outline" className="text-[10px] h-5 border-orange-300 text-orange-500">
                              <CloudOff className="h-2.5 w-2.5 mr-1" />
                              Pendente
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pedido.pedido_itens?.length || 0} peças • {pedido.pedido_code || 'Sem código'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPedido(pedido)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pedido Details - handled by inline selection */}
    </div>
  );
}
