import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Beaker, TrendingDown, Calendar, Loader2, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const VOLUME_GALAO = 50;

interface ConsumoCliente {
  cliente_id: string;
  cliente_nome: string;
  cliente_fazenda: string;
  data_inicial: string;
  data_final: string;
  dias_periodo: number;
  estoque_inicial: number;
  estoque_final: number;
  envios: number;
  consumo: number;
  consumo_30dias: number;
}

type SortColumn = 'cliente' | 'fazenda' | 'periodo' | 'dias' | 'estoque_inicial' | 'envios' | 'estoque_final' | 'consumo' | 'consumo_30dias';
type SortDirection = 'asc' | 'desc' | null;

interface Filters {
  cliente: string;
  fazenda: string;
}

export default function ProdutoDetalhe() {
  const { produtoId } = useParams<{ produtoId: string }>();
  const [filters, setFilters] = useState<Filters>({ cliente: '', fazenda: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const { data: produto, isLoading: loadingProduto } = useQuery({
    queryKey: ['produto', produtoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_quimicos')
        .select('*')
        .eq('id', produtoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!produtoId,
  });

  const { data: afericoes, isLoading: loadingAfericoes } = useQuery({
    queryKey: ['afericoes-produto', produtoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_cliente')
        .select(`
          *,
          clientes(nome, fazenda)
        `)
        .eq('produto_id', produtoId)
        .order('data_afericao', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!produtoId,
  });

  const { data: envios, isLoading: loadingEnvios } = useQuery({
    queryKey: ['envios-produto', produtoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('envios_produtos')
        .select('*')
        .eq('produto_id', produtoId)
        .order('data_envio', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!produtoId,
  });

  const calcularTotalLitros = (galoesCheios: number, nivelParcial: number | null) => {
    const cheios = galoesCheios * VOLUME_GALAO;
    const parcial = nivelParcial !== null ? (nivelParcial / 100) * VOLUME_GALAO : 0;
    return cheios + parcial;
  };

  // Calcula consumo por cliente
  const consumoData = useMemo(() => {
    if (!afericoes || !envios) return [];

    // Agrupa aferições por cliente
    const afericoesPorCliente: Record<string, Array<{
      data: string;
      cliente_nome: string;
      cliente_fazenda: string;
      estoque: number;
    }>> = {};

    afericoes.forEach(af => {
      if (!afericoesPorCliente[af.cliente_id]) {
        afericoesPorCliente[af.cliente_id] = [];
      }
      
      afericoesPorCliente[af.cliente_id].push({
        data: af.data_afericao,
        cliente_nome: af.clientes?.nome || '',
        cliente_fazenda: af.clientes?.fazenda || '',
        estoque: calcularTotalLitros(af.galoes_cheios, af.nivel_galao_parcial),
      });
    });

    // Ordena por data e remove duplicatas (mesma data)
    Object.keys(afericoesPorCliente).forEach(clienteId => {
      const uniqueDates = new Map<string, typeof afericoesPorCliente[string][0]>();
      afericoesPorCliente[clienteId].forEach(af => {
        if (!uniqueDates.has(af.data)) {
          uniqueDates.set(af.data, af);
        }
      });
      afericoesPorCliente[clienteId] = Array.from(uniqueDates.values())
        .sort((a, b) => a.data.localeCompare(b.data));
    });

    // Agrupa envios por cliente
    const enviosPorCliente: Record<string, Array<{ data: string; quantidade: number }>> = {};
    envios.forEach(env => {
      if (!enviosPorCliente[env.cliente_id]) {
        enviosPorCliente[env.cliente_id] = [];
      }
      enviosPorCliente[env.cliente_id].push({
        data: env.data_envio,
        quantidade: env.quantidade,
      });
    });

    // Calcula consumo entre aferições consecutivas
    const result: ConsumoCliente[] = [];

    Object.entries(afericoesPorCliente).forEach(([clienteId, afs]) => {
      for (let i = 1; i < afs.length; i++) {
        const anterior = afs[i - 1];
        const atual = afs[i];

        const diasPeriodo = differenceInDays(parseISO(atual.data), parseISO(anterior.data));

        // Soma envios no período
        let totalEnvios = 0;
        const enviosCliente = enviosPorCliente[clienteId] || [];
        enviosCliente.forEach(env => {
          if (env.data > anterior.data && env.data <= atual.data) {
            totalEnvios += env.quantidade;
          }
        });

        // Consumo = Estoque Inicial + Envios - Estoque Final
        const consumo = anterior.estoque + totalEnvios - atual.estoque;
        const consumoPositivo = Math.max(0, consumo);
        const consumo30dias = diasPeriodo > 0 ? Math.round((consumoPositivo / diasPeriodo) * 30) : 0;

        result.push({
          cliente_id: clienteId,
          cliente_nome: atual.cliente_nome,
          cliente_fazenda: atual.cliente_fazenda,
          data_inicial: anterior.data,
          data_final: atual.data,
          dias_periodo: diasPeriodo,
          estoque_inicial: anterior.estoque,
          estoque_final: atual.estoque,
          envios: totalEnvios,
          consumo: consumoPositivo,
          consumo_30dias: consumo30dias,
        });
      }
    });

    return result.sort((a, b) => b.data_final.localeCompare(a.data_final));
  }, [afericoes, envios]);

  // Filtra e ordena
  const consumoFiltrado = useMemo(() => {
    let lista = [...consumoData];

    if (filters.cliente) {
      lista = lista.filter(c => 
        c.cliente_nome.toLowerCase().includes(filters.cliente.toLowerCase())
      );
    }
    if (filters.fazenda) {
      lista = lista.filter(c => 
        c.cliente_fazenda?.toLowerCase().includes(filters.fazenda.toLowerCase())
      );
    }

    if (sortColumn && sortDirection) {
      lista.sort((a, b) => {
        let valueA: string | number = '';
        let valueB: string | number = '';

        switch (sortColumn) {
          case 'cliente':
            valueA = a.cliente_nome.toLowerCase();
            valueB = b.cliente_nome.toLowerCase();
            break;
          case 'fazenda':
            valueA = (a.cliente_fazenda || '').toLowerCase();
            valueB = (b.cliente_fazenda || '').toLowerCase();
            break;
          case 'periodo':
            valueA = a.data_final;
            valueB = b.data_final;
            break;
          case 'dias':
            valueA = a.dias_periodo;
            valueB = b.dias_periodo;
            break;
          case 'estoque_inicial':
            valueA = a.estoque_inicial;
            valueB = b.estoque_inicial;
            break;
          case 'envios':
            valueA = a.envios;
            valueB = b.envios;
            break;
          case 'estoque_final':
            valueA = a.estoque_final;
            valueB = b.estoque_final;
            break;
          case 'consumo':
            valueA = a.consumo;
            valueB = b.consumo;
            break;
          case 'consumo_30dias':
            valueA = a.consumo_30dias;
            valueB = b.consumo_30dias;
            break;
        }

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return lista;
  }, [consumoData, filters, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const clearFilters = () => {
    setFilters({ cliente: '', fazenda: '' });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const isLoading = loadingProduto || loadingAfericoes || loadingEnvios;

  // Totais (dos filtrados)
  const totais = useMemo(() => {
    const totalConsumo = consumoFiltrado.reduce((acc, c) => acc + c.consumo, 0);
    const totalConsumo30dias = consumoFiltrado.length > 0
      ? Math.round(consumoFiltrado.reduce((acc, c) => acc + c.consumo_30dias, 0) / consumoFiltrado.length)
      : 0;
    const totalEnvios = consumoFiltrado.reduce((acc, c) => acc + c.envios, 0);
    return { totalConsumo, totalConsumo30dias, totalEnvios };
  }, [consumoFiltrado]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Link to="/estoque">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div className="text-center py-8 text-muted-foreground">
          Produto não encontrado.
        </div>
      </div>
    );
  }

  const SortableHeader = ({ column, children, className = '' }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-muted/50 select-none ${className}`}
      onClick={() => handleSort(column)}
    >
      <div className={`flex items-center ${className.includes('text-center') ? 'justify-center' : ''}`}>
        {children}
        {getSortIcon(column)}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/estoque">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Beaker className="h-6 w-6 text-primary" />
            {produto.nome}
          </h1>
          <p className="text-muted-foreground">{produto.descricao || 'Análise de consumo por cliente'}</p>
        </div>
      </div>

      {/* Tabela de consumo por cliente */}
      <Tabs defaultValue="periodo" className="w-full">
        <TabsList>
          <TabsTrigger value="periodo">Consumo no Período</TabsTrigger>
          <TabsTrigger value="30dias">Consumo/30 dias</TabsTrigger>
        </TabsList>

        <TabsContent value="periodo" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-primary" />
                  Consumo por Cliente
                  {consumoFiltrado.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({consumoFiltrado.length} períodos)
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Limpar filtros
                    </Button>
                  )}
                  <Button 
                    variant={showFilters ? "secondary" : "outline"} 
                    size="sm" 
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    Filtros
                  </Button>
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t mt-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Cliente</label>
                    <Input
                      placeholder="Filtrar..."
                      value={filters.cliente}
                      onChange={(e) => setFilters(f => ({ ...f, cliente: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Fazenda</label>
                    <Input
                      placeholder="Filtrar..."
                      value={filters.fazenda}
                      onChange={(e) => setFilters(f => ({ ...f, fazenda: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {consumoFiltrado.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{hasActiveFilters ? 'Nenhum resultado com os filtros aplicados.' : 'Nenhum dado de consumo disponível.'}</p>
                  {!hasActiveFilters && (
                    <p className="text-sm mt-2">
                      São necessárias pelo menos 2 aferições do mesmo cliente.
                    </p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader column="cliente">Cliente</SortableHeader>
                      <SortableHeader column="fazenda">Fazenda</SortableHeader>
                      <SortableHeader column="periodo">Período</SortableHeader>
                      <SortableHeader column="dias" className="text-center">Dias</SortableHeader>
                      <SortableHeader column="estoque_inicial" className="text-center">Estoque Inicial</SortableHeader>
                      <SortableHeader column="envios" className="text-center">Envios</SortableHeader>
                      <SortableHeader column="estoque_final" className="text-center">Estoque Final</SortableHeader>
                      <SortableHeader column="consumo" className="text-center">Consumo</SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumoFiltrado.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.cliente_nome}</TableCell>
                        <TableCell>{item.cliente_fazenda || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(parseISO(item.data_inicial), 'dd/MM', { locale: ptBR })}
                            {' → '}
                            {format(parseISO(item.data_final), 'dd/MM/yy', { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.dias_periodo}</TableCell>
                        <TableCell className="text-center">{item.estoque_inicial}L</TableCell>
                        <TableCell className="text-center text-green-600">
                          {item.envios > 0 ? `+${item.envios}L` : '-'}
                        </TableCell>
                        <TableCell className="text-center">{item.estoque_final}L</TableCell>
                        <TableCell className="text-center font-medium text-destructive">
                          -{item.consumo}L
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={3}>Total ({consumoFiltrado.length} períodos)</TableCell>
                      <TableCell className="text-center">
                        {Math.round(consumoFiltrado.reduce((acc, c) => acc + c.dias_periodo, 0) / consumoFiltrado.length || 0)} média
                      </TableCell>
                      <TableCell className="text-center">-</TableCell>
                      <TableCell className="text-center text-green-600 font-medium">
                        +{totais.totalEnvios}L
                      </TableCell>
                      <TableCell className="text-center">-</TableCell>
                      <TableCell className="text-center font-bold text-destructive">
                        -{totais.totalConsumo}L
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="30dias" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-primary" />
                  Consumo Padronizado (30 dias)
                  {consumoFiltrado.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({consumoFiltrado.length} períodos)
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Limpar filtros
                    </Button>
                  )}
                  <Button 
                    variant={showFilters ? "secondary" : "outline"} 
                    size="sm" 
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    Filtros
                  </Button>
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t mt-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Cliente</label>
                    <Input
                      placeholder="Filtrar..."
                      value={filters.cliente}
                      onChange={(e) => setFilters(f => ({ ...f, cliente: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Fazenda</label>
                    <Input
                      placeholder="Filtrar..."
                      value={filters.fazenda}
                      onChange={(e) => setFilters(f => ({ ...f, fazenda: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {consumoFiltrado.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{hasActiveFilters ? 'Nenhum resultado com os filtros aplicados.' : 'Nenhum dado de consumo disponível.'}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader column="cliente">Cliente</SortableHeader>
                      <SortableHeader column="fazenda">Fazenda</SortableHeader>
                      <SortableHeader column="periodo">Período</SortableHeader>
                      <SortableHeader column="dias" className="text-center">Dias</SortableHeader>
                      <SortableHeader column="consumo" className="text-center">Consumo Real</SortableHeader>
                      <SortableHeader column="consumo_30dias" className="text-center">Consumo/30 dias</SortableHeader>
                      <TableHead className="text-center">Orçado</TableHead>
                      <TableHead className="text-center">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumoFiltrado.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.cliente_nome}</TableCell>
                        <TableCell>{item.cliente_fazenda || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(parseISO(item.data_inicial), 'dd/MM', { locale: ptBR })}
                            {' → '}
                            {format(parseISO(item.data_final), 'dd/MM/yy', { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.dias_periodo}</TableCell>
                        <TableCell className="text-center">{item.consumo}L</TableCell>
                        <TableCell className="text-center font-medium text-destructive">
                          -{item.consumo_30dias}L
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          -
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          -
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={3}>Total / Média ({consumoFiltrado.length} períodos)</TableCell>
                      <TableCell className="text-center">
                        {Math.round(consumoFiltrado.reduce((acc, c) => acc + c.dias_periodo, 0) / consumoFiltrado.length || 0)} média
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {totais.totalConsumo}L
                      </TableCell>
                      <TableCell className="text-center font-bold text-destructive">
                        -{totais.totalConsumo30dias}L
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">-</TableCell>
                      <TableCell className="text-center text-muted-foreground">-</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
