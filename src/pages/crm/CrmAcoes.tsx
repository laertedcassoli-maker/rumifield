import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Calendar, User, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ActionStatus = 'aberta' | 'em_execucao' | 'concluida';
type ActionType = 'tarefa' | 'pendencia' | 'oportunidade';

const STATUS_LABELS: Record<ActionStatus, string> = {
  aberta: 'Pendente',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
};

const STATUS_FILTERS = [
  { value: 'aberta', label: 'Pendentes' },
  { value: 'em_execucao', label: 'Em Execução' },
  { value: 'concluida', label: 'Concluídas' },
  { value: 'todas', label: 'Todas' },
] as const;

const TYPE_LABELS: Record<ActionType, string> = {
  tarefa: 'Tarefa',
  pendencia: 'Pendência',
  oportunidade: 'Oportunidade',
};

const TYPE_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'tarefa', label: 'Tarefa' },
  { value: 'pendencia', label: 'Pendência' },
  { value: 'oportunidade', label: 'Oportunidade' },
] as const;

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Baixa',
  2: 'Média',
  3: 'Alta',
};

export default function CrmAcoes() {
  const { user, role } = useAuth();
  const isAdminOrCoord = role === 'admin' || role === 'coordenador_rplus' || role === 'coordenador_servicos';

  const [statusFilter, setStatusFilter] = useState<string>('aberta');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');

  const { data: actions, isLoading } = useQuery({
    queryKey: ['crm-actions-flat', user?.id, isAdminOrCoord],
    queryFn: async () => {
      let query = supabase
        .from('crm_actions')
        .select('*, clientes!inner(id, nome)')
        .order('due_at', { ascending: true, nullsFirst: false });

      if (!isAdminOrCoord && user?.id) {
        query = query.eq('owner_user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch owner names separately if admin/coord
      if (isAdminOrCoord && data && data.length > 0) {
        const ownerIds = [...new Set(data.map((a: any) => a.owner_user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', ownerIds);

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.nome]));
        return data.map((a: any) => ({ ...a, owner_name: profileMap.get(a.owner_user_id) || '—' }));
      }

      return data?.map((a: any) => ({ ...a, owner_name: null })) || [];
    },
    enabled: !!user?.id,
  });

  const filtered = useMemo(() => {
    if (!actions) return [];
    let result = actions;

    // Status filter
    if (statusFilter !== 'todas') {
      result = result.filter((a: any) => a.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'todos') {
      result = result.filter((a: any) => a.type === typeFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a: any) =>
        a.title?.toLowerCase().includes(q) ||
        (a.clientes as any)?.nome?.toLowerCase().includes(q)
      );
    }

    // Sort: overdue first, then by due_at ascending
    return result.sort((a: any, b: any) => {
      const aOverdue = a.due_at && a.status !== 'concluida' && isPast(new Date(a.due_at)) && !isToday(new Date(a.due_at));
      const bOverdue = b.due_at && b.status !== 'concluida' && isPast(new Date(b.due_at)) && !isToday(new Date(b.due_at));
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });
  }, [actions, statusFilter, typeFilter, search]);

  const isOverdue = (action: any) =>
    action.due_at && action.status !== 'concluida' && isPast(new Date(action.due_at)) && !isToday(new Date(action.due_at));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Ações CRM</h1>
        <p className="text-sm text-muted-foreground">Visão geral de todas as ações dos clientes</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={typeFilter === f.value ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTypeFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Results count */}
      {!isLoading && (
        <p className="text-xs text-muted-foreground">{filtered.length} ação(ões) encontrada(s)</p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>Nenhuma ação encontrada com esses filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((action: any) => {
            const overdue = isOverdue(action);
            const cliente = action.clientes as any;
            return (
              <Card
                key={action.id}
                className={`transition-colors ${overdue ? 'border-destructive/60 bg-destructive/5' : ''}`}
              >
                <CardContent className="p-4 space-y-2">
                  {/* Title + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground leading-tight truncate">
                        {action.title}
                      </p>
                      <Link
                        to={`/crm/${cliente?.id}`}
                        state={{ from: '/crm/acoes', fromLabel: 'Ações' }}
                        className="text-xs text-primary hover:underline"
                      >
                        {cliente?.nome}
                      </Link>
                    </div>
                    <StatusBadge status={action.status} />
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {TYPE_LABELS[action.type as ActionType] || action.type}
                    </Badge>
                    <PriorityBadge priority={action.priority} />

                    {action.due_at && (
                      <span className={`inline-flex items-center gap-1 ${overdue ? 'text-destructive font-semibold' : ''}`}>
                        {overdue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                        {format(new Date(action.due_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}

                    {isAdminOrCoord && action.owner_name && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {action.owner_name}
                      </span>
                    )}
                  </div>

                  {action.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ActionStatus }) {
  const config: Record<ActionStatus, { label: string; className: string; icon: React.ElementType }> = {
    aberta: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
    em_execucao: { label: 'Em execução', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock },
    concluida: { label: 'Concluída', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
  };
  const c = config[status] || config.aberta;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${c.className}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  const colors: Record<number, string> = {
    1: 'bg-muted text-muted-foreground',
    2: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    3: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colors[priority] || ''}`}>
      P{priority}
    </Badge>
  );
}
