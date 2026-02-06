import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCarteiraData, PRODUCT_ORDER, STAGE_LABELS, HEALTH_COLORS } from '@/hooks/useCrmData';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Building2, MapPin, ChevronRight, CircleDot, AlertCircle, Target, Clock, Plus } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { CriarAcaoModal } from '@/components/crm/CriarAcaoModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type FilterKey = 'all' | 'health_red' | 'no_qual_2' | 'negociacao_aberta' | 'pendencias_vencidas';

export default function CrmCarteira() {
  const { clientes, clientProducts, snapshots, actions, isLoading } = useCarteiraData();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [actionModal, setActionModal] = useState<{ open: boolean; clientId: string }>({ open: false, clientId: '' });

  const clienteData = useMemo(() => {
    return clientes.map(c => {
      const products = clientProducts.filter((p: any) => p.client_id === c.id);
      const clientSnapshots = snapshots.filter((s: any) => s.client_id === c.id);
      const clientActions = actions.filter((a: any) => a.client_id === c.id);

      // Health: worst among products
      const healthStatuses = clientSnapshots.map((s: any) => s.health_status).filter(Boolean);
      const worstHealth = healthStatuses.includes('vermelho') ? 'vermelho' :
        healthStatuses.includes('amarelo') ? 'amarelo' :
        healthStatuses.length > 0 ? 'verde' : null;

      // Counters
      const noQualCount = products.filter((p: any) => p.stage === 'nao_qualificado').length;
      const openOpps = products.filter((p: any) => ['proposta', 'negociacao'].includes(p.stage)).length;
      const openActions = clientActions.filter((a: any) => a.status !== 'concluida').length;
      const overdueActions = clientActions.filter((a: any) =>
        a.status !== 'concluida' && a.due_at && new Date(a.due_at) < new Date()
      ).length;

      // Top alerts from snapshots
      const alerts: string[] = [];
      clientSnapshots.forEach((s: any) => {
        if (s.health_reasons) {
          (s.health_reasons as string[]).forEach(r => {
            if (alerts.length < 2) alerts.push(r);
          });
        }
      });

      return {
        ...c,
        worstHealth,
        noQualCount,
        openOpps,
        openActions,
        overdueActions,
        alerts,
      };
    });
  }, [clientes, clientProducts, snapshots, actions]);

  const filtered = useMemo(() => {
    let list = clienteData;

    // Text search
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      list = list.filter(c =>
        c.nome.toLowerCase().includes(s) ||
        (c.fazenda?.toLowerCase().includes(s)) ||
        (c.cidade?.toLowerCase().includes(s))
      );
    }

    // Filter
    switch (filter) {
      case 'health_red':
        list = list.filter(c => c.worstHealth === 'vermelho');
        break;
      case 'no_qual_2':
        list = list.filter(c => c.noQualCount >= 2);
        break;
      case 'negociacao_aberta':
        list = list.filter(c => c.openOpps > 0);
        break;
      case 'pendencias_vencidas':
        list = list.filter(c => c.overdueActions > 0);
        break;
    }

    return list;
  }, [clienteData, debouncedSearch, filter]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Carteira CRM</h1>
        <p className="text-muted-foreground">Visão geral dos seus clientes</p>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="health_red">Saúde Vermelha</SelectItem>
            <SelectItem value="no_qual_2">Sem qualificação 2+</SelectItem>
            <SelectItem value="negociacao_aberta">Negociação aberta</SelectItem>
            <SelectItem value="pendencias_vencidas">Pendências vencidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">{clienteData.length}</p>
          <p className="text-xs text-muted-foreground">Clientes</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-red-600">{clienteData.filter(c => c.worstHealth === 'vermelho').length}</p>
          <p className="text-xs text-muted-foreground">Saúde Crítica</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{clienteData.reduce((s, c) => s + c.openOpps, 0)}</p>
          <p className="text-xs text-muted-foreground">Oportunidades</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-destructive">{clienteData.reduce((s, c) => s + c.overdueActions, 0)}</p>
          <p className="text-xs text-muted-foreground">Vencidas</p>
        </CardContent></Card>
      </div>

      {/* Client List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum cliente encontrado</CardContent></Card>
        ) : (
          filtered.map(c => (
            <Card key={c.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <Link to={`/crm/${c.id}`} className="font-medium truncate hover:underline">{c.nome}</Link>
                      {c.worstHealth && (
                        <CircleDot className={`h-3.5 w-3.5 shrink-0 ${HEALTH_COLORS[c.worstHealth]}`} />
                      )}
                    </div>

                    {(c.cidade || c.fazenda) && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-6 truncate">
                        {c.fazenda}{c.fazenda && c.cidade ? ' · ' : ''}{c.cidade}{c.estado ? `/${c.estado}` : ''}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 ml-6 flex-wrap">
                      {c.noQualCount > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-0.5">
                          <Target className="h-3 w-3" /> {c.noQualCount} s/ qualificação
                        </Badge>
                      )}
                      {c.openOpps > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-0.5 border-amber-400 text-amber-700 dark:text-amber-400">
                          <AlertCircle className="h-3 w-3" /> {c.openOpps} oportunidades
                        </Badge>
                      )}
                      {c.openActions > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-0.5">
                          <Clock className="h-3 w-3" /> {c.openActions} pendências
                          {c.overdueActions > 0 && <span className="text-destructive ml-0.5">({c.overdueActions} venc.)</span>}
                        </Badge>
                      )}
                    </div>

                    {c.alerts.length > 0 && (
                      <div className="mt-1.5 ml-6 space-y-0.5">
                        {c.alerts.map((a, i) => (
                          <p key={i} className="text-[11px] text-muted-foreground truncate">⚠ {a}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={(e) => { e.preventDefault(); setActionModal({ open: true, clientId: c.id }); }}
                      title="Criar ação"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Link to={`/crm/${c.id}`}>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CriarAcaoModal
        open={actionModal.open}
        onOpenChange={(o) => setActionModal(p => ({ ...p, open: o }))}
        clientId={actionModal.clientId}
      />
    </div>
  );
}
