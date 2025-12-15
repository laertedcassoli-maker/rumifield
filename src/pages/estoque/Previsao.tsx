import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  Loader2, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Calendar,
  Droplets,
  FlaskConical,
  ShoppingCart
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const VOLUME_GALAO = 50;
const DIAS_ANTECEDENCIA_PEDIDO = 30;

interface PrevisaoItem {
  cliente_id: string;
  cliente_nome: string;
  cliente_fazenda: string;
  produto_id: string;
  produto_nome: string;
  estoque_atual: number;
  vacas_lactacao: number | null;
  consumo_real_diario: number;
  consumo_teorico_diario: number | null;
  dias_restantes_real: number;
  dias_restantes_teorico: number | null;
  data_esgotamento_real: Date | null;
  data_esgotamento_teorico: Date | null;
  data_pedido_real: Date | null;
  data_pedido_teorico: Date | null;
  ultima_afericao: string;
  status_real: 'critico' | 'atencao' | 'ok';
  status_teorico: 'critico' | 'atencao' | 'ok';
}

type SortColumn = 'cliente' | 'fazenda' | 'estoque' | 'consumo' | 'dias' | 'data_pedido' | 'data_esgotamento';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'real' | 'teorico';

// Product styling configuration
const productStyles = [
  { 
    icon: Droplets, 
    activeClass: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
    inactiveClass: 'text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400'
  },
  { 
    icon: FlaskConical, 
    activeClass: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
    inactiveClass: 'text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400'
  },
];

