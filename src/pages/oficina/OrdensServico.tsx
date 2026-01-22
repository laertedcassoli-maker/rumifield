import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Search, Eye, Play, Pause, CheckCircle, Clock, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NovaOSDialog } from '@/components/oficina/NovaOSDialog';
import { DetalheOSDialog } from '@/components/oficina/DetalheOSDialog';

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
  profiles?: {
    nome: string;
  };
  item_info?: {
    unique_code?: string;
    product_name?: string;
  };
}

export default function OrdensServico() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('abertas');
  const [novaOSDialogOpen, setNovaOSDialogOpen] = useState(false);
  const [selectedOS, setSelectedOS] = useState<WorkOrder | null>(null);
  const [detalheDialogOpen, setDetalheDialogOpen] = useState(false);

  const isAdmin = role === 'admin' || role === 'coordenador_rplus' || role === 'coordenador_servicos';

  // Fetch work orders
  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['work-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          activities:activity_id (id, name, execution_type)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Fetch profiles separately for assigned users
      const userIds = data?.map(wo => wo.assigned_to_user_id).filter(Boolean) || [];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', userIds);
        profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome }), {});
      }

      // Fetch work order items with workshop items and products
      const workOrderIds = data?.map(wo => wo.id) || [];
      let itemsMap: Record<string, { unique_code?: string; product_name?: string }> = {};

      if (workOrderIds.length > 0) {
        const { data: items } = await supabase
          .from('work_order_items')
          .select(`
            work_order_id,
            workshop_item_id,
            omie_product_id
          `)
          .in('work_order_id', workOrderIds);

        if (items && items.length > 0) {
          // Get workshop items for unique codes
          const workshopItemIds = items.map(i => i.workshop_item_id).filter(Boolean);
          const productIds = items.map(i => i.omie_product_id).filter(Boolean);

          let workshopItemsMap: Record<string, { unique_code: string; omie_product_id: string }> = {};
          let productsMap: Record<string, string> = {};

          if (workshopItemIds.length > 0) {
            const { data: workshopItems } = await supabase
              .from('workshop_items')
              .select('id, unique_code, omie_product_id')
              .in('id', workshopItemIds);
            workshopItemsMap = (workshopItems || []).reduce((acc, wi) => ({
              ...acc,
              [wi.id]: { unique_code: wi.unique_code, omie_product_id: wi.omie_product_id }
            }), {});

            // Add product IDs from workshop items
            workshopItems?.forEach(wi => {
              if (wi.omie_product_id && !productIds.includes(wi.omie_product_id)) {
                productIds.push(wi.omie_product_id);
              }
            });
          }

          if (productIds.length > 0) {
            const { data: products } = await supabase
              .from('pecas')
              .select('id, nome')
              .in('id', productIds);
            productsMap = (products || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome }), {});
          }

          // Map items to work orders
          items.forEach(item => {
            const workshopItem = item.workshop_item_id ? workshopItemsMap[item.workshop_item_id] : null;
            const productId = workshopItem?.omie_product_id || item.omie_product_id;
            
            itemsMap[item.work_order_id] = {
              unique_code: workshopItem?.unique_code,
              product_name: productId ? productsMap[productId] : undefined
            };
          });
        }
      }
      
      return (data || []).map(wo => ({
        ...wo,
        profiles: wo.assigned_to_user_id ? { nome: profilesMap[wo.assigned_to_user_id] || '-' } : undefined,
        item_info: itemsMap[wo.id],
      })) as WorkOrder[];
    },
  });

  const filteredOrders = workOrders.filter(wo => {
    const matchesSearch = wo.code.toLowerCase().includes(search.toLowerCase()) ||
      wo.activities?.name?.toLowerCase().includes(search.toLowerCase());
    
    if (activeTab === 'abertas') {
      return matchesSearch && wo.status !== 'concluido';
    } else if (activeTab === 'concluidas') {
      return matchesSearch && wo.status === 'concluido';
    }
    return matchesSearch;
  });

  const statusLabels: Record<string, string> = {
    aguardando: 'Aguardando',
    em_manutencao: 'Em Manutenção',
    concluido: 'Concluído',
  };

  const statusColors: Record<string, string> = {
    aguardando: 'bg-yellow-100 text-yellow-800',
    em_manutencao: 'bg-blue-100 text-blue-800',
    concluido: 'bg-green-100 text-green-800',
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleViewOS = (os: WorkOrder) => {
    setSelectedOS(os);
    setDetalheDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
          <p className="text-muted-foreground">Gerencie as ordens de manutenção</p>
        </div>
        <Button onClick={() => setNovaOSDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova OS
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="abertas">
            Abertas ({workOrders.filter(wo => wo.status !== 'concluido').length})
          </TabsTrigger>
          <TabsTrigger value="concluidas">
            Concluídas ({workOrders.filter(wo => wo.status === 'concluido').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar OS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma OS encontrada
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Atividade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Tempo</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((os) => (
                          <TableRow key={os.id}>
                            <TableCell className="font-mono font-medium">{os.code}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{os.activities?.name}</p>
                                {os.item_info?.unique_code && (
                                  <Badge variant="secondary" className="font-mono text-xs mt-1">
                                    {os.item_info.unique_code}
                                  </Badge>
                                )}
                                {os.item_info?.product_name && (
                                  <p className="text-xs text-muted-foreground break-words whitespace-normal mt-2">
                                    {os.item_info.product_name}
                                  </p>
                                )}
                                <Badge variant="outline" className="text-xs mt-1">
                                  {os.activities?.execution_type}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[os.status] || ''}>
                                {statusLabels[os.status] || os.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{os.profiles?.nome || '-'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono text-sm">
                                  {formatTime(os.total_time_seconds)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(os.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleViewOS(os)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3">
                    {filteredOrders.map((os) => (
                      <Card 
                        key={os.id} 
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleViewOS(os)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="font-mono font-bold">{os.code}</p>
                              <p className="text-sm text-muted-foreground">{os.activities?.name}</p>
                              {os.item_info?.unique_code && (
                                <Badge variant="secondary" className="font-mono text-xs mt-1">
                                  {os.item_info.unique_code}
                                </Badge>
                              )}
                              {os.item_info?.product_name && (
                                <p className="text-xs text-muted-foreground break-words whitespace-normal mt-2">
                                  {os.item_info.product_name}
                                </p>
                              )}
                            </div>
                            <Badge className={statusColors[os.status] || ''}>
                              {statusLabels[os.status] || os.status}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono">{formatTime(os.total_time_seconds)}</span>
                            </div>
                            <span className="text-muted-foreground">
                              {format(new Date(os.created_at), "dd/MM/yy", { locale: ptBR })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Nova OS Dialog */}
      <NovaOSDialog
        open={novaOSDialogOpen}
        onOpenChange={setNovaOSDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['work-orders'] });
        }}
      />

      {/* Detalhe OS Dialog */}
      {selectedOS && (
        <DetalheOSDialog
          open={detalheDialogOpen}
          onOpenChange={setDetalheDialogOpen}
          workOrder={selectedOS}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['work-orders'] });
          }}
        />
      )}
    </div>
  );
}
