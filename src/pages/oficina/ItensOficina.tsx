import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Search, Edit, History, Clock, Check, ChevronsUpDown, Wrench, Package, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WorkshopItem {
  id: string;
  unique_code: string;
  omie_product_id: string;
  meter_hours_last: number | null;
  meter_hours_updated_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  creation_source: string;
  pecas?: {
    id: string;
    nome: string;
    codigo: string;
    familia: string | null;
  };
  created_by?: {
    id: string;
    nome: string;
  } | null;
}

interface MeterReading {
  id: string;
  reading_value: number;
  measured_at: string;
  work_order_id: string | null;
  notes: string | null;
}

interface MotorReplacement {
  id: string;
  replaced_at_meter_hours: number;
  motor_hours_used: number | null;
  replaced_at: string;
  work_order_id: string | null;
  notes: string | null;
}

interface ItemPedidoHist {
  id: string;
  quantidade: number;
  created_at: string;
  pedidos: {
    pedido_code: string;
    tipo_solicitacao: string | null;
    status: string;
    created_at: string;
  } | null;
}

interface ClienteResumo {
  clienteId: string;
  nome: string;
  ativosCount: number;
  osCount: number;
}

interface Peca {
  id: string;
  codigo: string;
  nome: string;
  familia: string | null;
}

