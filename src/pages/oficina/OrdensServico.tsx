import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Search, Eye, Play, Pause, CheckCircle, Clock, Package, LayoutGrid, List, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NovaOSDialog } from '@/components/oficina/NovaOSDialog';
import { DetalheOSDialog } from '@/components/oficina/DetalheOSDialog';
import { OSKanban } from '@/components/oficina/OSKanban';

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
  concluded_by_user_id: string | null;
  created_at: string;
  activities?: {
    id: string;
    name: string;
    execution_type: string;
    has_motor?: boolean;
  };
  profiles?: {
    nome: string;
  };
  created_by_profile?: { nome: string } | null;
  concluded_by_profile?: { nome: string } | null;
  item_info?: {
    unique_code?: string;
    product_name?: string;
    meter_hours_last?: number;
    motor_replaced_at_meter_hours?: number;
  };
  parts_count?: number;
  parts_used_names?: string[];
  work_order_tag_links?: Array<{
    tag_id: string;
    ticket_tags: { id: string; name: string; color: string };
  }>;
}

function DateFilterButton({ label, date, onChange }: { label: string; date?: Date; onChange: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-9 px-3 text-sm font-normal", !date && "text-muted-foreground")}>
          {date ? format(date, 'dd/MM/yyyy') : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <Calendar mode="single" selected={date} onSelect={onChange} initialFocus />
      </PopoverContent>
    </Popover>
  );
}

export default function OrdensServico() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('kanban');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [novaOSDialogOpen, setNovaOSDialogOpen] = useState(false);
  const [selectedOS, setSelectedOS] = useState<WorkOrder | null>(null);
  const [detalheDialogOpen, setDetalheDialogOpen] = useState(false);
  const [createdFrom, setCreatedFrom] = useState<Date | undefined>(undefined);
  const [createdTo, setCreatedTo] = useState<Date | undefined>(undefined);
  const [endTimeFrom, setEndTimeFrom] = useState<Date | undefined>(undefined);
  const [endTimeTo, setEndTimeTo] = useState<Date | undefined>(undefined);
  const [selectedPart, setSelectedPart] = useState<string>('_all');
  const [selectedActivity, setSelectedActivity] = useState<string>('_all');


  const isAdmin = role === 'admin' || role === 'coordenador_rplus' || role === 'coordenador_servicos';


  // Fetch work orders
  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['work-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          activities:activity_id (id, name, execution_type, has_motor),
          work_order_tag_links(tag_id, ticket_tags(id, name, color))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Fetch profiles separately for assigned/created/concluded users
      const userIds = Array.from(new Set(
        (data || []).flatMap(wo => [wo.assigned_to_user_id, wo.created_by_user_id, wo.concluded_by_user_id]).filter(Boolean)
      )) as string[];
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
      let itemsMap: Record<string, { unique_code?: string; product_name?: string; meter_hours_last?: number; motor_replaced_at_meter_hours?: number }> = {};
      let partsCountMap: Record<string, number> = {};
      let workOrderPartsNamesMap: Record<string, string[]> = {};

      if (workOrderIds.length > 0) {
        const { data: items } = await supabase
          .from('work_order_items')
          .select(`
            work_order_id,
            workshop_item_id,
            omie_product_id
          `)
          .in('work_order_id', workOrderIds);

        // Fetch parts used count and product IDs
        const { data: partsUsed } = await supabase
          .from('work_order_parts_used')
          .select('work_order_id, quantity, omie_product_id')
          .in('work_order_id', workOrderIds);

        if (partsUsed) {
          partsUsed.forEach(part => {
            partsCountMap[part.work_order_id] = (partsCountMap[part.work_order_id] || 0) + part.quantity;
          });
        }

        // Gather all product IDs upfront (from items, workshop items, and parts used)
        const allProductIds: string[] = [];
        if (items) {
          items.forEach(i => { if (i.omie_product_id) allProductIds.push(i.omie_product_id); });
        }
        if (partsUsed) {
          partsUsed.forEach(p => { if (p.omie_product_id) allProductIds.push(p.omie_product_id); });
        }

        let workshopItemsMap: Record<string, { unique_code: string; omie_product_id: string; meter_hours_last: number | null; motor_replaced_at_meter_hours: number | null }> = {};
        let productsMap: Record<string, string> = {};

        if (items && items.length > 0) {
          const workshopItemIds = items.map(i => i.workshop_item_id).filter(Boolean);

          if (workshopItemIds.length > 0) {
            const { data: workshopItems } = await supabase
              .from('workshop_items')
              .select('id, unique_code, omie_product_id, meter_hours_last, motor_replaced_at_meter_hours')
              .in('id', workshopItemIds);
            workshopItemsMap = (workshopItems || []).reduce((acc, wi) => ({
              ...acc,
              [wi.id]: { 
                unique_code: wi.unique_code, 
                omie_product_id: wi.omie_product_id,
                meter_hours_last: wi.meter_hours_last,
                motor_replaced_at_meter_hours: wi.motor_replaced_at_meter_hours
              }
            }), {});

            // Add product IDs from workshop items
            workshopItems?.forEach(wi => {
              if (wi.omie_product_id && !allProductIds.includes(wi.omie_product_id)) {
                allProductIds.push(wi.omie_product_id);
              }
            });
          }
        }

        // Deduplicate and fetch all products at once
        const uniqueProductIds = [...new Set(allProductIds)];
        if (uniqueProductIds.length > 0) {
          const { data: products } = await supabase
            .from('pecas')
            .select('id, nome')
            .in('id', uniqueProductIds);
          productsMap = (products || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome }), {});
        }

        // Map items to work orders
        if (items && items.length > 0) {
          items.forEach(item => {
            const workshopItem = item.workshop_item_id ? workshopItemsMap[item.workshop_item_id] : null;
            const productId = workshopItem?.omie_product_id || item.omie_product_id;
            
            itemsMap[item.work_order_id] = {
              unique_code: workshopItem?.unique_code,
              product_name: productId ? productsMap[productId] : undefined,
              meter_hours_last: workshopItem?.meter_hours_last ?? undefined,
              motor_replaced_at_meter_hours: workshopItem?.motor_replaced_at_meter_hours ?? undefined
            };
          });
        }

        // Map part names to work orders
        if (partsUsed) {
          partsUsed.forEach(part => {
            const name = part.omie_product_id ? productsMap[part.omie_product_id] : null;
            if (name) {
              if (!workOrderPartsNamesMap[part.work_order_id]) {
                workOrderPartsNamesMap[part.work_order_id] = [];
              }
              workOrderPartsNamesMap[part.work_order_id].push(name);
            }
          });
        }
      }
      
      return (data || []).map(wo => ({
        ...wo,
        profiles: wo.assigned_to_user_id ? { nome: profilesMap[wo.assigned_to_user_id] || '-' } : undefined,
        created_by_profile: wo.created_by_user_id ? { nome: profilesMap[wo.created_by_user_id] || '-' } : null,
        concluded_by_profile: wo.concluded_by_user_id ? { nome: profilesMap[wo.concluded_by_user_id] || '-' } : null,
        item_info: itemsMap[wo.id],
        parts_count: partsCountMap[wo.id] || 0,
        parts_used_names: workOrderPartsNamesMap[wo.id] || [],
      })) as WorkOrder[];
    },
  });

  // Manter selectedOS sincronizado com dados frescos do servidor
  useEffect(() => {
    if (selectedOS && workOrders.length > 0) {
      const updated = workOrders.find(wo => wo.id === selectedOS.id);
      if (updated) {
        setSelectedOS(updated);
      }
    }
  }, [workOrders]);
  const filteredOrders = workOrders.filter(wo => {
    const matchesSearch = wo.code.toLowerCase().includes(search.toLowerCase()) ||
      wo.activities?.name?.toLowerCase().includes(search.toLowerCase()) ||
      wo.item_info?.unique_code?.toLowerCase().includes(search.toLowerCase()) ||
      wo.item_info?.product_name?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    // Filter by creation date
    if (createdFrom) {
      const fromDate = new Date(createdFrom);
      fromDate.setHours(0, 0, 0, 0);
      const woDate = new Date(wo.created_at);
      woDate.setHours(0, 0, 0, 0);
      if (woDate < fromDate) return false;
    }
    if (createdTo) {
      const toDate = new Date(createdTo);
      toDate.setHours(23, 59, 59, 999);
      const woDate = new Date(wo.created_at);
      if (woDate > toDate) return false;
    }

    // Filter by end time (kanban and concluidas tabs)
    if (activeTab === 'kanban' || activeTab === 'concluidas') {
      if (endTimeFrom) {
        if (!wo.end_time) return false;
        const fromDate = new Date(endTimeFrom);
        fromDate.setHours(0, 0, 0, 0);
        const endDate = new Date(wo.end_time);
        endDate.setHours(0, 0, 0, 0);
        if (endDate < fromDate) return false;
      }
      if (endTimeTo) {
        if (!wo.end_time) return false;
        const toDate = new Date(endTimeTo);
        toDate.setHours(23, 59, 59, 999);
        const endDate = new Date(wo.end_time);
        if (endDate > toDate) return false;
      }
    }

    // Filter by used part
    if (selectedPart !== '_all') {
      if (!wo.parts_used_names?.includes(selectedPart)) return false;
    }

    // Filter by activity
    if (selectedActivity !== '_all') {
      if (wo.activities?.name !== selectedActivity) return false;
    }

    if (activeTab === 'kanban') {
      return true;
    } else if (activeTab === 'abertas') {
      return wo.status !== 'concluido';
    } else if (activeTab === 'concluidas') {
      return wo.status === 'concluido';
    }
    return true;
  }).sort((a, b) => {
    if (activeTab === 'concluidas') {
      const aT = a.end_time ? new Date(a.end_time).getTime() : 0;
      const bT = b.end_time ? new Date(b.end_time).getTime() : 0;
      return bT - aT;
    }
    return 0;
  });

  const availableParts = useMemo(() => {
    const parts = new Set<string>();
    workOrders.forEach(wo => {
      wo.parts_used_names?.forEach(name => parts.add(name));
    });
    return Array.from(parts).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [workOrders]);

  const availableActivities = useMemo(() => {
    const activities = new Set<string>();
    workOrders.forEach(wo => {
      if (wo.activities?.name) activities.add(wo.activities.name);
    });
    return Array.from(activities).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [workOrders]);

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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="kanban">
              <LayoutGrid className="h-4 w-4 mr-1" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="abertas">
              Abertas ({workOrders.filter(wo => wo.status !== 'concluido').length})
            </TabsTrigger>
            <TabsTrigger value="concluidas">
              Concluídas ({workOrders.filter(wo => wo.status === 'concluido').length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar OS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-[200px]"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Criação:</span>
          <DateFilterButton label="De" date={createdFrom} onChange={setCreatedFrom} />
          <DateFilterButton label="Até" date={createdTo} onChange={setCreatedTo} />
        </div>

        {(activeTab === 'kanban' || activeTab === 'concluidas') && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Finalizado:</span>
            <DateFilterButton label="De" date={endTimeFrom} onChange={setEndTimeFrom} />
            <DateFilterButton label="Até" date={endTimeTo} onChange={setEndTimeTo} />
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Atividade:</span>
          <Select value={selectedActivity} onValueChange={setSelectedActivity}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas</SelectItem>
              {availableActivities.map(activity => (
                <SelectItem key={activity} value={activity}>{activity}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Peça utilizada:</span>
          <Select value={selectedPart} onValueChange={setSelectedPart}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas</SelectItem>
              {availableParts.map(part => (
                <SelectItem key={part} value={part}>{part}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(createdFrom || createdTo || endTimeFrom || endTimeTo || selectedPart !== '_all' || selectedActivity !== '_all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCreatedFrom(undefined);
              setCreatedTo(undefined);
              setEndTimeFrom(undefined);
              setEndTimeTo(undefined);
              setSelectedPart('_all');
              setSelectedActivity('_all');
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : activeTab === 'kanban' ? (
        <OSKanban workOrders={filteredOrders} onViewOS={handleViewOS} />
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma OS encontrada
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aberto por</TableHead>
                    {activeTab === 'concluidas' && <TableHead>Concluído por</TableHead>}
                    <TableHead>Tempo</TableHead>
                    <TableHead>Data</TableHead>
                    {activeTab === 'concluidas' && <TableHead>Finalizado</TableHead>}
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
                          {os.work_order_tag_links && os.work_order_tag_links.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {os.work_order_tag_links.map(link => (
                                <Badge
                                  key={link.tag_id}
                                  variant="outline"
                                  className="text-xs py-0"
                                  style={{ borderColor: link.ticket_tags.color, color: link.ticket_tags.color }}
                                >
                                  {link.ticket_tags.name}
                                </Badge>
                              ))}
                            </div>
                          )}
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
                          {/* Motor hours since last replacement */}
                          {os.item_info?.motor_replaced_at_meter_hours != null && os.item_info?.meter_hours_last != null && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-1">
                              <Wrench className="h-3 w-3" />
                              <span>Motor: {(os.item_info.meter_hours_last - os.item_info.motor_replaced_at_meter_hours).toFixed(0)}h</span>
                            </div>
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
                      <TableCell>{os.created_by_profile?.nome || '-'}</TableCell>
                      {activeTab === 'concluidas' && (
                        <TableCell>{os.concluded_by_profile?.nome || '-'}</TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-sm">
                              {formatTime(os.total_time_seconds)}
                            </span>
                          </div>
                          {(os.parts_count ?? 0) > 0 && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Package className="h-3 w-3" />
                              <span className="text-sm font-medium">{os.parts_count}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(os.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      {activeTab === 'concluidas' && (
                        <TableCell>
                          {os.end_time ? format(new Date(os.end_time), "dd/MM/yy HH:mm", { locale: ptBR }) : '-'}
                        </TableCell>
                      )}
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
                        {os.work_order_tag_links && os.work_order_tag_links.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {os.work_order_tag_links.map(link => (
                              <Badge
                                key={link.tag_id}
                                variant="outline"
                                className="text-xs py-0"
                                style={{ borderColor: link.ticket_tags.color, color: link.ticket_tags.color }}
                              >
                                {link.ticket_tags.name}
                              </Badge>
                            ))}
                          </div>
                        )}
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
                        {/* Motor hours since last replacement */}
                        {os.item_info?.motor_replaced_at_meter_hours != null && os.item_info?.meter_hours_last != null && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-1">
                            <Wrench className="h-3 w-3" />
                            <span>Motor: {(os.item_info.meter_hours_last - os.item_info.motor_replaced_at_meter_hours).toFixed(0)}h</span>
                          </div>
                        )}
                      </div>
                      <Badge className={statusColors[os.status] || ''}>
                        {statusLabels[os.status] || os.status}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Aberto por: {os.created_by_profile?.nome || '-'}
                    </div>
                    {os.status === 'concluido' && os.concluded_by_profile?.nome && (
                      <div className="text-xs text-muted-foreground">
                        Concluído por: {os.concluded_by_profile.nome}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{formatTime(os.total_time_seconds)}</span>
                        </div>
                        {(os.parts_count ?? 0) > 0 && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Package className="h-3 w-3" />
                            <span className="font-medium">{os.parts_count}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        {format(new Date(os.created_at), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    </div>
                    {activeTab === 'concluidas' && os.end_time && (
                      <div className="mt-1 flex justify-end text-sm text-muted-foreground">
                        <span>Finalizado: {format(new Date(os.end_time), "dd/MM/yy", { locale: ptBR })}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
