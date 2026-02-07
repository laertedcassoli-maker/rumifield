import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PRODUCT_LABELS, type ProductCode, PRODUCT_ORDER } from '@/hooks/useCrmData';
import { format } from 'date-fns';
import { ArrowLeft, Search, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-700 border-emerald-300',
  yellow: 'bg-amber-500/15 text-amber-700 border-amber-300',
  red: 'bg-red-500/15 text-red-700 border-red-300',
};

const HEALTH_LABELS: Record<string, string> = {
  green: 'Verde',
  yellow: 'Amarelo',
  red: 'Vermelho',
};

interface SnapshotRow {
  id: string;
  client_id: string;
  product_code: ProductCode;
  health_status: string | null;
  health_reasons: any;
  data: any;
  snapshot_at: string;
  clientes: {
    nome: string;
    fazenda: string | null;
    cidade: string | null;
    estado: string | null;
  };
}

interface MetricDef {
  id: string;
  metric_key: string;
  label: string;
  unit: string | null;
  product_code: ProductCode;
  priority: number;
}

export default function CrmMetricas() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [filterHealth, setFilterHealth] = useState<string>('all');

  const { data: snapshots, isLoading: loadingSnapshots } = useQuery({
    queryKey: ['crm-snapshots-admin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_client_product_snapshots')
        .select('*, clientes!inner(nome, fazenda, cidade, estado)')
        .order('snapshot_at', { ascending: false });
      if (error) throw error;
      return data as SnapshotRow[];
    },
  });

  const { data: metricDefs, isLoading: loadingDefs } = useQuery({
    queryKey: ['crm-metric-defs-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_metric_definitions')
        .select('*')
        .eq('is_active', true)
        .order('priority');
      if (error) throw error;
      return data as MetricDef[];
    },
  });

  // Deduplicate: keep only latest snapshot per client+product
  const latestSnapshots = (() => {
    if (!snapshots) return [];
    const map = new Map<string, SnapshotRow>();
    for (const s of snapshots) {
      const key = `${s.client_id}-${s.product_code}`;
      if (!map.has(key)) map.set(key, s);
    }
    return Array.from(map.values());
  })();

  // Filter
  const filtered = latestSnapshots.filter(s => {
    if (filterProduct !== 'all' && s.product_code !== filterProduct) return false;
    if (filterHealth !== 'all' && s.health_status !== filterHealth) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const nome = s.clientes.nome?.toLowerCase() || '';
      const fazenda = s.clientes.fazenda?.toLowerCase() || '';
      if (!nome.includes(q) && !fazenda.includes(q)) return false;
    }
    return true;
  });

  // Get metric defs for current product filter
  const visibleMetrics = (metricDefs || []).filter(
    m => filterProduct === 'all' || m.product_code === filterProduct
  );

  const isLoading = loadingSnapshots || loadingDefs;

  const formatReasons = (reasons: any): string => {
    if (!reasons) return '—';
    if (Array.isArray(reasons)) return reasons.length > 0 ? reasons.join(', ') : '—';
    if (typeof reasons === 'string') return reasons || '—';
    return '—';
  };

  const getMetricValue = (data: any, metricKey: string, unit: string | null): string => {
    if (!data || typeof data !== 'object') return '—';
    const val = data[metricKey];
    if (val === undefined || val === null) return '—';
    if (unit) return `${val} ${unit}`;
    return String(val);
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/crm"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Métricas de Saúde</h1>
          <p className="text-sm text-muted-foreground">Visão geral da saúde de todos os clientes por produto</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente ou fazenda..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {PRODUCT_ORDER.map(code => (
              <SelectItem key={code} value={code}>{PRODUCT_LABELS[code]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterHealth} onValueChange={setFilterHealth}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Saúde" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="green">🟢 Verde</SelectItem>
            <SelectItem value="yellow">🟡 Amarelo</SelectItem>
            <SelectItem value="red">🔴 Vermelho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Database className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {latestSnapshots.length === 0
              ? 'Nenhum dado de saúde disponível. Os dados serão populados automaticamente pela integração iMilk.'
              : 'Nenhum resultado encontrado com os filtros atuais.'}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Fazenda</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Saúde</TableHead>
                <TableHead>Motivos</TableHead>
                <TableHead>Último Snap</TableHead>
                {visibleMetrics.map(m => (
                  <TableHead key={m.id} className="text-center whitespace-nowrap">
                    {m.label}{m.unit ? ` (${m.unit})` : ''}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link to={`/crm/${s.client_id}`} className="text-primary hover:underline">
                      {s.clientes.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.clientes.fazenda || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{PRODUCT_LABELS[s.product_code] || s.product_code}</Badge>
                  </TableCell>
                  <TableCell>
                    {s.health_status ? (
                      <Badge className={`text-xs border ${HEALTH_COLORS[s.health_status] || ''}`}>
                        {HEALTH_LABELS[s.health_status] || s.health_status}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {formatReasons(s.health_reasons)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(s.snapshot_at), 'dd/MM/yy')}
                  </TableCell>
                  {visibleMetrics.map(m => (
                    <TableCell key={m.id} className="text-center text-sm">
                      {m.product_code === s.product_code
                        ? getMetricValue(s.data, m.metric_key, null)
                        : '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