export default function ItensOficina() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkshopItem | null>(null);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<WorkshopItem | null>(null);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    unique_code: '',
    omie_product_id: '',
    status: 'disponivel',
    notes: '',
  });

  const isAdmin = role === 'admin' || role === 'coordenador_rplus' || role === 'coordenador_servicos' || role === 'coordenador_logistica';
  const [visualizacao, setVisualizacao] = useState<'itens' | 'clientes'>('itens');

  // Fetch workshop items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['workshop-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_items')
        .select(`
          *,
          pecas:omie_product_id (id, nome, codigo, familia),
          created_by:created_by_user_id (id, nome)
        `)
        .order('unique_code');
      if (error) throw error;
      return data as WorkshopItem[];
    },
  });

  // Fetch peças
  const { data: pecas = [] } = useQuery({
    queryKey: ['pecas-for-workshop'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pecas')
        .select('id, codigo, nome, familia')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as Peca[];
    },
  });

  // Fetch meter readings for selected item
  const { data: meterReadings = [] } = useQuery({
    queryKey: ['meter-readings', selectedItemForHistory?.id],
    queryFn: async () => {
      if (!selectedItemForHistory?.id) return [];
      const { data, error } = await supabase
        .from('asset_meter_readings')
        .select('*')
        .eq('workshop_item_id', selectedItemForHistory.id)
        .order('measured_at', { ascending: false });
      if (error) throw error;
      return data as MeterReading[];
    },
    enabled: !!selectedItemForHistory?.id,
  });

  // Fetch motor replacement history for selected item
  const { data: motorReplacements = [] } = useQuery({
    queryKey: ['motor-replacements', selectedItemForHistory?.id],
    queryFn: async () => {
      if (!selectedItemForHistory?.id) return [];
      // Using 'as any' because types haven't regenerated yet
      const { data, error } = await (supabase as any)
        .from('motor_replacement_history')
        .select('*')
        .eq('workshop_item_id', selectedItemForHistory.id)
        .order('replaced_at', { ascending: false });
      if (error) throw error;
      return data as MotorReplacement[];
    },
    enabled: !!selectedItemForHistory?.id,
  });

  // Fetch pedidos in which this specific asset appeared (history tab)
  const { data: itemPedidos = [] } = useQuery({
    queryKey: ['item-pedidos', selectedItemForHistory?.id],
    queryFn: async () => {
      if (!selectedItemForHistory?.id) return [];
      const { data, error } = await supabase
        .from('pedido_itens')
        .select('id, quantidade, created_at, pedidos:pedido_id (pedido_code, tipo_solicitacao, status, created_at)')
        .eq('workshop_item_id', selectedItemForHistory.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ItemPedidoHist[];
    },
    enabled: !!selectedItemForHistory?.id,
  });

  // "Por Cliente" view: distinct assets served per client via work orders
  const { data: clientesResumo = [], isLoading: isLoadingClientesResumo } = useQuery({
    queryKey: ['workshop-os-por-cliente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_order_items')
        .select('work_order_id, workshop_item_id, work_orders(cliente_id)')
        .not('workshop_item_id', 'is', null);
      if (error) throw error;
      const acc = new Map<string, { ativos: Set<string>; os: Set<string> }>();
      (data || []).forEach((r: any) => {
        const clienteId = r.work_orders?.cliente_id;
        if (!clienteId || !r.workshop_item_id) return;
        const entry = acc.get(clienteId) || { ativos: new Set<string>(), os: new Set<string>() };
        entry.ativos.add(r.workshop_item_id);
        entry.os.add(r.work_order_id);
        acc.set(clienteId, entry);
      });
      const clienteIds = [...acc.keys()];
      if (!clienteIds.length) return [];
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nome')
        .in('id', clienteIds);
      const nomes = new Map((clientes || []).map((c: any) => [c.id, c.nome]));
      return [...acc.entries()]
        .map(([clienteId, e]) => ({
          clienteId,
          nome: nomes.get(clienteId) || 'Cliente',
          ativosCount: e.ativos.size,
          osCount: e.os.size,
        }))
        .sort((a, b) => b.ativosCount - a.ativosCount || b.osCount - a.osCount) as ClienteResumo[];
    },
    enabled: visualizacao === 'clientes',
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('workshop_items')
          .update({
            unique_code: data.unique_code,
            omie_product_id: data.omie_product_id,
            status: data.status,
            notes: data.notes || null,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('workshop_items')
          .insert({
            unique_code: data.unique_code,
            omie_product_id: data.omie_product_id,
            status: data.status,
            notes: data.notes || null,
            created_by_user_id: user?.id || null,
            creation_source: 'manual',
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-items'] });
      toast.success(editingItem ? 'Item atualizado!' : 'Item criado!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao salvar item: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      unique_code: '',
      omie_product_id: '',
      status: 'disponivel',
      notes: '',
    });
    setEditingItem(null);
  };

  const handleEdit = (item: WorkshopItem) => {
    setEditingItem(item);
    setFormData({
      unique_code: item.unique_code,
      omie_product_id: item.omie_product_id,
      status: item.status,
      notes: item.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.unique_code.trim()) {
      toast.error('Informe o código único');
      return;
    }
    if (!formData.omie_product_id) {
      toast.error('Selecione o produto');
      return;
    }
    saveMutation.mutate({ ...formData, id: editingItem?.id });
  };

  const filteredItems = items.filter(item =>
    item.unique_code.toLowerCase().includes(search.toLowerCase()) ||
    item.pecas?.nome?.toLowerCase().includes(search.toLowerCase())
  );

  const statusLabels: Record<string, string> = {
    disponivel: 'Disponível',
    em_uso: 'Em Uso',
    em_manutencao: 'Em Manutenção',
    inativo: 'Inativo',
  };

  const statusPedidoLabels: Record<string, string> = {
    rascunho: 'Rascunho',
    solicitado: 'Solicitado',
    processamento: 'Processamento',
    faturado: 'Faturado',
    enviado: 'Enviado',
    entregue: 'Entregue',
    pendente: 'Pendente',
  };

  const tipoSolicitacaoLabels: Record<string, string> = {
    envio: 'Envio',
    coleta_reversa: 'Coleta Reversa',
  };

  const statusColors: Record<string, string> = {
    disponivel: 'bg-green-100 text-green-800',
    em_uso: 'bg-blue-100 text-blue-800',
    em_manutencao: 'bg-yellow-100 text-yellow-800',
    inativo: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ativos</h1>
          <p className="text-muted-foreground">Equipamentos físicos com identificação única</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Código Único</Label>
                  <Input
                    value={formData.unique_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, unique_code: e.target.value }))}
                    placeholder="Ex: PISTOLA-001"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Identificador único do equipamento (número de série, etiqueta, etc.)
                  </p>
                </div>
                <div>
                  <Label>Produto</Label>
                  <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productPopoverOpen}
                        className="w-full justify-between font-normal h-auto min-h-10 py-2"
                      >
                        <span className="text-left flex-1 mr-2 whitespace-normal break-words">
                          {formData.omie_product_id
                            ? (() => {
                                const peca = pecas.find((p) => p.id === formData.omie_product_id);
                                return peca ? `[${peca.codigo}] ${peca.nome}` : 'Produto selecionado';
                              })()
                            : 'Selecione o produto...'}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 z-50" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar produto..." />
                        <CommandList>
                          <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                          <CommandGroup>
                            {pecas.map((peca) => (
                              <CommandItem
                                key={peca.id}
                                value={`${peca.nome} ${peca.codigo} ${peca.familia || ''}`}
                                onSelect={() => {
                                  setFormData(prev => ({ ...prev, omie_product_id: peca.id }));
                                  setProductPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    formData.omie_product_id === peca.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="truncate">[{peca.codigo}] {peca.nome}</span>
                                  {peca.familia && (
                                    <span className="text-xs text-muted-foreground truncate">
                                      {peca.familia}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disponivel">Disponível</SelectItem>
                      <SelectItem value="em_uso">Em Uso</SelectItem>
                      <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Observações sobre o item..."
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar itens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex gap-1 ml-auto">
              <Button
                variant={visualizacao === 'itens' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setVisualizacao('itens')}
              >
                Itens
              </Button>
              <Button
                variant={visualizacao === 'clientes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setVisualizacao('clientes')}
              >
                <Users className="h-4 w-4 mr-1" />
                Por Cliente
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visualizacao === 'clientes' ? (
            isLoadingClientesResumo ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : clientesResumo.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma OS com ativos vinculados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Ativos distintos atendidos</TableHead>
                    <TableHead className="text-center">OS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesResumo.map((c) => (
                    <TableRow key={c.clienteId}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{c.ativosCount}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {c.osCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum item encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead>Código</TableHead>
                   <TableHead>Produto</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Horímetro</TableHead>
                   <TableHead>Criado em</TableHead>
                   <TableHead>Criado por</TableHead>
                   <TableHead>Origem</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-medium">{item.unique_code}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.pecas?.nome}</p>
                        <p className="text-xs text-muted-foreground">{item.pecas?.codigo}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[item.status] || ''}>
                        {statusLabels[item.status] || item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.meter_hours_last !== null ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{item.meter_hours_last}h</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                     </TableCell>
                     <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                       {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                     </TableCell>
                     <TableCell className="text-sm">
                       {item.created_by?.nome || '-'}
                     </TableCell>
                     <TableCell>
                       <Badge variant={item.creation_source === 'automatico' ? 'secondary' : 'outline'} className="text-xs">
                         {item.creation_source === 'automatico' ? 'Automático' : 'Manual'}
                       </Badge>
                     </TableCell>
                     <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItemForHistory(item);
                            setHistoryDialogOpen(true);
                          }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* History Dialog with Tabs */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Histórico: {selectedItemForHistory?.unique_code}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="horimetro" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="horimetro" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Horímetro
              </TabsTrigger>
              <TabsTrigger value="motor" className="flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                Trocas Motor
              </TabsTrigger>
              <TabsTrigger value="pedidos" className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                Pedidos
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="horimetro" className="mt-4">
              {meterReadings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma leitura registrada
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-auto">
                  {meterReadings.map((reading) => (
                    <div
                      key={reading.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{reading.reading_value} horas</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(reading.measured_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                        {reading.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{reading.notes}</p>
                        )}
                      </div>
                      {reading.work_order_id && (
                        <Badge variant="outline">OS</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="motor" className="mt-4">
              {motorReplacements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma troca de motor registrada
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-auto">
                  {motorReplacements.map((replacement) => (
                    <div
                      key={replacement.id}
                      className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-amber-600" />
                          <span className="font-medium text-amber-800 dark:text-amber-200">
                            {replacement.motor_hours_used != null
                              ? `Motor durou ${replacement.motor_hours_used}h`
                              : 'Motor trocado — horas desconhecidas'}
                          </span>
                        </div>
                        {replacement.work_order_id && (
                          <Badge variant="outline">OS</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Trocado com horímetro em {replacement.replaced_at_meter_hours}h
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(replacement.replaced_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                      {replacement.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{replacement.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pedidos" className="mt-4">
              {itemPedidos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum pedido registrado
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-auto">
                  {itemPedidos.map((ip) => (
                    <div
                      key={ip.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="font-medium font-mono">{ip.pedidos?.pedido_code || '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          {ip.pedidos?.tipo_solicitacao && tipoSolicitacaoLabels[ip.pedidos.tipo_solicitacao]
                            ? `${tipoSolicitacaoLabels[ip.pedidos.tipo_solicitacao]} · `
                            : ''}
                          {format(new Date(ip.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {ip.pedidos?.status
                          ? (statusPedidoLabels[ip.pedidos.status] || ip.pedidos.status)
                          : '—'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
