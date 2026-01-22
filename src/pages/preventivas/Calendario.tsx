import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Calendar, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Generate 24 months starting from selected year
const generateMonthColumns = (startYear: number) => {
  const columns: Array<{ year: number; month: number; label: string }> = [];
  for (let y = startYear; y <= startYear + 1; y++) {
    for (let m = 0; m < 12; m++) {
      columns.push({
        year: y,
        month: m,
        label: `${MONTHS_SHORT[m]}/${String(y).slice(-2)}`,
      });
    }
  }
  return columns;
};

type MonthStatus = 'concluida' | 'planejada' | 'atrasada' | 'sem_preventiva';

interface PreventiveRecord {
  id: string;
  client_id: string;
  scheduled_date: string;
  completed_date: string | null;
  status: string;
  technician_user_id: string | null;
}

interface ClientData {
  id: string;
  nome: string;
  fazenda: string | null;
  estado: string | null;
  consultor_rplus_id: string | null;
}

interface MonthData {
  status: MonthStatus;
  preventives: Array<{
    id: string;
    scheduled_date: string;
    completed_date: string | null;
    status: string;
    technician_name: string | null;
  }>;
}

export default function CalendarioPreventivas() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [clientSearch, setClientSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [consultorFilter, setConsultorFilter] = useState<string>('all');
  const [tecnicoFilter, setTecnicoFilter] = useState<string>('all');

  // Fetch clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['calendar-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, estado, consultor_rplus_id')
        .eq('status', 'ativo')
        .order('nome');
      
      if (error) throw error;
      return data as ClientData[];
    },
  });

  // Generate month columns (24 months)
  const monthColumns = useMemo(() => generateMonthColumns(selectedYear), [selectedYear]);

  // Fetch preventive maintenance records for both years
  const { data: preventives, isLoading: preventivesLoading } = useQuery({
    queryKey: ['calendar-preventives', selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear + 1}-12-31`;
      
      const { data, error } = await supabase
        .from('preventive_maintenance')
        .select('id, client_id, scheduled_date, completed_date, status, technician_user_id')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);
      
      if (error) throw error;
      return data as PreventiveRecord[];
    },
  });

  // Fetch consultors
  const { data: consultors } = useQuery({
    queryKey: ['calendar-consultors'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, nome');
      return data || [];
    },
  });

  // Fetch field technicians
  const { data: technicians } = useQuery({
    queryKey: ['calendar-technicians'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'tecnico_campo');
      
      if (!roles?.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', roles.map(r => r.user_id));
      
      return profiles || [];
    },
  });

  // Build technician name map
  const technicianMap = useMemo(() => {
    const map = new Map<string, string>();
    consultors?.forEach(c => map.set(c.id, c.nome));
    technicians?.forEach(t => map.set(t.id, t.nome));
    return map;
  }, [consultors, technicians]);

  // Get unique estados
  const uniqueEstados = useMemo(() => {
    if (!clients) return [];
    const estados = [...new Set(clients.map(c => c.estado).filter(Boolean))] as string[];
    return estados.sort();
  }, [clients]);

  // Get unique consultors from clients
  const uniqueConsultors = useMemo(() => {
    if (!clients || !consultors) return [];
    const consultorIds = [...new Set(clients.map(c => c.consultor_rplus_id).filter(Boolean))];
    return consultors.filter(c => consultorIds.includes(c.id)).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clients, consultors]);

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    
    return clients.filter(client => {
      // Search filter
      if (clientSearch) {
        const searchWords = clientSearch.toLowerCase().split(' ').filter(Boolean);
        const searchText = `${client.nome} ${client.fazenda || ''} ${client.estado || ''}`.toLowerCase();
        if (!searchWords.every(word => searchText.includes(word))) {
          return false;
        }
      }
      
      // Estado filter
      if (estadoFilter !== 'all' && client.estado !== estadoFilter) {
        return false;
      }
      
      // Consultor filter
      if (consultorFilter !== 'all' && client.consultor_rplus_id !== consultorFilter) {
        return false;
      }
      
      return true;
    });
  }, [clients, clientSearch, estadoFilter, consultorFilter]);

  // Build calendar data: client -> "year-month" key -> status
  const calendarData = useMemo(() => {
    if (!filteredClients || !preventives) return new Map<string, Map<string, MonthData>>();
    
    const data = new Map<string, Map<string, MonthData>>();
    
    // Filter preventives by technician if filter is set
    const filteredPreventives = tecnicoFilter === 'all' 
      ? preventives 
      : preventives.filter(p => p.technician_user_id === tecnicoFilter);
    
    filteredClients.forEach(client => {
      const monthsMap = new Map<string, MonthData>();
      
      // Initialize all months in the range as sem_preventiva
      monthColumns.forEach(col => {
        const key = `${col.year}-${col.month}`;
        monthsMap.set(key, { status: 'sem_preventiva', preventives: [] });
      });
      
      // Process preventives for this client
      const clientPreventives = filteredPreventives.filter(p => p.client_id === client.id);
      
      clientPreventives.forEach(prev => {
        const scheduledDate = new Date(prev.scheduled_date);
        const year = scheduledDate.getFullYear();
        const month = scheduledDate.getMonth();
        const key = `${year}-${month}`;
        
        const monthData = monthsMap.get(key);
        if (!monthData) return; // Outside our range
        
        monthData.preventives.push({
          id: prev.id,
          scheduled_date: prev.scheduled_date,
          completed_date: prev.completed_date,
          status: prev.status,
          technician_name: prev.technician_user_id ? technicianMap.get(prev.technician_user_id) || null : null,
        });
        
        // Update status: concluida > atrasada > planejada > sem_preventiva
        if (prev.status === 'concluida') {
          monthData.status = 'concluida';
        } else if (prev.status === 'planejada' && monthData.status !== 'concluida') {
          // Check if it's overdue (scheduled_date is in the past)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const scheduledDate = new Date(prev.scheduled_date);
          scheduledDate.setHours(0, 0, 0, 0);
          
          if (scheduledDate < today) {
            monthData.status = 'atrasada';
          } else {
            monthData.status = 'planejada';
          }
        }
      });
      
      data.set(client.id, monthsMap);
    });
    
    return data;
  }, [filteredClients, preventives, tecnicoFilter, technicianMap, monthColumns]);

  // Get status color
  const getStatusColor = (status: MonthStatus) => {
    switch (status) {
      case 'concluida':
        return 'bg-green-500';
      case 'atrasada':
        return 'bg-red-500';
      case 'planejada':
        return 'bg-yellow-500';
      case 'sem_preventiva':
        return 'bg-muted-foreground/30';
    }
  };

  // Get status label
  const getStatusLabel = (status: MonthStatus) => {
    switch (status) {
      case 'concluida':
        return 'Concluída';
      case 'atrasada':
        return 'Atrasada';
      case 'planejada':
        return 'Planejada';
      case 'sem_preventiva':
        return 'Sem preventiva';
    }
  };

  const isLoading = clientsLoading || preventivesLoading;

  // Calculate summary stats - count FARMS not cells
  const summaryStats = useMemo(() => {
    let concluidas = 0;
    let atrasadas = 0;
    let planejadas = 0;
    let semPreventiva = 0;
    
    // Count unique farms with at least one of each status across all months
    calendarData.forEach(months => {
      let hasConcluida = false;
      let hasAtrasada = false;
      let hasPlanejada = false;
      let hasAny = false;
      
      months.forEach(monthData => {
        if (monthData.status !== 'sem_preventiva') hasAny = true;
        if (monthData.status === 'concluida') hasConcluida = true;
        if (monthData.status === 'atrasada') hasAtrasada = true;
        if (monthData.status === 'planejada') hasPlanejada = true;
      });
      
      if (hasConcluida) concluidas++;
      if (hasAtrasada) atrasadas++;
      if (hasPlanejada) planejadas++;
      if (!hasAny) semPreventiva++;
    });
    
    return { concluidas, atrasadas, planejadas, semPreventiva };
  }, [calendarData]);

  // Calculate totals per month
  const monthTotals = useMemo(() => {
    const totals = new Map<string, { concluidas: number; atrasadas: number; planejadas: number }>();
    
    monthColumns.forEach(col => {
      const key = `${col.year}-${col.month}`;
      totals.set(key, { concluidas: 0, atrasadas: 0, planejadas: 0 });
    });
    
    calendarData.forEach(months => {
      months.forEach((monthData, key) => {
        const total = totals.get(key);
        if (total) {
          if (monthData.status === 'concluida') total.concluidas++;
          else if (monthData.status === 'atrasada') total.atrasadas++;
          else if (monthData.status === 'planejada') total.planejadas++;
        }
      });
    });
    
    return totals;
  }, [calendarData, monthColumns]);

  // Calculate totals per year (shown in December column)
  const yearTotals = useMemo(() => {
    const totals = new Map<number, { concluidas: number; atrasadas: number; planejadas: number }>();
    
    [selectedYear, selectedYear + 1].forEach(year => {
      totals.set(year, { concluidas: 0, atrasadas: 0, planejadas: 0 });
    });
    
    calendarData.forEach(months => {
      months.forEach((monthData, key) => {
        const [yearStr] = key.split('-');
        const year = parseInt(yearStr);
        const total = totals.get(year);
        if (total) {
          if (monthData.status === 'concluida') total.concluidas++;
          else if (monthData.status === 'atrasada') total.atrasadas++;
          else if (monthData.status === 'planejada') total.planejadas++;
        }
      });
    });
    
    return totals;
  }, [calendarData, selectedYear]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Calendário Anual de Preventivas
        </h1>
        <p className="text-muted-foreground">
          Visão anual das manutenções preventivas por cliente
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {/* Year selector */}
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9"
                onClick={() => setSelectedYear(y => y - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center font-semibold text-sm whitespace-nowrap">
                {selectedYear}/{selectedYear + 1}
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9"
                onClick={() => setSelectedYear(y => y + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar fazenda..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            {/* Estado */}
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos UF</SelectItem>
                {uniqueEstados.map(estado => (
                  <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Consultor */}
            <Select value={consultorFilter} onValueChange={setConsultorFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Consultor R+" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Consultores</SelectItem>
                {uniqueConsultors.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Técnico */}
            <Select value={tecnicoFilter} onValueChange={setTecnicoFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Técnico Campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Técnicos</SelectItem>
                {technicians?.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Legend and Summary */}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm">Concluída</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm">Planejada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm">Atrasada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
            <span className="text-sm">Sem preventiva</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            {summaryStats.concluidas} concluídas
          </Badge>
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            {summaryStats.planejadas} planejadas
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
            {summaryStats.atrasadas} atrasadas
          </Badge>
          <Badge variant="outline" className="bg-muted">
            {summaryStats.semPreventiva} sem preventiva
          </Badge>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma fazenda encontrada com os filtros aplicados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-sm sticky left-0 bg-background z-10 w-[220px] min-w-[220px] max-w-[220px]">
                      Fazenda
                    </th>
                    {monthColumns.map((col, idx) => (
                      <th 
                        key={`${col.year}-${col.month}`} 
                        className={cn(
                          "text-center p-1 font-medium text-xs w-10 min-w-[40px]",
                          col.month === 0 && "border-l-2 border-primary/30"
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(client => {
                    const clientMonths = calendarData.get(client.id);
                    
                    return (
                      <tr key={client.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 sticky left-0 bg-background z-10 w-[220px] min-w-[220px] max-w-[220px]">
                          <div className="truncate" title={`${client.nome}${client.fazenda ? ` - ${client.fazenda}` : ''}`}>
                            <div className="font-medium text-sm truncate">{client.nome}</div>
                            {client.fazenda && (
                              <div className="text-xs text-muted-foreground truncate">{client.fazenda}</div>
                            )}
                          </div>
                        </td>
                        {monthColumns.map((col) => {
                          const key = `${col.year}-${col.month}`;
                          const monthData = clientMonths?.get(key);
                          const status = monthData?.status || 'sem_preventiva';
                          const preventivesList = monthData?.preventives || [];
                          
                          return (
                            <td 
                              key={key} 
                              className={cn(
                                "p-1 text-center",
                                col.month === 0 && "border-l-2 border-primary/30"
                              )}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button 
                                    className={cn(
                                      "w-3 h-3 rounded-full mx-auto transition-transform hover:scale-150",
                                      getStatusColor(status)
                                    )}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px]">
                                  <div className="space-y-1">
                                    <div className="font-medium">{getStatusLabel(status)}</div>
                                    <div className="text-xs text-muted-foreground">{MONTHS_SHORT[col.month]} {col.year}</div>
                                    {preventivesList.length > 0 ? (
                                      <div className="text-xs space-y-1">
                                        {preventivesList.map((p, i) => (
                                          <div key={i} className="border-t pt-1 mt-1 first:border-t-0 first:pt-0 first:mt-0">
                                            <div>
                                              Planejada: {format(new Date(p.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                                            </div>
                                            {p.completed_date && (
                                              <div className="text-green-600">
                                                Concluída: {format(new Date(p.completed_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                                              </div>
                                            )}
                                            {p.technician_name && (
                                              <div className="text-muted-foreground">
                                                Técnico: {p.technician_name}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-muted-foreground">
                                        Nenhuma preventiva agendada
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="border-t-2 bg-muted/50 font-medium">
                    <td className="p-2 sticky left-0 bg-muted/50 z-10 w-[220px] min-w-[220px] max-w-[220px] text-sm">
                      Total por Mês
                    </td>
                    {monthColumns.map((col) => {
                      const key = `${col.year}-${col.month}`;
                      const totals = monthTotals.get(key);
                      const monthTotal = (totals?.concluidas || 0) + (totals?.atrasadas || 0) + (totals?.planejadas || 0);
                      const yearTotal = col.month === 11 ? yearTotals.get(col.year) : null;
                      
                      return (
                        <td 
                          key={key} 
                          className={cn(
                            "p-1 text-center text-xs",
                            col.month === 0 && "border-l-2 border-primary/30",
                            col.month === 11 && "border-r-2 border-primary/30"
                          )}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-default">
                                {monthTotal > 0 ? monthTotal : '-'}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="space-y-1">
                                <div className="font-medium">{MONTHS_SHORT[col.month]} {col.year}</div>
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-green-500" />
                                  {totals?.concluidas || 0} concluídas
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                  {totals?.planejadas || 0} planejadas
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-red-500" />
                                  {totals?.atrasadas || 0} atrasadas
                                </div>
                                {yearTotal && (
                                  <div className="border-t pt-1 mt-1 font-medium">
                                    Total {col.year}: {(yearTotal.concluidas || 0) + (yearTotal.atrasadas || 0) + (yearTotal.planejadas || 0)}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground text-center">
          Exibindo {filteredClients.length} fazenda(s)
        </p>
      )}
    </div>
  );
}