export default function Previsao() {
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('data_pedido');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('real');

  const { data: produtos, isLoading: isLoadingProdutos } = useQuery({
    queryKey: ['produtos-previsao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_quimicos')
        .select('id, nome, litros_por_vaca_2x, litros_por_vaca_3x')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  // Auto-select first product
  const firstProdutoId = produtos?.[0]?.id;
  if (!selectedProdutoId && firstProdutoId) {
    setSelectedProdutoId(firstProdutoId);
  }

  // Fetch latest measurements per client/product
  const { data: afericoes, isLoading: loadingAfericoes } = useQuery({
    queryKey: ['afericoes-previsao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_cliente')
        .select(`
          *,
          clientes(nome, fazenda, status, ordenhas_dia),
          produtos_quimicos(nome, litros_por_vaca_2x, litros_por_vaca_3x)
        `)
        .order('data_afericao', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all measurements for consumption calculation
  const { data: todasAfericoes } = useQuery({
    queryKey: ['todas-afericoes-previsao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_cliente')
        .select('*')
        .order('data_afericao', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch shipments
  const { data: envios } = useQuery({
    queryKey: ['envios-previsao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('envios_produtos')
        .select('*')
        .order('data_envio', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const calcularTotalLitros = (galoesCheios: number, nivelParcial: number | null) => {
    const cheios = galoesCheios * VOLUME_GALAO;
    const parcial = nivelParcial !== null ? (nivelParcial / 100) * VOLUME_GALAO : 0;
    return Math.round(cheios + parcial);
  };

  const getStatus = (dias: number): 'critico' | 'atencao' | 'ok' => {
    if (dias <= 15) return 'critico';
    if (dias <= 30) return 'atencao';
    return 'ok';
  };

  // Calculate forecast data
  const previsaoData = useMemo(() => {
    if (!afericoes || !todasAfericoes || !envios || !produtos) return [];

    // Get latest measurement per client/product
    const ultimaAfericaoPorClienteProduto: Record<string, typeof afericoes[0]> = {};
    
    afericoes.forEach(af => {
      if (af.clientes?.status !== 'ativo') return;
      
      const key = `${af.cliente_id}-${af.produto_id}`;
      if (!ultimaAfericaoPorClienteProduto[key]) {
        ultimaAfericaoPorClienteProduto[key] = af;
      }
    });

    // Calculate average daily consumption for each client/product
    const consumoPorClienteProduto: Record<string, { total: number; dias: number }> = {};
    
    const afericoesPorClienteProduto: Record<string, typeof todasAfericoes> = {};
    todasAfericoes.forEach(af => {
      const key = `${af.cliente_id}-${af.produto_id}`;
      if (!afericoesPorClienteProduto[key]) {
        afericoesPorClienteProduto[key] = [];
      }
      afericoesPorClienteProduto[key].push(af);
    });

    const enviosPorClienteProduto: Record<string, typeof envios> = {};
    envios.forEach(env => {
      const key = `${env.cliente_id}-${env.produto_id}`;
      if (!enviosPorClienteProduto[key]) {
        enviosPorClienteProduto[key] = [];
      }
      enviosPorClienteProduto[key].push(env);
    });

    Object.entries(afericoesPorClienteProduto).forEach(([key, afs]) => {
      if (afs.length < 2) return;
      
      let totalConsumo = 0;
      let totalDias = 0;
      
      for (let i = 1; i < afs.length; i++) {
        const anterior = afs[i - 1];
        const atual = afs[i];
        
        const estoqueInicial = calcularTotalLitros(anterior.galoes_cheios, anterior.nivel_galao_parcial);
        const estoqueFinal = calcularTotalLitros(atual.galoes_cheios, atual.nivel_galao_parcial);
        
        let enviosPeriodo = 0;
        const envsCliente = enviosPorClienteProduto[key] || [];
        envsCliente.forEach(env => {
          if (env.data_envio > anterior.data_afericao && env.data_envio <= atual.data_afericao) {
            enviosPeriodo += env.quantidade;
          }
        });
        
        const consumo = estoqueInicial + enviosPeriodo - estoqueFinal;
        const dias = Math.max(1, Math.round((new Date(atual.data_afericao).getTime() - new Date(anterior.data_afericao).getTime()) / (1000 * 60 * 60 * 24)));
        
        if (consumo > 0) {
          totalConsumo += consumo;
          totalDias += dias;
        }
      }
      
      if (totalDias > 0) {
        consumoPorClienteProduto[key] = { total: totalConsumo, dias: totalDias };
      }
    });

    const result: PrevisaoItem[] = [];
    
    Object.entries(ultimaAfericaoPorClienteProduto).forEach(([key, af]) => {
      const estoqueAtual = calcularTotalLitros(af.galoes_cheios, af.nivel_galao_parcial);
      const consumoData = consumoPorClienteProduto[key];
      const vacasLactacao = af.vacas_lactacao;
      const ordenhas = af.clientes?.ordenhas_dia || 3;
      
      const produto = produtos.find(p => p.id === af.produto_id);
      const litrosPorVacaMes = ordenhas === 3 
        ? produto?.litros_por_vaca_3x 
        : produto?.litros_por_vaca_2x;
      
      // Real consumption
      const consumoRealDiario = consumoData && consumoData.dias > 0 
        ? consumoData.total / consumoData.dias 
        : 0;
      
      // Theoretical consumption
      const consumoTeoricoDiario = vacasLactacao && litrosPorVacaMes 
        ? (vacasLactacao * litrosPorVacaMes) / 30 
        : null;
      
      // Days remaining
      const diasRestantesReal = consumoRealDiario > 0 ? Math.round(estoqueAtual / consumoRealDiario) : 999;
      const diasRestantesTeorico = consumoTeoricoDiario && consumoTeoricoDiario > 0 
        ? Math.round(estoqueAtual / consumoTeoricoDiario) 
        : null;
      
      // Depletion dates
      const dataEsgotamentoReal = consumoRealDiario > 0 ? addDays(new Date(), diasRestantesReal) : null;
      const dataEsgotamentoTeorico = diasRestantesTeorico ? addDays(new Date(), diasRestantesTeorico) : null;
      
      // Order dates (30 days before depletion)
      const dataPedidoReal = dataEsgotamentoReal ? subDays(dataEsgotamentoReal, DIAS_ANTECEDENCIA_PEDIDO) : null;
      const dataPedidoTeorico = dataEsgotamentoTeorico ? subDays(dataEsgotamentoTeorico, DIAS_ANTECEDENCIA_PEDIDO) : null;
      
      if (consumoRealDiario > 0 || consumoTeoricoDiario) {
        result.push({
          cliente_id: af.cliente_id,
          cliente_nome: af.clientes?.nome || '',
          cliente_fazenda: af.clientes?.fazenda || '',
          produto_id: af.produto_id,
          produto_nome: af.produtos_quimicos?.nome || '',
          estoque_atual: estoqueAtual,
          vacas_lactacao: vacasLactacao,
          consumo_real_diario: Math.round(consumoRealDiario * 10) / 10,
          consumo_teorico_diario: consumoTeoricoDiario ? Math.round(consumoTeoricoDiario * 10) / 10 : null,
          dias_restantes_real: diasRestantesReal,
          dias_restantes_teorico: diasRestantesTeorico,
          data_esgotamento_real: dataEsgotamentoReal,
          data_esgotamento_teorico: dataEsgotamentoTeorico,
          data_pedido_real: dataPedidoReal,
          data_pedido_teorico: dataPedidoTeorico,
          ultima_afericao: af.data_afericao,
          status_real: getStatus(diasRestantesReal),
          status_teorico: diasRestantesTeorico ? getStatus(diasRestantesTeorico) : 'ok',
        });
      }
    });

    return result;
  }, [afericoes, todasAfericoes, envios, produtos]);

  // Filter and sort
  const filteredData = useMemo(() => {
    let data = previsaoData.filter(item => item.produto_id === selectedProdutoId);
    
    if (search) {
      const searchLower = search.toLowerCase();
      data = data.filter(item => 
        item.cliente_nome.toLowerCase().includes(searchLower) ||
        item.cliente_fazenda?.toLowerCase().includes(searchLower)
      );
    }
    
    data.sort((a, b) => {
      let valueA: string | number | Date | null = '';
      let valueB: string | number | Date | null = '';
      
      const isReal = viewMode === 'real';
      
      switch (sortColumn) {
        case 'cliente':
          valueA = a.cliente_nome.toLowerCase();
          valueB = b.cliente_nome.toLowerCase();
          break;
        case 'fazenda':
          valueA = (a.cliente_fazenda || '').toLowerCase();
          valueB = (b.cliente_fazenda || '').toLowerCase();
          break;
        case 'estoque':
          valueA = a.estoque_atual;
          valueB = b.estoque_atual;
          break;
        case 'consumo':
          valueA = isReal ? a.consumo_real_diario : (a.consumo_teorico_diario || 0);
          valueB = isReal ? b.consumo_real_diario : (b.consumo_teorico_diario || 0);
          break;
        case 'dias':
          valueA = isReal ? a.dias_restantes_real : (a.dias_restantes_teorico || 999);
          valueB = isReal ? b.dias_restantes_real : (b.dias_restantes_teorico || 999);
          break;
        case 'data_pedido':
          valueA = isReal ? (a.data_pedido_real?.getTime() || 0) : (a.data_pedido_teorico?.getTime() || 0);
          valueB = isReal ? (b.data_pedido_real?.getTime() || 0) : (b.data_pedido_teorico?.getTime() || 0);
          break;
        case 'data_esgotamento':
          valueA = isReal ? (a.data_esgotamento_real?.getTime() || 0) : (a.data_esgotamento_teorico?.getTime() || 0);
          valueB = isReal ? (b.data_esgotamento_real?.getTime() || 0) : (b.data_esgotamento_teorico?.getTime() || 0);
          break;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return data;
  }, [previsaoData, selectedProdutoId, search, sortColumn, sortDirection, viewMode]);

  // Summary counts based on view mode
  const summary = useMemo(() => {
    const data = previsaoData.filter(item => item.produto_id === selectedProdutoId);
    const statusKey = viewMode === 'real' ? 'status_real' : 'status_teorico';
    return {
      critico: data.filter(d => d[statusKey] === 'critico').length,
      atencao: data.filter(d => d[statusKey] === 'atencao').length,
      ok: data.filter(d => d[statusKey] === 'ok').length,
      total: data.length,
    };
  }, [previsaoData, selectedProdutoId, viewMode]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const getStatusBadge = (status: 'critico' | 'atencao' | 'ok') => {
    switch (status) {
      case 'critico':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Crítico
          </Badge>
        );
      case 'atencao':
        return (
          <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600 bg-yellow-50">
            <AlertTriangle className="h-3 w-3" />
            Atenção
          </Badge>
        );
      case 'ok':
        return (
          <Badge variant="outline" className="gap-1 border-green-500 text-green-600 bg-green-50">
            <CheckCircle className="h-3 w-3" />
            OK
          </Badge>
        );
    }
  };

  const isLoading = isLoadingProdutos || loadingAfericoes;

  // Helper to get the correct values based on view mode
  const getValue = (item: PrevisaoItem, field: 'consumo' | 'dias' | 'data_pedido' | 'data_esgotamento' | 'status') => {
    if (viewMode === 'real') {
      switch (field) {
        case 'consumo': return item.consumo_real_diario;
        case 'dias': return item.dias_restantes_real;
        case 'data_pedido': return item.data_pedido_real;
        case 'data_esgotamento': return item.data_esgotamento_real;
        case 'status': return item.status_real;
      }
    } else {
      switch (field) {
        case 'consumo': return item.consumo_teorico_diario;
        case 'dias': return item.dias_restantes_teorico;
        case 'data_pedido': return item.data_pedido_teorico;
        case 'data_esgotamento': return item.data_esgotamento_teorico;
        case 'status': return item.status_teorico;
      }
    }
  };

  const isPastDate = (date: Date | null) => {
    if (!date) return false;
    return date < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6" />
            Previsão de Envios
          </h1>
          <p className="text-muted-foreground">Fazendas que precisam de reposição nos próximos 30 dias</p>
        </div>

        <div className="flex gap-2">
          {produtos?.map((produto, index) => {
            const style = productStyles[index % productStyles.length];
            const Icon = style.icon;
            const isSelected = selectedProdutoId === produto.id;
            
            return (
              <Button
                key={produto.id}
                variant="outline"
                onClick={() => setSelectedProdutoId(produto.id)}
                disabled={isLoadingProdutos}
                className={`gap-2 transition-all duration-200 ${isSelected ? style.activeClass : style.inactiveClass}`}
              >
                <Icon className="h-4 w-4" />
                {produto.nome}
              </Button>
            );
          })}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Baseado em:</span>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="real" className="gap-2">
              <Calendar className="h-4 w-4" />
              Consumo Real
            </TabsTrigger>
            <TabsTrigger value="teorico" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Consumo Teórico
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-xs text-muted-foreground">
          {viewMode === 'real' ? '(baseado no histórico de aferições)' : '(baseado em vacas × taxa de consumo)'}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700">{summary.critico}</p>
              <p className="text-sm text-red-600">Crítico (&lt;15 dias)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{summary.atencao}</p>
              <p className="text-sm text-yellow-600">Atenção (&lt;30 dias)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-700">{summary.ok}</p>
              <p className="text-sm text-green-600">OK (&gt;30 dias)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-sm text-muted-foreground">Total de fazendas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Fazendas com Necessidade de Envio
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar fazenda..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma fazenda encontrada com dados de consumo
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('cliente')} className="h-auto p-0 font-medium hover:bg-transparent">
                        Produtor {getSortIcon('cliente')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('fazenda')} className="h-auto p-0 font-medium hover:bg-transparent">
                        Fazenda {getSortIcon('fazenda')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" onClick={() => handleSort('estoque')} className="h-auto p-0 font-medium hover:bg-transparent">
                        Estoque (L) {getSortIcon('estoque')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" onClick={() => handleSort('consumo')} className="h-auto p-0 font-medium hover:bg-transparent">
                        Consumo/Dia {getSortIcon('consumo')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" onClick={() => handleSort('dias')} className="h-auto p-0 font-medium hover:bg-transparent">
                        Dias Restantes {getSortIcon('dias')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('data_pedido')} className="h-auto p-0 font-medium hover:bg-transparent">
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Data Pedido {getSortIcon('data_pedido')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('data_esgotamento')} className="h-auto p-0 font-medium hover:bg-transparent">
                        Data Esgotamento {getSortIcon('data_esgotamento')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Vacas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => {
                    const status = getValue(item, 'status') as 'critico' | 'atencao' | 'ok';
                    const consumo = getValue(item, 'consumo') as number | null;
                    const dias = getValue(item, 'dias') as number | null;
                    const dataPedido = getValue(item, 'data_pedido') as Date | null;
                    const dataEsgotamento = getValue(item, 'data_esgotamento') as Date | null;
                    const pedidoAtrasado = isPastDate(dataPedido);
                    
                    return (
                      <TableRow 
                        key={`${item.cliente_id}-${item.produto_id}`} 
                        className={status === 'critico' ? 'bg-red-50/50' : status === 'atencao' ? 'bg-yellow-50/50' : ''}
                      >
                        <TableCell>{getStatusBadge(status)}</TableCell>
                        <TableCell className="font-medium">{item.cliente_nome}</TableCell>
                        <TableCell className="text-muted-foreground">{item.cliente_fazenda || '-'}</TableCell>
                        <TableCell className="text-right font-mono">{item.estoque_atual}</TableCell>
                        <TableCell className="text-right font-mono">
                          {consumo ? `${consumo} L` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {dias && dias < 999 ? (
                            <span className={`font-bold ${dias <= 15 ? 'text-red-600' : dias <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                              {dias} dias
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {dataPedido ? (
                            <span className={`font-medium ${pedidoAtrasado ? 'text-red-600 font-bold' : ''}`}>
                              {pedidoAtrasado && <AlertCircle className="h-3 w-3 inline mr-1" />}
                              {format(dataPedido, "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {dataEsgotamento ? (
                            <span className={status === 'critico' ? 'text-red-600 font-medium' : ''}>
                              {format(dataEsgotamento, "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.vacas_lactacao || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
