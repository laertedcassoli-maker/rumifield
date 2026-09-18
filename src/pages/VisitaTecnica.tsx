import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type TipoVisita = 'corretiva' | 'preventiva';

interface VisitaItem {
  id: string;
  tipo: TipoVisita;
  codigo: string;
  clienteNome: string;
  fazenda: string | null;
  tecnicoNome: string | null;
  dataPlanejada: string | null;
  dataRealizada: string | null;
  status: string;
  linkTo: string;
}

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

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'em_execucao') return 'default';
  if (status === 'finalizada' || status === 'executado') return 'secondary';
  return 'outline';
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

async function fetchClientesMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, { nome: string; fazenda: string | null }>();
  const { data } = await supabase.from('clientes').select('id, nome, fazenda').in('id', unique);
  return new Map((data ?? []).map(c => [c.id, { nome: c.nome, fazenda: c.fazenda ?? null }]));
}

/**
 * Visita Técnica — leitura/navegação das idas presenciais à fazenda:
 * visitas corretivas (ticket_visits) e preventivas (preventive_route_items).
 * Mesmas fontes e enriquecimento da Agenda de Operações; nenhuma mutação.
 */
export default function VisitaTecnica() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filtroTipo, setFiltroTipo] = useState<'all' | TipoVisita>('all');

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
          clienteNome: cliente?.nome ?? 'Cliente',
          fazenda: cliente?.fazenda ?? null,
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
          clienteNome: cliente?.nome ?? 'Cliente',
          fazenda: cliente?.fazenda ?? null,
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
    meta: { timeoutMs: 15000 },
  });

  useMemo(() => {
    if (error) {
      toast({
        title: 'Erro ao carregar visitas',
        description: 'Não foi possível buscar as visitas. Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const visiveis = useMemo(() => {
    const lista = visitas ?? [];
    return filtroTipo === 'all' ? lista : lista.filter(v => v.tipo === filtroTipo);
  }, [visitas, filtroTipo]);

  const totais = useMemo(() => {
    const lista = visitas ?? [];
    return {
      all: lista.length,
      corretiva: lista.filter(v => v.tipo === 'corretiva').length,
      preventiva: lista.filter(v => v.tipo === 'preventiva').length,
    };
  }, [visitas]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Visita Técnica</h1>
      </div>
      <p className="text-muted-foreground mb-4">
        Idas presenciais do técnico à fazenda — corretivas e preventivas.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button
          variant={filtroTipo === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFiltroTipo('all')}
        >
          Todos ({totais.all})
        </Button>
        <Button
          variant={filtroTipo === 'corretiva' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFiltroTipo(filtroTipo === 'corretiva' ? 'all' : 'corretiva')}
        >
          Corretivas ({totais.corretiva})
        </Button>
        <Button
          variant={filtroTipo === 'preventiva' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFiltroTipo(filtroTipo === 'preventiva' ? 'all' : 'preventiva')}
        >
          Preventivas ({totais.preventiva})
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : visiveis.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma visita encontrada para o filtro selecionado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visiveis.map(v => (
            <Card
              key={`${v.tipo}-${v.id}`}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate(v.linkTo)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{v.clienteNome}</span>
                      {v.fazenda && (
                        <span className="text-sm text-muted-foreground truncate">{v.fazenda}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mt-1 text-xs text-muted-foreground">
                      <span className="font-mono">{v.codigo}</span>
                      <span>
                        {v.tecnicoNome ? `Técnico: ${v.tecnicoNome}` : 'Técnico: —'}
                      </span>
                      <span>Planejada: {formatDate(v.dataPlanejada)}</span>
                      {v.dataRealizada && <span>Realizada: {formatDate(v.dataRealizada)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge variant={v.tipo === 'corretiva' ? 'default' : 'secondary'}>
                      {v.tipo === 'corretiva' ? 'Corretiva' : 'Preventiva'}
                    </Badge>
                    <Badge variant={statusBadgeVariant(v.status)}>
                      {STATUS_LABELS[v.status] ?? v.status}
                    </Badge>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
