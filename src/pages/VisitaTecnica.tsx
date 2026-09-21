import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import NovaVisitaTecnicaDialog from '@/components/chamados/NovaVisitaTecnicaDialog';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Map as MapIcon,
  Plus,
  Search,
  User,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

type TipoVisita = 'corretiva' | 'preventiva';
type OwnerFilter = 'minhas' | 'todas';
type SituacaoFilter = 'pendentes' | 'concluidas' | 'todas';

interface VisitaItem {
  id: string;
  tipo: TipoVisita;
  codigo: string;
  clienteId: string | null;
  clienteNome: string;
  fazenda: string | null;
  tecnicoUserId: string | null;
  tecnicoNome: string | null;
  clienteLat: number | null;
  clienteLon: number | null;
  dataPlanejada: string | null;
  dataRealizada: string | null;
  status: string;
  linkTo: string;
}

const CONCLUIDO_STATUS = ['finalizada', 'executado'];
const DEFAULT_ORIGIN = { lat: -22.7249, lon: -47.6476, name: 'Piracicaba/SP' };


const STATUS_LABELS: Record<string, string> = {
  em_elaboracao: 'Em elaboração',
  planejada: 'Planejada',
  em_execucao: 'Em execução',
  finalizada: 'Finalizada',
  planejado: 'Planejado',
  executado: 'Executado',
  reagendado: 'Reagendado',
  cancelado: 'Cancelado',
};

const ITEMS_PER_PAGE = 15;

function statusBadgeClass(status: string) {
  if (status === 'finalizada' || status === 'executado') {
    return 'bg-green-500/10 text-green-600 border-green-500/20';
  }
  if (status === 'em_execucao') return 'bg-warning/10 text-warning border-warning/20';
  if (status === 'planejada' || status === 'planejado') {
    return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  }
  return '';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function fetchProfilesMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.from('profiles').select('id, nome').in('id', unique);
  return new Map<string, string>((data ?? []).map(p => [p.id as string, p.nome as string]));
}

interface ClienteInfo {
  nome: string;
  fazenda: string | null;
  latitude: number | null;
  longitude: number | null;
}

async function fetchClientesMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, ClienteInfo>();
  const { data } = await supabase
    .from('clientes')
    .select('id, nome, fazenda, latitude, longitude')
    .in('id', unique);
  return new Map<string, ClienteInfo>(
    (data ?? []).map(c => [
      c.id,
      {
        nome: c.nome,
        fazenda: c.fazenda ?? null,
        latitude: c.latitude ?? null,
        longitude: c.longitude ?? null,
      },
    ]),
  );
}


/**
 * Visita Técnica — leitura/navegação das idas presenciais à fazenda:
 * visitas corretivas (ticket_visits) e preventivas (preventive_route_items).
 * Mesmas fontes e enriquecimento da Agenda de Operações; nenhuma mutação.
 */
