import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCarteiraData, PRODUCT_ORDER, PRODUCT_LABELS, STAGE_LABELS, HEALTH_COLORS } from '@/hooks/useCrmData';
import type { ProductCode } from '@/hooks/useCrmData';
import { useProductBadgeColors } from '@/components/crm/ProductBadge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, CircleDot, AlertCircle, Target, Clock, Plus, CalendarDays, ShieldCheck, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDebounce } from '@/hooks/useDebounce';
import { CriarAcaoModal } from '@/components/crm/CriarAcaoModal';


export default function CrmCarteira() {
  const { clientes, clientProducts, snapshots, actions, visits, consultores, isAdmin, isLoading } = useCarteiraData();

  const { data: produtoBadgeColors } = useProductBadgeColors();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
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
      const openOpps = products.filter((p: any) => p.stage === 'em_negociacao').length;
      const activeProducts = products
        .filter((p: any) => p.stage === 'ganho')
        .map((p: any) => p.product_code as ProductCode);
      const isFullSuite = PRODUCT_ORDER.every(code => activeProducts.includes(code));
      const openActions = clientActions.filter((a: any) => a.status !== 'concluida').length;
      const overdueActions = clientActions.filter((a: any) =>
        a.status !== 'concluida' && a.due_at && new Date(a.due_at) < new Date()
      ).length;

      // Next visit
      const nextVisit = visits.find((v: any) => v.client_id === c.id);
      const nextVisitDate = nextVisit?.planned_start_at ? new Date(nextVisit.planned_start_at) : null;
      const hasPlannedVisit = !!nextVisit;

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
        activeProducts,
        isFullSuite,
        openOpps,
        openActions,
        overdueActions,
        nextVisitDate,
        hasPlannedVisit,
        alerts,
      };
    });
  }, [clientes, clientProducts, snapshots, actions, visits]);

  const filtered = useMemo(() => {
    let list = clienteData;

    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      list = list.filter(c =>
        c.nome.toLowerCase().includes(s) ||
        (c.fazenda?.toLowerCase().includes(s)) ||
        (c.cidade?.toLowerCase().includes(s))
      );
    }

    return list;
  }, [clienteData, debouncedSearch]);

  return (
    <div className="space-y-3 animate-fade-in pb-24 overflow-x-hidden">
      <h1 className="text-lg font-bold">Carteira CRM</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Client count */}
      <p className="text-xs text-muted-foreground">{filtered.length} de {clienteData.length} clientes</p>

      {/* Client List */}
      <div className="space-y-1.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado</CardContent></Card>
        ) : (
          filtered.map(c => (
            <Card
              key={c.id}
              className="active:bg-muted/50 transition-colors cursor-pointer hover:border-primary/30"
              onClick={() => navigate(`/crm/${c.id}`, { state: { from: '/crm/carteira', fromLabel: 'Carteira' } })}
            >
              <CardContent className="py-2.5 pl-3 pr-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Row 1: name + health */}
                    <div className="flex items-center gap-1.5">
                       {c.worstHealth && (
                         <CircleDot className={`h-3 w-3 shrink-0 ${HEALTH_COLORS[c.worstHealth]}`} />
                       )}
                       <span className="text-sm font-medium truncate">{c.nome}</span>
                       {c.isFullSuite && (
                         <span className="shrink-0 flex items-center gap-0.5 text-amber-600 dark:text-amber-400" title="Cliente 360° — todos os produtos ativos">
                           <ShieldCheck className="h-3.5 w-3.5" />
                           <span className="text-[9px] font-bold">360°</span>
                         </span>
                       )}
                     </div>

                    {/* Row 2: location */}
                    {(c.cidade || c.fazenda) && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {c.fazenda}{c.fazenda && c.cidade ? ' · ' : ''}{c.cidade}{c.estado ? `/${c.estado}` : ''}
                      </p>
                    )}

                    {/* Row 3: product badges */}
                    <div className="flex items-center gap-1 mt-1">
                      {PRODUCT_ORDER.map(code => {
                        const isActive = c.activeProducts.includes(code);
                        const badgeColor = produtoBadgeColors?.[code];
                        return (
                          <span
                            key={code}
                            className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${
                              !isActive ? 'text-muted-foreground/50 bg-muted/50' : ''
                            }`}
                            style={isActive && badgeColor ? {
                              backgroundColor: `${badgeColor}20`,
                              color: badgeColor,
                            } : undefined}
                          >
                            {PRODUCT_LABELS[code]}
                          </span>
                        );
                      })}
                    </div>

                    {/* Row 4: icon indicators */}
                    <div className="flex items-center gap-2 mt-1">
                      {c.hasPlannedVisit && (
                        <span className="flex items-center gap-0.5 text-primary" title={c.nextVisitDate ? `Visita ${format(c.nextVisitDate, "dd/MM", { locale: ptBR })}` : 'Visita planejada'}>
                          <CalendarDays className="h-3.5 w-3.5" />
                          {c.nextVisitDate && (
                            <span className="text-[10px] font-medium">{format(c.nextVisitDate, "dd/MM", { locale: ptBR })}</span>
                          )}
                        </span>
                      )}
                      {c.openOpps > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400" title={`${c.openOpps} oportunidade(s)`}>
                          <Target className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold">{c.openOpps}</span>
                        </span>
                      )}
                      {c.overdueActions > 0 && (
                        <span className="flex items-center gap-0.5 text-destructive" title={`${c.overdueActions} vencida(s)`}>
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold">{c.overdueActions}</span>
                        </span>
                      )}
                      {c.openActions > 0 && c.overdueActions === 0 && (
                        <span className="flex items-center gap-0.5 text-muted-foreground" title={`${c.openActions} pendência(s)`}>
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold">{c.openActions}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* FAB */}
      <Button
        size="lg"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50 md:bottom-6"
        onClick={() => setActionModal({ open: true, clientId: '' })}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <CriarAcaoModal
        open={actionModal.open}
        onOpenChange={(o) => setActionModal(p => ({ ...p, open: o }))}
        clientId={actionModal.clientId}
      />
    </div>
  );
}
