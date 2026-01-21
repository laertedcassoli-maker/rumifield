import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Activity {
  id: string;
  name: string;
  execution_type: 'UNIVOCA' | 'LOTE';
  requires_unique_item: boolean;
  allows_quantity: boolean;
  is_active: boolean;
  created_at: string;
}

interface Peca {
  id: string;
  codigo: string;
  nome: string;
  familia: string | null;
}

interface ActivityProduct {
  id: string;
  activity_id: string;
  omie_product_id: string;
  is_default: boolean;
  requires_meter_hours: boolean;
}

export default function Atividades() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productsDialogOpen, setProductsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [selectedActivityForProducts, setSelectedActivityForProducts] = useState<Activity | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    execution_type: 'UNIVOCA' as 'UNIVOCA' | 'LOTE',
    requires_unique_item: true,
    allows_quantity: false,
    is_active: true,
  });

  const isAdmin = role === 'admin' || role === 'coordenador_rplus' || role === 'coordenador_servicos';

  // Fetch activities
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Activity[];
    },
  });

  // Fetch peças for product association
  const { data: pecas = [] } = useQuery({
    queryKey: ['pecas-for-activities'],
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

  // Fetch activity products for selected activity
  const { data: activityProducts = [] } = useQuery({
    queryKey: ['activity-products', selectedActivityForProducts?.id],
    queryFn: async () => {
      if (!selectedActivityForProducts?.id) return [];
      const { data, error } = await supabase
        .from('activity_products')
        .select('*')
        .eq('activity_id', selectedActivityForProducts.id);
      if (error) throw error;
      return data as ActivityProduct[];
    },
    enabled: !!selectedActivityForProducts?.id,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('activities')
          .update({
            name: data.name,
            execution_type: data.execution_type,
            requires_unique_item: data.requires_unique_item,
            allows_quantity: data.allows_quantity,
            is_active: data.is_active,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('activities')
          .insert({
            name: data.name,
            execution_type: data.execution_type,
            requires_unique_item: data.requires_unique_item,
            allows_quantity: data.allows_quantity,
            is_active: data.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast.success(editingActivity ? 'Atividade atualizada!' : 'Atividade criada!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao salvar atividade: ' + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast.success('Atividade excluída!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });

  // Toggle product association
  const toggleProductMutation = useMutation({
    mutationFn: async ({ activityId, productId, isAdding, requiresMeterHours }: { 
      activityId: string; 
      productId: string; 
      isAdding: boolean;
      requiresMeterHours?: boolean;
    }) => {
      if (isAdding) {
        const { error } = await supabase
          .from('activity_products')
          .insert({
            activity_id: activityId,
            omie_product_id: productId,
            requires_meter_hours: requiresMeterHours || false,
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('activity_products')
          .delete()
          .eq('activity_id', activityId)
          .eq('omie_product_id', productId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-products', selectedActivityForProducts?.id] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar produto: ' + error.message);
    },
  });

  // Toggle meter hours requirement
  const toggleMeterHoursMutation = useMutation({
    mutationFn: async ({ activityId, productId, requiresMeterHours }: {
      activityId: string;
      productId: string;
      requiresMeterHours: boolean;
    }) => {
      const { error } = await supabase
        .from('activity_products')
        .update({ requires_meter_hours: requiresMeterHours })
        .eq('activity_id', activityId)
        .eq('omie_product_id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-products', selectedActivityForProducts?.id] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      execution_type: 'UNIVOCA',
      requires_unique_item: true,
      allows_quantity: false,
      is_active: true,
    });
    setEditingActivity(null);
  };

  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setFormData({
      name: activity.name,
      execution_type: activity.execution_type,
      requires_unique_item: activity.requires_unique_item,
      allows_quantity: activity.allows_quantity,
      is_active: activity.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Informe o nome da atividade');
      return;
    }
    saveMutation.mutate({ ...formData, id: editingActivity?.id });
  };

  const handleExecutionTypeChange = (type: 'UNIVOCA' | 'LOTE') => {
    setFormData(prev => ({
      ...prev,
      execution_type: type,
      requires_unique_item: type === 'UNIVOCA',
      allows_quantity: type === 'LOTE',
    }));
  };

  const filteredActivities = activities.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const isProductLinked = (productId: string) => {
    return activityProducts.some(ap => ap.omie_product_id === productId);
  };

  const getProductMeterHours = (productId: string) => {
    const ap = activityProducts.find(ap => ap.omie_product_id === productId);
    return ap?.requires_meter_hours || false;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Atividades de Oficina</h1>
          <p className="text-muted-foreground">Gerencie as atividades de manutenção</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Atividade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingActivity ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome da Atividade</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Manutenção de Pistola"
                  />
                </div>
                <div>
                  <Label>Tipo de Execução</Label>
                  <Select value={formData.execution_type} onValueChange={(v) => handleExecutionTypeChange(v as 'UNIVOCA' | 'LOTE')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNIVOCA">Unívoca (1 item único)</SelectItem>
                      <SelectItem value="LOTE">Lote (múltiplos itens)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.execution_type === 'UNIVOCA' 
                      ? 'Requer um item único identificado (ex: pistola com número de série)'
                      : 'Permite múltiplas unidades do mesmo produto'}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
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
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar atividades..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma atividade encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.name}</TableCell>
                    <TableCell>
                      <Badge variant={activity.execution_type === 'UNIVOCA' ? 'default' : 'secondary'}>
                        {activity.execution_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={activity.is_active ? 'default' : 'outline'}>
                        {activity.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedActivityForProducts(activity);
                            setProductsDialogOpen(true);
                          }}
                        >
                          <Package className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(activity)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Excluir esta atividade?')) {
                                  deleteMutation.mutate(activity.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
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

      {/* Products Association Dialog */}
      <Dialog open={productsDialogOpen} onOpenChange={setProductsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Produtos Vinculados: {selectedActivityForProducts?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-4">
              {pecas.map((peca) => {
                const isLinked = isProductLinked(peca.id);
                const requiresMeter = getProductMeterHours(peca.id);
                
                return (
                  <div
                    key={peca.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isLinked}
                        onCheckedChange={(checked) => {
                          if (selectedActivityForProducts) {
                            toggleProductMutation.mutate({
                              activityId: selectedActivityForProducts.id,
                              productId: peca.id,
                              isAdding: !!checked,
                            });
                          }
                        }}
                      />
                      <div>
                        <p className="font-medium">{peca.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {peca.codigo} {peca.familia && `• ${peca.familia}`}
                        </p>
                      </div>
                    </div>
                    {isLinked && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Horímetro</Label>
                        <Switch
                          checked={requiresMeter}
                          onCheckedChange={(checked) => {
                            if (selectedActivityForProducts) {
                              toggleMeterHoursMutation.mutate({
                                activityId: selectedActivityForProducts.id,
                                productId: peca.id,
                                requiresMeterHours: checked,
                              });
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductsDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
