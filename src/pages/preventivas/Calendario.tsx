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

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type MonthStatus = 'concluida' | 'planejada' | 'sem_preventiva';

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

  // Fetch preventive maintenance records for the year
  const { data: preventives, isLoading: preventivesLoading } = useQuery({
    queryKey: ['calendar-preventives', selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
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

  // Build calendar data: client -> month -> status
  const calendarData = useMemo(() => {
    if (!filteredClients || !preventives) return new Map<string, Map<number, MonthData>>();
    
    const data = new Map<string, Map<number, MonthData>>();
    
    // Filter preventives by technician if filter is set
    const filteredPreventives = tecnicoFilter === 'all' 
      ? preventives 
      : preventives.filter(p => p.technician_user_id === tecnicoFilter);
    
    filteredClients.forEach(client => {
      const monthsMap = new Map<number, MonthData>();
      
      // Initialize all months as sem_preventiva
      for (let month = 0; month < 12; month++) {
        monthsMap.set(month, { status: 'sem_preventiva', preventives: [] });
      }
      
      // Process preventives for this client
      const clientPreventives = filteredPreventives.filter(p => p.client_id === client.id);
      
      clientPreventives.forEach(prev => {
        const scheduledDate = new Date(prev.scheduled_date);
        const month = scheduledDate.getMonth();
        
        const monthData = monthsMap.get(month)!;
        monthData.preventives.push({
          id: prev.id,
          scheduled_date: prev.scheduled_date,
          completed_date: prev.completed_date,
          status: prev.status,
          technician_name: prev.technician_user_id ? technicianMap.get(prev.technician_user_id) || null : null,
        });
        
        // Update status: concluida > planejada > sem_preventiva
        if (prev.status === 'concluida') {
          monthData.status = 'concluida';
        } else if (prev.status === 'planejada' && monthData.status !== 'concluida') {
          monthData.status = 'planejada';
        }
      });
      
      data.set(client.id, monthsMap);
    });
    
    return data;
  }, [filteredClients, preventives, tecnicoFilter, technicianMap]);

  // Get status color
  const getStatusColor = (status: MonthStatus) => {
    switch (status) {
      case 'concluida':
        return 'bg-green-500';
      case 'planejada':
        return 'bg-destructive';
      case 'sem_preventiva':
        return 'bg-muted-foreground/30';
    }
  };

  // Get status label
  const getStatusLabel = (status: MonthStatus) => {
    switch (status) {
      case 'concluida':
        return 'Concluída';
      case 'planejada':
        return 'Planejada (não concluída)';
      case 'sem_preventiva':
        return 'Sem preventiva';
    }
  };

  const isLoading = clientsLoading || preventivesLoading;

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    let concluidas = 0;
    let planejadas = 0;
    let semPreventiva = 0;
    
    calendarData.forEach(months => {
      months.forEach(monthData => {
        if (monthData.status === 'concluida') concluidas++;
        else if (monthData.status === 'planejada') planejadas++;
        else semPreventiva++;
      });
    });
    
    return { concluidas, planejadas, semPreventiva };
  }, [calendarData]);

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
              <div className="flex-1 text-center font-semibold text-lg">
                {selectedYear}
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
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-sm">Planejada</span>
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
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            {summaryStats.planejadas} planejadas
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
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-sm sticky left-0 bg-background z-10 min-w-[200px]">
                      Fazenda
                    </th>
                    {MONTHS.map((month, idx) => (
                      <th key={month} className="text-center p-2 font-medium text-xs w-12">
                        {month}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(client => {
                    const clientMonths = calendarData.get(client.id);
                    
                    return (
                      <tr key={client.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 sticky left-0 bg-background z-10">
                          <div className="min-w-[180px]">
                            <div className="font-medium text-sm truncate">{client.nome}</div>
                            {client.fazenda && (
                              <div className="text-xs text-muted-foreground truncate">{client.fazenda}</div>
                            )}
                          </div>
                        </td>
                        {MONTHS.map((_, monthIdx) => {
                          const monthData = clientMonths?.get(monthIdx);
                          const status = monthData?.status || 'sem_preventiva';
                          const preventivesList = monthData?.preventives || [];
                          
                          return (
                            <td key={monthIdx} className="p-2 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button 
                                    className={cn(
                                      "w-4 h-4 rounded-full mx-auto transition-transform hover:scale-125",
                                      getStatusColor(status)
                                    )}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px]">
                                  <div className="space-y-1">
                                    <div className="font-medium">{getStatusLabel(status)}</div>
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
