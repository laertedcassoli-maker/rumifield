import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Activity {
  id: string;
  name: string;
  execution_type: 'UNIVOCA' | 'LOTE';
  requires_unique_item: boolean;
}

interface WorkshopItem {
  id: string;
  unique_code: string;
  omie_product_id: string;
  meter_hours_last: number | null;
  pecas?: {
    nome: string;
    codigo: string;
  };
}

interface ActivityProduct {
  activity_id: string;
  omie_product_id: string;
  requires_meter_hours: boolean;
}

interface Cliente {
  id: string;
  nome: string;
  fazenda: string | null;
  cod_imilk: string | null;
}

interface NovaOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovaOSDialog({ open, onOpenChange, onSuccess }: NovaOSDialogProps) {
  const { user } = useAuth();
  const [creationPath, setCreationPath] = useState<'activity' | 'item'>('item');
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');

  // Fetch activities
  const { data: activities = [] } = useQuery({
    queryKey: ['activities-for-os'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Activity[];
    },
    enabled: open,
  });

  // Fetch workshop items
  const { data: workshopItems = [] } = useQuery({
    queryKey: ['workshop-items-for-os'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_items')
        .select(`
          *,
          pecas:omie_product_id (nome, codigo)
        `)
        .eq('status', 'disponivel')
        .order('unique_code');
      if (error) throw error;
      return data as WorkshopItem[];
    },
    enabled: open,
  });

  // Fetch activity products to know which activities are associated with selected item
  const { data: activityProducts = [] } = useQuery({
    queryKey: ['activity-products-for-os'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_products')
        .select('*');
      if (error) throw error;
      return data as ActivityProduct[];
    },
    enabled: open,
  });