export default function VisitaTecnica() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const canAbrirVisita = role === 'admin' || role === 'coordenador_servicos' || role === 'coordenador_rplus';
  const isTecnico = role === 'tecnico_campo' || role === 'tecnico_oficina';
  const podeFiltrarPorTecnico = canAbrirVisita;
  const [novaVisitaOpen, setNovaVisitaOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<'all' | TipoVisita>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>(() =>
    searchParams.get('meu') === '1' || isTecnico ? 'minhas' : 'todas',
  );
  const [tecnicoFilter, setTecnicoFilter] = useState('all');
  const [situacaoFilter, setSituacaoFilter] = useState<SituacaoFilter>(() =>
    searchParams.get('status') === 'pendente' ? 'pendentes' : 'todas',
  );

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-cidade-base', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('cidade_base, cidade_base_lat, cidade_base_lon')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const userOrigin = userProfile?.cidade_base_lat && userProfile?.cidade_base_lon
    ? { lat: userProfile.cidade_base_lat, lon: userProfile.cidade_base_lon, name: userProfile.cidade_base || 'Minha cidade' }
    : userProfile?.cidade_base
      ? { ...DEFAULT_ORIGIN, name: userProfile.cidade_base }
      : DEFAULT_ORIGIN;

  const buildSingleDestinationUrl = (lat: number, lon: number) =>
    `https://www.google.com/maps/dir/${userOrigin.lat},${userOrigin.lon}/${lat},${lon}`;


  const { data: visitas, isLoading, error } = useQuery({
    queryKey: ['visita-tecnica'],
    queryFn: async (): Promise<VisitaItem[]> => {
      const [corretivasRes, preventivasRes] = await Promise.all([
        supabase
          .from('ticket_visits')
          .select(
            'id, visit_code, status, planned_start_date, checkout_at, ticket_id, client_id, field_technician_user_id, technical_tickets(ticket_code)'
          )
          .neq('status', 'cancelada'),
        supabase
          .from('preventive_route_items')
          .select(
            'id, route_id, status, planned_date, checkin_at, client_id, preventive_routes(route_code, field_technician_user_id)'
          )
          .neq('status', 'cancelado'),
      ]);

      if (corretivasRes.error) throw corretivasRes.error;
      if (preventivasRes.error) throw preventivasRes.error;

      const corretivasRows = corretivasRes.data ?? [];
      const preventivasRows = preventivasRes.data ?? [];

      const profiles = await fetchProfilesMap([
        ...corretivasRows.map(r => r.field_technician_user_id).filter(Boolean) as string[],
        ...(preventivasRows.map(r => r.preventive_routes?.field_technician_user_id).filter(Boolean) as string[]),
      ]);
      const clientes = await fetchClientesMap([
        ...corretivasRows.map(r => r.client_id).filter(Boolean) as string[],
        ...preventivasRows.map(r => r.client_id).filter(Boolean) as string[],
      ]);

      const corretivas: VisitaItem[] = corretivasRows.map(r => {
        const cliente = r.client_id ? clientes.get(r.client_id) : undefined;
        return {
          id: r.id,
          tipo: 'corretiva',
          codigo: r.visit_code ?? r.technical_tickets?.ticket_code ?? '—',
          clienteId: r.client_id ?? null,
          clienteNome: cliente?.nome ?? 'Cliente',
          fazenda: cliente?.fazenda ?? null,
          clienteLat: cliente?.latitude ?? null,
          clienteLon: cliente?.longitude ?? null,
          tecnicoUserId: r.field_technician_user_id ?? null,
          tecnicoNome: r.field_technician_user_id ? profiles.get(r.field_technician_user_id) ?? null : null,

          dataPlanejada: r.planned_start_date ?? null,
          dataRealizada: r.checkout_at ?? null,
          status: r.status,
          linkTo: `/chamados/visita/${r.id}`,
        };
      });

      const preventivas: VisitaItem[] = preventivasRows.map(r => {
        const cliente = r.client_id ? clientes.get(r.client_id) : undefined;
        const techId = r.preventive_routes?.field_technician_user_id ?? null;
        return {
          id: r.id,
          tipo: 'preventiva',
          codigo: r.preventive_routes?.route_code ?? '—',
          clienteId: r.client_id ?? null,
          clienteNome: cliente?.nome ?? 'Cliente',
          fazenda: cliente?.fazenda ?? null,
          clienteLat: cliente?.latitude ?? null,
          clienteLon: cliente?.longitude ?? null,
          tecnicoUserId: techId,
          tecnicoNome: techId ? profiles.get(techId) ?? null : null,

          dataPlanejada: r.planned_date ?? null,
          dataRealizada: r.checkin_at ?? null,
          status: r.status,
          linkTo: `/preventivas/execucao/${r.route_id}/atendimento/${r.id}`,
        };
      });

      return [...corretivas, ...preventivas].sort((a, b) => {
        const da = a.dataPlanejada ?? '';
        const db = b.dataPlanejada ?? '';
        return db.localeCompare(da);
      });
    },
  });

  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro ao carregar visitas',
        description: 'Não foi possível buscar as visitas. Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const lista = visitas ?? [];

  const statusDisponiveis = useMemo(() => {
    const set = new Set(lista.map(v => v.status));
    return [...set].sort((a, b) => (STATUS_LABELS[a] ?? a).localeCompare(STATUS_LABELS[b] ?? b));
  }, [lista]);

  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>();
    lista.forEach(v => {
      if (v.clienteId && !map.has(v.clienteId)) {
        map.set(v.clienteId, v.fazenda ? `${v.clienteNome} — ${v.fazenda}` : v.clienteNome);
      }
    });
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [lista]);

  const selectedClientLabel = clientFilter === 'all'
    ? 'Todos os produtores'
    : uniqueClients.find(c => c.id === clientFilter)?.label ?? 'Todos os produtores';

  const filtradas = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return lista.filter(v => {
      if (filtroTipo !== 'all' && v.tipo !== filtroTipo) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (clientFilter !== 'all' && v.clienteId !== clientFilter) return false;
      if (termo) {
        const alvo = [v.codigo, v.clienteNome, v.fazenda ?? '', v.tecnicoNome ?? '']
          .join(' ')
          .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      if (dateRange?.from) {
        if (!v.dataPlanejada) return false;
        const d = new Date(v.dataPlanejada);
        if (Number.isNaN(d.getTime())) return false;
        const inicio = new Date(dateRange.from);
        inicio.setHours(0, 0, 0, 0);
        const fim = new Date(dateRange.to ?? dateRange.from);
        fim.setHours(23, 59, 59, 999);
        if (d < inicio || d > fim) return false;
      }
      return true;
    });
  }, [lista, filtroTipo, statusFilter, clientFilter, search, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / ITEMS_PER_PAGE));
  const paginadas = useMemo(
    () => filtradas.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filtradas, currentPage],
  );

  const stats = useMemo(() => ({
    total: lista.length,
    corretiva: lista.filter(v => v.tipo === 'corretiva').length,
    preventiva: lista.filter(v => v.tipo === 'preventiva').length,
  }), [lista]);

  const aplicarTipo = (tipo: 'all' | TipoVisita) => {
    setFiltroTipo(prev => (tipo !== 'all' && prev === tipo ? 'all' : tipo));
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Visita Técnica</h1>
          <p className="text-muted-foreground">
            Idas presenciais do técnico à fazenda — corretivas e preventivas.
          </p>
        </div>
        {canAbrirVisita && (
          <Button onClick={() => setNovaVisitaOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Visita
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => aplicarTipo('all')}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            'cursor-pointer hover:border-primary/50 transition-colors border-blue-500/30',
            filtroTipo === 'corretiva' && 'ring-2 ring-blue-500',
          )}
          onClick={() => aplicarTipo('corretiva')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{stats.corretiva}</div>
            </div>
            <div className="text-sm text-muted-foreground">Corretivas</div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            'cursor-pointer hover:border-primary/50 transition-colors border-green-500/30',
            filtroTipo === 'preventiva' && 'ring-2 ring-green-500',
          )}
          onClick={() => aplicarTipo('preventiva')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{stats.preventiva}</div>
            </div>
            <div className="text-sm text-muted-foreground">Preventivas</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, cliente, fazenda ou técnico..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {statusDisponiveis.map(s => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className={cn(
                'w-full md:w-[240px] justify-between font-normal',
                clientFilter === 'all' && 'text-muted-foreground',
              )}
            >
              <span className="truncate">{selectedClientLabel}</span>
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 pointer-events-auto" align="start">
            <Command>
              <CommandInput placeholder="Buscar produtor..." />
              <CommandList>
                <CommandEmpty>Nenhum produtor encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__all__"
                    onSelect={() => { setClientFilter('all'); setCurrentPage(1); setClientPopoverOpen(false); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', clientFilter === 'all' ? 'opacity-100' : 'opacity-0')} />
                    Todos os produtores
                  </CommandItem>
                  {uniqueClients.map(c => (
                    <CommandItem
                      key={c.id}
                      value={c.label}
                      onSelect={() => { setClientFilter(c.id); setCurrentPage(1); setClientPopoverOpen(false); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', clientFilter === c.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{c.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full md:w-[260px] justify-start text-left font-normal',
                !dateRange?.from && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'dd/MM/yyyy')} — {format(dateRange.to, 'dd/MM/yyyy')}
                  </>
                ) : (
                  format(dateRange.from, 'dd/MM/yyyy')
                )
              ) : (
                <span>Período planejado</span>
              )}
              {dateRange?.from && (
                <XCircle
                  className="ml-auto h-4 w-4 opacity-60 hover:opacity-100"
                  onClick={e => { e.stopPropagation(); setDateRange(undefined); setCurrentPage(1); }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={range => { setDateRange(range); setCurrentPage(1); }}
              numberOfMonths={2}
              initialFocus
              locale={ptBR}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginadas.length > 0 ? (
        <>
          <Card className="overflow-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente/Fazenda</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Planejada</TableHead>
                  <TableHead>Realizada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map(v => (
                  <TableRow key={`${v.tipo}-${v.id}`}>
                    <TableCell className="font-medium font-mono">{v.codigo}</TableCell>
                    <TableCell>
                      <div className="font-medium">{v.clienteNome}</div>
                      {v.fazenda && (
                        <div className="text-sm text-muted-foreground">{v.fazenda}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.tipo === 'corretiva' ? 'default' : 'secondary'}>
                        {v.tipo === 'corretiva' ? 'Corretiva' : 'Preventiva'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {v.tecnicoNome ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{formatDate(v.dataPlanejada)}</TableCell>
                    <TableCell>{formatDate(v.dataRealizada)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(v.status)}>
                        {STATUS_LABELS[v.status] ?? v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(v.linkTo)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, filtradas.length)} de {filtradas.length} registros
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma visita encontrada para os filtros selecionados.
          </CardContent>
        </Card>
      )}

      <NovaVisitaTecnicaDialog open={novaVisitaOpen} onOpenChange={setNovaVisitaOpen} />
    </div>
  );
}
