import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ChevronRight, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/use-toast';

type OrigemOcorrencia = 'pedido' | 'visita';

interface Ocorrencia {
  data: string;
  origem: OrigemOcorrencia;
}

const ORIGEM_LABELS: Record<OrigemOcorrencia, string> = {
  pedido: 'Pedido de peças',
  visita: 'Visita técnica',
};

function melhor(a: Ocorrencia | null, b: Ocorrencia | null): Ocorrencia | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(b.data).getTime() > new Date(a.data).getTime() ? b : a;
}

/**
 * Clientes RF — leitura: clientes com RumiFlow ativo (stage 'ganho'),
 * ordenados pela última ocorrência (pedido de peças ou visita técnica).
 * Nenhuma mutação.
 */
export default function ClientesRF() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: clientes, isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-rf-lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado, status')
        .eq('estoque_interno', false)
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: ocorrencias, isLoading: loadingOcorrencias, error } = useQuery({
    queryKey: ['clientes-rf-ocorrencias'],
    queryFn: async (): Promise<Map<string, Ocorrencia>> => {
      const [pedidosRes, corretivasRes, preventivasRes] = await Promise.all([
        supabase
          .from('pedidos')
          .select('cliente_id, created_at, tipo_solicitacao')
          .in('tipo_solicitacao', ['envio', 'coleta_reversa']),
        supabase
          .from('ticket_visits')
          .select('client_id, planned_start_date, checkout_at, status'),
        supabase
          .from('preventive_route_items')
          .select('client_id, planned_date, checkin_at, status'),
      ]);

      if (pedidosRes.error) throw pedidosRes.error;
      if (corretivasRes.error) throw corretivasRes.error;
      if (preventivasRes.error) throw preventivasRes.error;

      const mapa = new Map<string, Ocorrencia>();
      const CANCELADOS = ['cancelada', 'cancelado'];

      const registrar = (clientId: string | null, data: string | null, origem: OrigemOcorrencia) => {
        if (!clientId || !data) return;
        const atual = mapa.get(clientId) ?? null;
        const combinado = melhor(atual, { data, origem });
        if (combinado) mapa.set(clientId, combinado);
      };

      (pedidosRes.data ?? []).forEach((p: any) => registrar(p.cliente_id, p.created_at, 'pedido'));
      (corretivasRes.data ?? [])
        .filter((v: any) => !CANCELADOS.includes(v.status))
        .forEach((v: any) => registrar(v.client_id, v.checkout_at ?? v.planned_start_date, 'visita'));
      (preventivasRes.data ?? [])
        .filter((i: any) => !CANCELADOS.includes(i.status))
        .forEach((i: any) => registrar(i.client_id, i.checkin_at ?? i.planned_date, 'visita'));


      return mapa;
    },
  });

  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro ao carregar ocorrências',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const lista = useMemo(() => {
    let items = (clientes ?? [])
      .map((c: any) => ({
        ...c,
        ocorrencia: ocorrencias?.get(c.id) ?? null,
      }));

    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      items = items.filter(
        (c: any) =>
          c.nome?.toLowerCase().includes(s) ||
          c.fazenda?.toLowerCase().includes(s)
      );
    }

    return items.sort((a: any, b: any) => {
      const ta = a.ocorrencia ? new Date(a.ocorrencia.data).getTime() : -Infinity;
      const tb = b.ocorrencia ? new Date(b.ocorrencia.data).getTime() : -Infinity;
      return tb - ta;
    });
  }, [clientes, ocorrencias, debouncedSearch]);

  const isLoading = loadingClientes || loadingOcorrencias;

  return (
    <div className="space-y-3 animate-fade-in pb-24 overflow-x-hidden">
      <div>
        <h1 className="text-lg font-bold">Clientes RF</h1>
        <p className="text-xs text-muted-foreground">
          Clientes ativos, da ocorrência mais recente para a mais antiga.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente ou fazenda..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lista.map((c: any) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:bg-accent/40 transition-colors"
              onClick={() => navigate(`/clientes-rf/${c.id}`)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold truncate">{c.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.fazenda || 'Fazenda não informada'}
                    {c.cidade ? ` · ${c.cidade}${c.estado ? `/${c.estado}` : ''}` : ''}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {c.ocorrencia ? (
                      <span className="truncate">
                        {format(new Date(c.ocorrencia.data), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    ) : (
                      <span>Sem ocorrências</span>
                    )}
                    {c.ocorrencia && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {ORIGEM_LABELS[c.ocorrencia.origem]}
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