  // Fetch clientes (from iMilk)
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-for-os'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cod_imilk')
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      return data as Cliente[];
    },
    enabled: open,
  });

  const selectedActivity = activities.find(a => a.id === selectedActivityId);
  const selectedItem = workshopItems.find(i => i.id === selectedItemId);
  const selectedCliente = clientes.find(c => c.id === selectedClienteId);

  // Filter clientes based on search
  const filteredClientes = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    cliente.fazenda?.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    cliente.cod_imilk?.toLowerCase().includes(clienteSearch.toLowerCase())
  );
  
  // Check if selected item requires meter hours
  const itemRequiresMeterHours = selectedItem && activityProducts.some(
    ap => ap.omie_product_id === selectedItem.omie_product_id && ap.requires_meter_hours
  );

  // Filter activities based on selected item (via activity_products)
  const filteredActivitiesForItem = activities.filter(activity => {
    if (!selectedItem) return true;
    return activityProducts.some(
      ap => ap.activity_id === activity.id && ap.omie_product_id === selectedItem.omie_product_id
    );
  });

  // Filter items based on search
  const filteredItems = workshopItems.filter(item =>
    item.unique_code.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.pecas?.nome?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  // Create OS mutation
  const createOSMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedActivityId) {
        throw new Error('Dados obrigatórios não preenchidos');
      }

      // Generate code
      const { data: codeData, error: codeError } = await supabase.rpc('generate_work_order_code');
      if (codeError) throw codeError;
      
      const code = codeData as string;

      // Create work order
      const { data: osData, error: osError } = await supabase
        .from('work_orders')
        .insert({
          code,
          activity_id: selectedActivityId,
          created_by_user_id: user.id,
          assigned_to_user_id: user.id,
          notes: notes || null,
          cliente_id: selectedClienteId || null,
        })
        .select()
        .single();

      if (osError) throw osError;

      // Create work order item (only when there's a valid item or product)
      if (selectedActivity?.execution_type === 'UNIVOCA' && selectedItem) {
        const { error: itemError } = await supabase
          .from('work_order_items')
          .insert({
            work_order_id: osData.id,
            quantity: 1,
            workshop_item_id: selectedItem.id,
          });
        if (itemError) throw itemError;
      } else if (selectedActivity?.execution_type === 'LOTE') {
        // For LOTE, try to find a linked product; skip item creation if none
        const firstProduct = activityProducts.find(ap => ap.activity_id === selectedActivityId);
        if (firstProduct) {
          const { error: itemError } = await supabase
            .from('work_order_items')
            .insert({
              work_order_id: osData.id,
              quantity,
              omie_product_id: firstProduct.omie_product_id,
            });
          if (itemError) throw itemError;
        }
        // If no activity_product linked, skip — OS is created without items
      }

      // Update workshop item status if UNIVOCA
      if (selectedActivity?.execution_type === 'UNIVOCA' && selectedItem) {
        const { error: updateError } = await supabase
          .from('workshop_items')
          .update({ status: 'em_manutencao' })
          .eq('id', selectedItem.id);
        if (updateError) throw updateError;
      }

      return osData;
    },
    onSuccess: () => {
      toast.success('Ordem de Serviço criada com sucesso!');
      onSuccess();
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao criar OS: ' + error.message);
    },
  });

  const resetForm = () => {
    setCreationPath('item');
    setSelectedActivityId('');
    setSelectedItemId('');
    setItemSearch('');
    setQuantity(1);
    setNotes('');
    setSelectedClienteId('');
    setClienteSearch('');
  };

  // Auto-select activity when item is selected and there's only one matching activity
  const handleSelectItem = (item: WorkshopItem) => {
    setSelectedItemId(item.id);
    setItemSearch(item.unique_code);
    
    // Find activities linked to this item's product
    const linkedActivities = activities.filter(activity =>
      activityProducts.some(
        ap => ap.activity_id === activity.id && ap.omie_product_id === item.omie_product_id
      )
    );
    
    // If there's exactly one activity, auto-select it
    if (linkedActivities.length === 1) {
      setSelectedActivityId(linkedActivities[0].id);
    } else {
      // Reset activity selection if multiple or none
      setSelectedActivityId('');
    }
  };

  const canSubmit = () => {
    if (!selectedActivityId) return false;
    
    if (selectedActivity?.execution_type === 'UNIVOCA') {
      if (!selectedItemId) return false;
      if (!selectedClienteId) return false; // Cliente obrigatório para UNIVOCA
    } else {
      if (quantity < 1) return false;
    }
    
    return true;
  };

  const handleSubmit = () => {
    if (!canSubmit()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    createOSMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>

        <Tabs value={creationPath} onValueChange={(v) => setCreationPath(v as 'activity' | 'item')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activity">Por Atividade</TabsTrigger>
            <TabsTrigger value="item">Por Código do Item</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
            <div>
              <Label>Atividade</Label>
              <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a atividade" />
                </SelectTrigger>
                <SelectContent>
                  {activities.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      <div className="flex items-center gap-2">
                        {activity.name}
                        <Badge variant="outline" className="text-xs">
                          {activity.execution_type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedActivity?.execution_type === 'UNIVOCA' && (
              <div>
                <Label>Ativo</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Digite o código do ativo..."
                      value={itemSearch}
                      onChange={(e) => { setItemSearch(e.target.value); setSelectedItemId(''); }}
                      className="pl-9"
                    />
                  </div>
                  
                  {/* Mostrar resultado selecionado */}
                  {selectedItem && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono font-medium">{selectedItem.unique_code}</p>
                            <p className="text-sm text-muted-foreground">{selectedItem.pecas?.nome}</p>
                            {selectedItem.meter_hours_last !== null && (
                              <p className="text-xs text-muted-foreground">
                                Último horímetro: {selectedItem.meter_hours_last}h
                              </p>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => { setSelectedItemId(''); setItemSearch(''); }}
                          >
                            ✕
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Lista de resultados da busca (só aparece se buscar e não tiver selecionado) */}
                  {itemSearch.length >= 2 && !selectedItem && (
                    <div className="max-h-[200px] overflow-auto border rounded-lg">
                      {filteredItems.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          Nenhum ativo encontrado
                        </div>
                      ) : (
                        filteredItems.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSelectItem(item)}
                          >
                            <p className="font-mono font-medium">{item.unique_code}</p>
                            <p className="text-xs text-muted-foreground">{item.pecas?.nome}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  
                  {itemSearch.length > 0 && itemSearch.length < 2 && !selectedItem && (
                    <p className="text-xs text-muted-foreground">Digite pelo menos 2 caracteres...</p>
                  )}
                </div>
              </div>
            )}

            {selectedActivity?.execution_type === 'LOTE' && (
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="item" className="space-y-4">
            <div>
              <Label>Código do Ativo</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite o código do ativo..."
                    value={itemSearch}
                    onChange={(e) => { setItemSearch(e.target.value); setSelectedItemId(''); }}
                    className="pl-9"
                  />
                </div>
                
                {/* Mostrar resultado selecionado */}
                {selectedItem && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-medium">{selectedItem.unique_code}</p>
                          <p className="text-sm text-muted-foreground">{selectedItem.pecas?.nome}</p>
                          {selectedItem.meter_hours_last !== null && (
                            <p className="text-xs text-muted-foreground">
                              Último horímetro: {selectedItem.meter_hours_last}h
                            </p>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => { setSelectedItemId(''); setItemSearch(''); }}
                        >
                          ✕
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Lista de resultados da busca */}
                {itemSearch.length >= 2 && !selectedItem && (
                  <div className="max-h-[150px] overflow-auto border rounded-lg">
                    {filteredItems.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        Nenhum ativo encontrado
                      </div>
                    ) : (
                      filteredItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSelectItem(item)}
                        >
                          <p className="font-mono font-medium">{item.unique_code}</p>
                          <p className="text-xs text-muted-foreground">{item.pecas?.nome}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                {itemSearch.length > 0 && itemSearch.length < 2 && !selectedItem && (
                  <p className="text-xs text-muted-foreground">Digite pelo menos 2 caracteres...</p>
                )}
              </div>
            </div>

            {selectedItem && (
              <div>
                <Label>Atividade</Label>
                <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a atividade" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredActivitiesForItem.length === 0 ? (
                      <div className="p-2 text-center text-muted-foreground text-sm">
                        Nenhuma atividade vinculada a este produto
                      </div>
                    ) : (
                      filteredActivitiesForItem.map((activity) => (
                        <SelectItem key={activity.id} value={activity.id}>
                          {activity.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Indicador de que horímetro será solicitado durante manutenção */}
        {itemRequiresMeterHours && selectedItem && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              ⏱️ Este equipamento requer leitura de horímetro. O técnico deverá informar na abertura e fechamento da manutenção.
            </p>
            {selectedItem.meter_hours_last !== null && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Último registro: {selectedItem.meter_hours_last} horas
              </p>
            )}
          </div>
        )}

        {/* Campo de Cliente */}
        <div>
          <Label>
            Cliente (origem das peças)
            {selectedActivity?.execution_type === 'UNIVOCA' && (
              <span className="text-destructive ml-1">*</span>
            )}
          </Label>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome, fazenda ou código iMilk..."
                value={clienteSearch}
                onChange={(e) => { setClienteSearch(e.target.value); setSelectedClienteId(''); }}
                className="pl-9"
              />
            </div>
            
            {/* Mostrar cliente selecionado */}
            {selectedCliente && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedCliente.nome}</p>
                      {selectedCliente.fazenda && (
                        <p className="text-sm text-muted-foreground">{selectedCliente.fazenda}</p>
                      )}
                      {selectedCliente.cod_imilk && (
                        <p className="text-xs text-muted-foreground">iMilk: {selectedCliente.cod_imilk}</p>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => { setSelectedClienteId(''); setClienteSearch(''); }}
                    >
                      ✕
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Lista de resultados da busca */}
            {clienteSearch.length >= 2 && !selectedCliente && (
              <div className="max-h-[150px] overflow-auto border rounded-lg">
                {filteredClientes.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhum cliente encontrado
                  </div>
                ) : (
                  filteredClientes.slice(0, 10).map((cliente) => (
                    <div
                      key={cliente.id}
                      className="p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedClienteId(cliente.id); setClienteSearch(cliente.nome); }}
                    >
                      <p className="font-medium">{cliente.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {cliente.fazenda}{cliente.cod_imilk ? ` • iMilk: ${cliente.cod_imilk}` : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {clienteSearch.length > 0 && clienteSearch.length < 2 && !selectedCliente && (
              <p className="text-xs text-muted-foreground">Digite pelo menos 2 caracteres...</p>
            )}
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações sobre a OS..."
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={createOSMutation.isPending || !canSubmit()}>
            {createOSMutation.isPending ? 'Criando...' : 'Criar OS'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
