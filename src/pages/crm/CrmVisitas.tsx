import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Plus, Search, MapPin, Building2, ChevronRight,
  CalendarDays, Loader2, CheckCircle2, CalendarIcon,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  planejada: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  em_andamento: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cancelada: 'bg-muted text-muted-foreground',
};

export default function CrmVisitas() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = role === 'admin' || role === 'coordenador_rplus';

  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [objective, setObjective] = useState('');
  const [plannedDate, setPlannedDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // @ts-ignore - crm_visits not in types yet
  const { data: visitas, isLoading } = useQuery({
    queryKey: ['crm-visitas', user?.id, isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_visits')
        .select('*, clientes(nome, fazenda, cidade, estado)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const { data: clientes } = useQuery({
    queryKey: ['crm-visitas-clientes', user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado')
        .eq('status', 'ativo')
        .order('nome');
      if (!isAdmin && user?.id) {
        query = query.eq('consultor_rplus_id', user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user && sheetOpen,
  });

  // @ts-ignore
  const createVisit = useMutation({
    mutationFn: async (data: { client_id: string; objective: string; planned_start_at?: string }) => {
      const { error } = await supabase.from('crm_visits').insert({
        client_id: data.client_id,
        owner_user_id: user!.id,
        objective: data.objective || null,
        planned_start_at: data.planned_start_at || null,
        status: 'planejada',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-visitas'] });
      handleCloseSheet();
      toast({ title: 'Visita criada com sucesso!' });
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    },
  });

  const handleCloseSheet = () => {
    setSheetOpen(false);
    setSelectedCliente(null);
    setObjective('');
    setPlannedDate(undefined);
    setClienteSearch('');
  };

  const handleSubmitVisit = () => {
    if (!selectedCliente) return;
    createVisit.mutate({
      client_id: selectedCliente.id,
      objective,
      planned_start_at: plannedDate ? plannedDate.toISOString() : undefined,
    });
  };

  const filteredClientes = useMemo(() => {
    if (!clientes) return [];
    if (!clienteSearch.trim()) return clientes;
    const s = clienteSearch.toLowerCase();
    return clientes.filter((c: any) =>
      c.nome?.toLowerCase().includes(s) ||
      c.fazenda?.toLowerCase().includes(s) ||
      c.cidade?.toLowerCase().includes(s)
    );
  }, [clientes, clienteSearch]);

  const filteredVisitas = useMemo(() => {
    if (!visitas) return [];
    let result = visitas;
    if (statusFilter !== 'all') {
      result = result.filter(v => v.status === statusFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(v =>
        v.clientes?.nome?.toLowerCase().includes(s) ||
        v.clientes?.fazenda?.toLowerCase().includes(s) ||
        v.objective?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [visitas, statusFilter, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredVisitas.forEach(v => {
      const date = new Date(v.created_at);
      let key: string;
      if (isToday(date)) key = 'Hoje';
      else if (isYesterday(date)) key = 'Ontem';
      else key = format(date, "dd 'de' MMMM", { locale: ptBR });
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    });
    return groups;
  }, [filteredVisitas]);

  const counts = useMemo(() => {
    if (!visitas) return { planejada: 0, em_andamento: 0, concluida: 0 };
    return {
      planejada: visitas.filter(v => v.status === 'planejada').length,
      em_andamento: visitas.filter(v => v.status === 'em_andamento').length,
      concluida: visitas.filter(v => v.status === 'concluida').length,
    };
  }, [visitas]);

  return (
    <div className="space-y-3 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Visitas CRM</h1>
        <p className="text-xs text-muted-foreground">Visitas a clientes da carteira</p>
      </div>

      {/* Status counts - compact on mobile */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { key: 'planejada', label: 'Planejadas', count: counts.planejada, color: 'text-blue-600' },
          { key: 'em_andamento', label: 'Andamento', count: counts.em_andamento, color: 'text-amber-600' },
          { key: 'concluida', label: 'Concluídas', count: counts.concluida, color: 'text-green-600' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
            className={cn(
              "rounded-lg border py-2 px-1 text-center transition-colors",
              statusFilter === s.key ? 'border-primary bg-primary/5' : 'border-border'
            )}
          >
            <span className={cn("text-lg font-bold block", s.color)}>{s.count}</span>
            <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar visita..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-9 text-sm" />
      </div>

      {/* Active filter indicator */}
      {statusFilter !== 'all' && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Filtro: <span className="font-medium">{STATUS_LABELS[statusFilter]}</span>
          </span>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setStatusFilter('all')}>
            Limpar
          </Button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filteredVisitas.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 font-semibold text-sm">Nenhuma visita encontrada</h3>
          <p className="text-xs text-muted-foreground">Toque em + para criar uma visita</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 sticky top-0 bg-background py-1 z-10">
                {dateLabel}
              </h3>
              <div className="space-y-1.5">
                {items.map((v: any) => (
                  <Card
                    key={v.id}
                    className="overflow-hidden cursor-pointer hover:border-primary/30 active:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/crm/visitas/${v.id}`)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2.5">
                        {/* Date badge */}
                        <div className="shrink-0 w-11 text-center bg-muted rounded-md py-1">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase block leading-tight">
                            {format(new Date(v.planned_start_at || v.created_at), 'MMM', { locale: ptBR })}
                          </span>
                          <span className="text-lg font-bold leading-tight block">
                            {format(new Date(v.planned_start_at || v.created_at), 'dd')}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-sm truncate max-w-[60%]">{v.clientes?.nome}</p>
                            <Badge className={cn("text-[10px] shrink-0 px-1.5 py-0", STATUS_COLORS[v.status])}>
                              {STATUS_LABELS[v.status]}
                            </Badge>
                            {v.checkin_at && <MapPin className="h-3 w-3 text-green-600 shrink-0" />}
                          </div>
                          {v.clientes?.fazenda && (
                            <p className="text-xs text-muted-foreground truncate">{v.clientes.fazenda}</p>
                          )}
                          {v.objective && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{v.objective}</p>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <Button
        size="lg"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50 md:bottom-6"
        onClick={() => setSheetOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* New Visit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={open => !open && handleCloseSheet()}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
          <SheetHeader className="text-left pb-3">
            <SheetTitle className="text-base">{selectedCliente ? 'Nova Visita' : 'Selecionar Cliente'}</SheetTitle>
          </SheetHeader>

          {!selectedCliente ? (
            <div className="space-y-3 h-full flex flex-col">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente..." value={clienteSearch} onChange={e => setClienteSearch(e.target.value)} className="pl-10 h-9 text-sm" autoFocus />
              </div>
              <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-0.5">
                {filteredClientes.map((c: any) => (
                  <button key={c.id} onClick={() => setSelectedCliente(c)}
                    className="w-full p-2.5 rounded-lg text-left hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.nome}</p>
                      {c.fazenda && <p className="text-xs text-muted-foreground truncate">{c.fazenda}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
                {filteredClientes.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">Nenhum cliente encontrado</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{selectedCliente.nome}</p>
                    {selectedCliente.fazenda && <p className="text-xs text-muted-foreground truncate">{selectedCliente.fazenda}</p>}
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedCliente(null)}>Trocar</Button>
                </CardContent>
              </Card>

              <div className="space-y-1.5">
                <Label className="text-sm">Data planejada (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9 text-sm",
                        !plannedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {plannedDate ? format(plannedDate, "dd/MM/yyyy") : 'Hoje (padrão)'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={plannedDate}
                      onSelect={setPlannedDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Objetivo da visita (opcional)</Label>
                <Textarea placeholder="Ex: Qualificação de produto..." value={objective} onChange={e => setObjective(e.target.value)} rows={3} className="resize-none text-sm" />
              </div>

              <Button size="lg" className="w-full" onClick={handleSubmitVisit} disabled={createVisit.isPending}>
                {createVisit.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                Criar Visita
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
