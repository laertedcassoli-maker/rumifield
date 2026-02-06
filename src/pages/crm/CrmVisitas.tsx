import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Plus, Search, MapPin, Clock, Building2, ChevronRight,
  CalendarDays, Loader2, CheckCircle2, Eye,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

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
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch visits
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

  // Fetch clients for new visit
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
    mutationFn: async (data: { client_id: string; objective: string }) => {
      const { error } = await supabase.from('crm_visits').insert({
        client_id: data.client_id,
        owner_user_id: user!.id,
        objective: data.objective || null,
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
    setClienteSearch('');
  };

  const handleSubmitVisit = () => {
    if (!selectedCliente) return;
    createVisit.mutate({ client_id: selectedCliente.id, objective });
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

  // Group by date
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

  // Counts
  const counts = useMemo(() => {
    if (!visitas) return { planejada: 0, em_andamento: 0, concluida: 0 };
    return {
      planejada: visitas.filter(v => v.status === 'planejada').length,
      em_andamento: visitas.filter(v => v.status === 'em_andamento').length,
      concluida: visitas.filter(v => v.status === 'concluida').length,
    };
  }, [visitas]);

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold">Visitas CRM</h1>
        <p className="text-sm text-muted-foreground">Visitas a clientes da carteira</p>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'planejada', label: 'Planejadas', count: counts.planejada, color: 'text-blue-600' },
          { key: 'em_andamento', label: 'Em andamento', count: counts.em_andamento, color: 'text-amber-600' },
          { key: 'concluida', label: 'Concluídas', count: counts.concluida, color: 'text-green-600' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
            className={`rounded-lg border p-3 text-center transition-colors ${statusFilter === s.key ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <span className={`text-lg font-bold ${s.color}`}>{s.count}</span>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar visita..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filteredVisitas.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-semibold">Nenhuma visita encontrada</h3>
          <p className="text-sm text-muted-foreground">Toque em + para criar uma visita</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">{dateLabel}</h3>
              <div className="space-y-2">
                {items.map((v: any) => (
                  <Card key={v.id} className="overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => navigate(`/crm/visitas/${v.id}`)}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-12 text-center">
                          <span className="text-lg font-semibold">{format(new Date(v.created_at), 'HH:mm')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{v.clientes?.nome}</p>
                            <Badge className={`text-[10px] shrink-0 ${STATUS_COLORS[v.status]}`}>
                              {STATUS_LABELS[v.status]}
                            </Badge>
                          </div>
                          {v.clientes?.fazenda && (
                            <p className="text-sm text-muted-foreground truncate">{v.clientes.fazenda}</p>
                          )}
                          {v.objective && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{v.objective}</p>
                          )}
                        </div>
                        {v.checkin_at && <MapPin className="h-4 w-4 text-green-600 shrink-0" />}
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
          <SheetHeader className="text-left pb-4">
            <SheetTitle>{selectedCliente ? 'Nova Visita' : 'Selecionar Cliente'}</SheetTitle>
          </SheetHeader>

          {!selectedCliente ? (
            <div className="space-y-4 h-full flex flex-col">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente..." value={clienteSearch} onChange={e => setClienteSearch(e.target.value)} className="pl-10" autoFocus />
              </div>
              <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1">
                {filteredClientes.map((c: any) => (
                  <button key={c.id} onClick={() => setSelectedCliente(c)}
                    className="w-full p-3 rounded-lg text-left hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.nome}</p>
                      {c.fazenda && <p className="text-sm text-muted-foreground truncate">{c.fazenda}</p>}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </button>
                ))}
                {filteredClientes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{selectedCliente.nome}</p>
                    {selectedCliente.fazenda && <p className="text-sm text-muted-foreground">{selectedCliente.fazenda}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCliente(null)}>Trocar</Button>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Objetivo da visita (opcional)</Label>
                <Textarea placeholder="Ex: Qualificação de produto, revisão de contrato..." value={objective} onChange={e => setObjective(e.target.value)} rows={3} className="resize-none" />
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
