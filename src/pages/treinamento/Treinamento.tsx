import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/supabase-helpers';
import { useAuth } from '@/contexts/AuthContext';
import NovaVisitaTreinamentoDialog from '@/components/treinamento/NovaVisitaTreinamentoDialog';
import TrainingChecklistExecution from '@/components/treinamento/TrainingChecklistExecution';
import {
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TreinamentoItem {
  id: string;
  cliente_id: string;
  status: string;
  planned_date: string | null;
  completed_date: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  checklist_template_id: string | null;
  technician_user_id: string | null;
  csm_user_id: string | null;
}

interface ClienteResumo {
  clienteId: string;
  nome: string;
  fazenda: string | null;
  total: number;
  maisRecente: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

function statusBadgeClass(status: string) {
  if (status === 'concluida') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (status === 'pendente') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  return '';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Treinamento — solicitação e acompanhamento de visitas de treinamento,
 * com histórico por cliente. Reaproveita checklist_templates existentes.
 */
export default function Treinamento() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canAbrirVisita = role === 'admin' || role === 'coordenador_servicos' || role === 'coordenador_rplus';

  const [novaVisitaOpen, setNovaVisitaOpen] = useState(false);
  const [editingVisita, setEditingVisita] = useState<TreinamentoItem | null>(null);
  const [concluindoVisita, setConcluindoVisita] = useState<TreinamentoItem | null>(null);
  const [excluindoVisita, setExcluindoVisita] = useState<TreinamentoItem | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'all' | 'pendente' | 'concluida'>('all');
  const [search, setSearch] = useState('');
  const [clienteDetalhe, setClienteDetalhe] = useState<ClienteResumo | null>(null);

  const { data: visitas, isLoading, error } = useQuery({
    queryKey: ['training-visits'],
    queryFn: async (): Promise<TreinamentoItem[]> => {
      const { data, error } = await supabase
        .from('training_visits')
        .select(
          'id, cliente_id, status, planned_date, completed_date, contact_name, contact_phone, notes, checklist_template_id, technician_user_id, csm_user_id'
        )
        .neq('status', 'cancelada')
        .order('planned_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as TreinamentoItem[];
    },
  });

  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro ao carregar treinamentos',
        description: 'Não foi possível buscar as visitas de treinamento. Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const lista = useMemo(() => visitas ?? [], [visitas]);

  const clienteIds = useMemo(() => [...new Set(lista.map(v => v.cliente_id))], [lista]);
  const responsavelIds = useMemo(
    () => [...new Set(lista.flatMap(v => [v.technician_user_id, v.csm_user_id]).filter(Boolean) as string[])],
    [lista],
  );
  const templateIds = useMemo(
    () => [...new Set(lista.map(v => v.checklist_template_id).filter(Boolean) as string[])],
    [lista],
  );

  const { data: clientesMap } = useQuery({
    queryKey: ['training-visits-clientes', clienteIds],
    queryFn: async () => {
      if (!clienteIds.length) return new Map<string, { nome: string; fazenda: string | null }>();
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda')
        .in('id', clienteIds);
      if (error) throw error;
      return new Map((data ?? []).map(c => [c.id, { nome: c.nome, fazenda: c.fazenda ?? null }]));
    },
    enabled: clienteIds.length > 0,
  });

  const { data: responsaveisMap } = useQuery({
    queryKey: ['training-visits-responsaveis', responsavelIds],
    queryFn: async () => {
      if (!responsavelIds.length) return new Map<string, string>();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', responsavelIds);
      if (error) throw error;
      return new Map((data ?? []).map(p => [p.id, p.nome]));
    },
    enabled: responsavelIds.length > 0,
  });

  const { data: templatesMap } = useQuery({
    queryKey: ['training-visits-templates', templateIds],
    queryFn: async () => {
      if (!templateIds.length) return new Map<string, string>();
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name')
        .in('id', templateIds);
      if (error) throw error;
      return new Map((data ?? []).map(t => [t.id, t.name]));
    },
    enabled: templateIds.length > 0,
  });

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await withTimeout(
        supabase.from('training_visits').delete().eq('id', id).select('id')
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-visits'] });
      toast({ title: 'Visita de treinamento excluída.' });
      setExcluindoVisita(null);
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err.message });
    },
  });

  const filtradas = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return lista.filter(v => {
      if (filtroStatus !== 'all' && v.status !== filtroStatus) return false;
      if (termo) {
        const cliente = clientesMap?.get(v.cliente_id);
        const respId = v.technician_user_id ?? v.csm_user_id;
        const alvo = [
          cliente?.nome ?? '',
          cliente?.fazenda ?? '',
          respId ? responsaveisMap?.get(respId) ?? '' : '',
          v.contact_name ?? '',
          v.checklist_template_id ? templatesMap?.get(v.checklist_template_id) ?? '' : '',
        ].join(' ').toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [lista, filtroStatus, search, clientesMap, responsaveisMap, templatesMap]);

  const stats = useMemo(() => ({
    total: lista.length,
    pendentes: lista.filter(v => v.status === 'pendente').length,
    concluidos: lista.filter(v => v.status === 'concluida').length,
  }), [lista]);

  const clientesResumo = useMemo<ClienteResumo[]>(() => {
    const map = new Map<string, ClienteResumo>();
    lista.forEach(v => {
      const cliente = clientesMap?.get(v.cliente_id);
      const dataRef = v.completed_date ?? v.planned_date;
      const atual = map.get(v.cliente_id);
      if (!atual) {
        map.set(v.cliente_id, {
          clienteId: v.cliente_id,
          nome: cliente?.nome ?? 'Cliente',
          fazenda: cliente?.fazenda ?? null,
          total: 1,
          maisRecente: dataRef,
        });
      } else {
        atual.total += 1;
        if (dataRef && (!atual.maisRecente || dataRef > atual.maisRecente)) {
          atual.maisRecente = dataRef;
        }
      }
    });
    return [...map.values()].sort((a, b) => (b.maisRecente ?? '').localeCompare(a.maisRecente ?? ''));
  }, [lista, clientesMap]);

  const historicoCliente = useMemo(() => {
    if (!clienteDetalhe) return [];
    return lista
      .filter(v => v.cliente_id === clienteDetalhe.clienteId)
      .sort((a, b) => (b.completed_date ?? b.planned_date ?? '').localeCompare(a.completed_date ?? a.planned_date ?? ''));
  }, [lista, clienteDetalhe]);

  const aplicarStatus = (s: 'all' | 'pendente' | 'concluida') => {
    setFiltroStatus(prev => (s !== 'all' && prev === s ? 'all' : s));
  };

  const podeConcluir = (v: TreinamentoItem) =>
    v.status === 'pendente' &&
    (canAbrirVisita || user?.id === v.technician_user_id || user?.id === v.csm_user_id);

  const responsavelNome = (v: TreinamentoItem) => {
    const id = v.technician_user_id ?? v.csm_user_id;
    if (!id) return '—';
    const nome = responsaveisMap?.get(id) ?? '—';
    return v.csm_user_id ? `${nome} (CSM)` : nome;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Treinamento</h1>
          <p className="text-muted-foreground">
            Solicitação e acompanhamento de visitas de treinamento.
          </p>
        </div>
        {canAbrirVisita && (
          <Button onClick={() => setNovaVisitaOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Visita de Treinamento
          </Button>
        )}
      </div>

      <Tabs defaultValue="treinamentos">
        <TabsList>
          <TabsTrigger value="treinamentos">Treinamentos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="treinamentos" className="space-y-6 mt-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => aplicarStatus('all')}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Todos</div>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'cursor-pointer hover:border-primary/50 transition-colors border-green-500/30',
                filtroStatus === 'concluida' && 'ring-2 ring-green-500',
              )}
              onClick={() => aplicarStatus('concluida')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div className="text-2xl font-bold text-green-600">{stats.concluidos}</div>
                </div>
                <div className="text-sm text-muted-foreground">Concluídos</div>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'cursor-pointer hover:border-primary/50 transition-colors border-blue-500/30',
                filtroStatus === 'pendente' && 'ring-2 ring-blue-500',
              )}
              onClick={() => aplicarStatus('pendente')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div className="text-2xl font-bold text-blue-600">{stats.pendentes}</div>
                </div>
                <div className="text-sm text-muted-foreground">Pendentes</div>
              </CardContent>
            </Card>
          </div>

          {/* Busca */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, fazenda, responsável ou treinado..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabela */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtradas.length > 0 ? (
            <Card className="overflow-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente/Fazenda</TableHead>
                    <TableHead>Checklist</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Planejada</TableHead>
                    <TableHead>Treinado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map(v => {
                    const cliente = clientesMap?.get(v.cliente_id);
                    return (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div className="font-medium">{cliente?.nome ?? 'Cliente'}</div>
                          {cliente?.fazenda && (
                            <div className="text-sm text-muted-foreground">{cliente.fazenda}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {v.checklist_template_id
                            ? templatesMap?.get(v.checklist_template_id) ?? '—'
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{responsavelNome(v)}</TableCell>
                        <TableCell>{formatDate(v.planned_date)}</TableCell>
                        <TableCell>
                          {v.contact_name ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClass(v.status)}>
                            {STATUS_LABELS[v.status] ?? v.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {podeConcluir(v) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={concluirMutation.isPending}
                              onClick={() => concluirMutation.mutate(v.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1.5" />
                              Concluir
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center space-y-3">
                <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma visita de treinamento encontrada.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4 mt-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : clientesResumo.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientesResumo.map(c => (
                <Card
                  key={c.clienteId}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setClienteDetalhe(c)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="font-medium truncate">{c.nome}</div>
                    {c.fazenda && (
                      <div className="text-sm text-muted-foreground truncate">{c.fazenda}</div>
                    )}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <ListChecks className="h-4 w-4" />
                        {c.total} treinamento{c.total !== 1 ? 's' : ''}
                      </span>
                      <span>{c.maisRecente ? formatDate(c.maisRecente) : '—'}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center space-y-3">
                <User className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhum cliente com treinamento registrado ainda.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Histórico do cliente */}
      <Dialog open={!!clienteDetalhe} onOpenChange={(v) => !v && setClienteDetalhe(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{clienteDetalhe?.nome}</DialogTitle>
            <DialogDescription>
              {clienteDetalhe?.fazenda
                ? `${clienteDetalhe.fazenda} — histórico de treinamentos`
                : 'Histórico de treinamentos'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
            {historicoCliente.map(v => (
              <div key={v.id} className="rounded-md border p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {formatDate(v.completed_date ?? v.planned_date)}
                  </span>
                  <Badge variant="outline" className={statusBadgeClass(v.status)}>
                    {STATUS_LABELS[v.status] ?? v.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Treinado por: {responsavelNome(v)}
                </div>
                {v.contact_name && (
                  <div className="text-sm">
                    {v.contact_name}
                    {v.contact_phone && (
                      <span className="text-muted-foreground"> — {v.contact_phone}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <NovaVisitaTreinamentoDialog open={novaVisitaOpen} onOpenChange={setNovaVisitaOpen} />
    </div>
  );
}
