import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingDown, Loader2, Calendar, X, ArrowUpDown, ArrowUp, ArrowDown, Users } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const VOLUME_GALAO = 50;

interface ProdutoInfo {
  id: string;
  nome: string;
  litros_por_vaca_mes: number | null;
  litros_por_vaca_2x: number | null;
  litros_por_vaca_3x: number | null;
}

interface ConsumoItem {
  cliente_id: string;
  cliente_nome: string;
  cliente_fazenda: string;
  data_inicial: string;
  data_final: string;
  dias_periodo: number;
  vacas_lactacao: number | null;
  produtos: Record<string, {
    estoque_inicial: number;
    estoque_final: number;
    envios: number;
    consumo: number;
    consumo_30dias: number;
    orcado_30dias: number | null;
  }>;
}

type SortColumn = 'cliente' | 'fazenda' | 'periodo' | string;
type SortDirection = 'asc' | 'desc' | null;

type ViewMode = 'periodo' | '30dias';

interface ConsumoTabProps {
  produtoId?: string;
}

export function ConsumoTab({ produtoId }: ConsumoTabProps) {
  const [filters, setFilters] = useState({
    cliente: '',
    fazenda: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('periodo');
  const [apenasUltimaMedida, setApenasUltimaMedida] = useState(false);

  const { data: produtos } = useQuery({
    queryKey: ['produtos-quimicos-consumo', produtoId],
    queryFn: async () => {
      let query = supabase.from('produtos_quimicos').select('id, nome, litros_por_vaca_mes, litros_por_vaca_2x, litros_por_vaca_3x').eq('ativo', true);
      if (produtoId) {
        query = query.eq('id', produtoId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as ProdutoInfo[];
    },
  });

  const { data: afericoes, isLoading: loadingAfericoes } = useQuery({
    queryKey: ['afericoes-consumo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_cliente')
        .select(`
          *,
          clientes(nome, fazenda, data_ativacao_rumiflow, ordenhas_dia)
        `)
        .order('data_afericao', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: envios, isLoading: loadingEnvios } = useQuery({
    queryKey: ['envios-consumo'],
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

  // Calcula consumo comparando aferições consecutivas por cliente
  const consumoData = useMemo(() => {
    if (!afericoes || !envios || !produtos) return [];

    // Agrupa aferições por cliente e data
    const afericoesPorCliente: Record<string, {
      data_ativacao: string | null;
      ordenhas_dia: number;
      afericoes: Array<{
        data: string;
        cliente_nome: string;
        cliente_fazenda: string;
        vacas_lactacao: number | null;
        produtos: Record<string, number>;
      }>;
    }> = {};

    afericoes.forEach(af => {
      if (!afericoesPorCliente[af.cliente_id]) {
        afericoesPorCliente[af.cliente_id] = {
          data_ativacao: af.clientes?.data_ativacao_rumiflow || null,
          ordenhas_dia: af.clientes?.ordenhas_dia || 3,
          afericoes: [],
        };
      }
      
      const dataKey = af.data_afericao;
      let entry = afericoesPorCliente[af.cliente_id].afericoes.find(e => e.data === dataKey);
      
      if (!entry) {
        entry = {
          data: dataKey,
          cliente_nome: af.clientes?.nome || '',
          cliente_fazenda: af.clientes?.fazenda || '',
          vacas_lactacao: af.vacas_lactacao,
          produtos: {},
        };
        afericoesPorCliente[af.cliente_id].afericoes.push(entry);
      }
      
      // Atualiza vacas se tiver valor
      if (af.vacas_lactacao !== null) {
        entry.vacas_lactacao = af.vacas_lactacao;
      }
      
      entry.produtos[af.produto_id] = calcularTotalLitros(af.galoes_cheios, af.nivel_galao_parcial);
    });

    // Ordena por data
    Object.keys(afericoesPorCliente).forEach(clienteId => {
      afericoesPorCliente[clienteId].afericoes.sort((a, b) => a.data.localeCompare(b.data));
    });

    // Agrupa envios por cliente e produto
    const enviosPorClienteProduto: Record<string, Record<string, Array<{ data: string; quantidade: number }>>> = {};
    
    envios.forEach(env => {
      if (!enviosPorClienteProduto[env.cliente_id]) {
        enviosPorClienteProduto[env.cliente_id] = {};
      }
      if (!enviosPorClienteProduto[env.cliente_id][env.produto_id]) {
        enviosPorClienteProduto[env.cliente_id][env.produto_id] = [];
      }
      enviosPorClienteProduto[env.cliente_id][env.produto_id].push({
        data: env.data_envio,
        quantidade: env.quantidade,
      });
    });

    // Calcula consumo entre aferições consecutivas
    const result: ConsumoItem[] = [];

    Object.entries(afericoesPorCliente).forEach(([clienteId, clienteData]) => {
      const afs = clienteData.afericoes;
      const dataAtivacao = clienteData.data_ativacao;
      const ordenhas = clienteData.ordenhas_dia;
      
      // Primeiro registro: usa data de ativação como estoque inicial
      if (afs.length > 0 && dataAtivacao) {
        const primeiraAfericao = afs[0];
        
        // Só cria o registro inicial se a data de ativação for anterior à primeira aferição
        if (dataAtivacao < primeiraAfericao.data) {
          const diasPeriodoInicial = differenceInDays(parseISO(primeiraAfericao.data), parseISO(dataAtivacao));

          const consumoItemInicial: ConsumoItem = {
            cliente_id: clienteId,
            cliente_nome: primeiraAfericao.cliente_nome,
            cliente_fazenda: primeiraAfericao.cliente_fazenda,
            data_inicial: dataAtivacao,
            data_final: primeiraAfericao.data,
            dias_periodo: diasPeriodoInicial,
            vacas_lactacao: primeiraAfericao.vacas_lactacao,
            produtos: {},
          };

          produtos.forEach(produto => {
            // Estoque inicial = 0 (antes de qualquer envio)
            const estoqueInicial = 0;
            const estoqueFinal = primeiraAfericao.produtos[produto.id] || 0;

            // Soma todos os envios até a primeira aferição (inclusive envios antes da ativação)
            let totalEnvios = 0;
            const enviosProduto = enviosPorClienteProduto[clienteId]?.[produto.id] || [];
            enviosProduto.forEach(env => {
              if (env.data <= primeiraAfericao.data) {
                totalEnvios += env.quantidade;
              }
            });

            // Consumo = Envios - Estoque Final
            const consumo = totalEnvios - estoqueFinal;
            const consumoPositivo = Math.max(0, consumo);

            // Consumo padronizado para 30 dias
            const consumo30dias = diasPeriodoInicial > 0 ? Math.round((consumoPositivo / diasPeriodoInicial) * 30) : 0;

            // Orçado = vacas * litros_por_vaca (baseado em ordenhas)
            const litrosPorVaca = ordenhas === 3 ? produto.litros_por_vaca_3x : produto.litros_por_vaca_2x;
            const orcado30dias = (primeiraAfericao.vacas_lactacao && litrosPorVaca) 
              ? Math.round(primeiraAfericao.vacas_lactacao * litrosPorVaca)
              : null;

            consumoItemInicial.produtos[produto.id] = {
              estoque_inicial: estoqueInicial,
              estoque_final: estoqueFinal,
              envios: totalEnvios,
              consumo: consumoPositivo,
              consumo_30dias: consumo30dias,
              orcado_30dias: orcado30dias,
            };
          });

          result.push(consumoItemInicial);
        }
      }

      // Aferições consecutivas (a partir da segunda)
      for (let i = 1; i < afs.length; i++) {
        const anterior = afs[i - 1];
        const atual = afs[i];

        // Calcula dias entre as aferições
        const diasPeriodo = differenceInDays(parseISO(atual.data), parseISO(anterior.data));

        const consumoItem: ConsumoItem = {
          cliente_id: clienteId,
          cliente_nome: atual.cliente_nome,
          cliente_fazenda: atual.cliente_fazenda,
          data_inicial: anterior.data,
          data_final: atual.data,
          dias_periodo: diasPeriodo,
          vacas_lactacao: atual.vacas_lactacao,
          produtos: {},
        };

        produtos.forEach(produto => {
          const estoqueInicial = anterior.produtos[produto.id] || 0;
          const estoqueFinal = atual.produtos[produto.id] || 0;

          // Soma envios no período
          let totalEnvios = 0;
          const enviosProduto = enviosPorClienteProduto[clienteId]?.[produto.id] || [];
          enviosProduto.forEach(env => {
            if (env.data > anterior.data && env.data <= atual.data) {
              totalEnvios += env.quantidade;
            }
          });

          // Consumo = Estoque Inicial + Envios - Estoque Final
          const consumo = estoqueInicial + totalEnvios - estoqueFinal;
          const consumoPositivo = Math.max(0, consumo);

          // Consumo padronizado para 30 dias
          const consumo30dias = diasPeriodo > 0 ? Math.round((consumoPositivo / diasPeriodo) * 30) : 0;

          // Orçado = vacas * litros_por_vaca (baseado em ordenhas)
          const litrosPorVaca = ordenhas === 3 ? produto.litros_por_vaca_3x : produto.litros_por_vaca_2x;
          const orcado30dias = (atual.vacas_lactacao && litrosPorVaca) 
            ? Math.round(atual.vacas_lactacao * litrosPorVaca)
            : null;

          consumoItem.produtos[produto.id] = {
            estoque_inicial: estoqueInicial,
            estoque_final: estoqueFinal,
            envios: totalEnvios,
            consumo: consumoPositivo,
            consumo_30dias: consumo30dias,
            orcado_30dias: orcado30dias,
          };
        });

        result.push(consumoItem);
      }
    });

    return result;
  }, [afericoes, envios, produtos]);

  // Filtra e ordena
  const consumoFiltrado = useMemo(() => {
    let lista = [...consumoData];

    // Filtro "Última Medida" - mantém apenas o registro mais recente de cada cliente
    if (apenasUltimaMedida) {
      const ultimaPorCliente: Record<string, ConsumoItem> = {};
      lista.forEach(item => {
        const existing = ultimaPorCliente[item.cliente_id];
        if (!existing || item.data_final > existing.data_final) {
          ultimaPorCliente[item.cliente_id] = item;
        }
      });
      lista = Object.values(ultimaPorCliente);
    }

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

        if (sortColumn === 'cliente') {
          valueA = a.cliente_nome.toLowerCase();
          valueB = b.cliente_nome.toLowerCase();
        } else if (sortColumn === 'fazenda') {
          valueA = (a.cliente_fazenda || '').toLowerCase();
          valueB = (b.cliente_fazenda || '').toLowerCase();
        } else if (sortColumn === 'periodo') {
          valueA = a.data_final;
          valueB = b.data_final;
        } else if (sortColumn === 'dias') {
          valueA = a.dias_periodo;
          valueB = b.dias_periodo;
        } else {
          // É um produto - ordenar por consumo ou consumo/30 dias
          if (viewMode === '30dias') {
            valueA = a.produtos[sortColumn]?.consumo_30dias || 0;
            valueB = b.produtos[sortColumn]?.consumo_30dias || 0;
          } else {
            valueA = a.produtos[sortColumn]?.consumo || 0;
            valueB = b.produtos[sortColumn]?.consumo || 0;
          }
        }

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return lista;
  }, [consumoData, filters, sortColumn, sortDirection, viewMode, apenasUltimaMedida]);

  // Calcula totais
  const totais = useMemo(() => {
    if (!produtos || consumoFiltrado.length === 0) return null;
    
    const result: Record<string, { orcado: number; realizado: number; desvioL: number; desvioP: number | null }> = {};
    
    produtos.forEach(produto => {
      let totalOrcado = 0;
      let totalRealizado = 0;
      
      consumoFiltrado.forEach(item => {
        const dados = item.produtos[produto.id];
        if (dados) {
          if (viewMode === 'periodo') {
            totalRealizado += dados.consumo;
            if (dados.orcado_30dias !== null && dados.orcado_30dias !== undefined) {
              totalOrcado += Math.round(dados.orcado_30dias * (item.dias_periodo / 30));
            }
          } else {
            totalRealizado += dados.consumo_30dias;
            if (dados.orcado_30dias !== null && dados.orcado_30dias !== undefined) {
              totalOrcado += dados.orcado_30dias;
            }
          }
        }
      });
      
      const desvioL = totalRealizado - totalOrcado;
      const desvioP = totalOrcado > 0 ? Math.round((desvioL / totalOrcado) * 100) : null;
      
      result[produto.id] = {
        orcado: totalOrcado,
        realizado: totalRealizado,
        desvioL,
        desvioP
      };
    });
    
    return result;
  }, [consumoFiltrado, produtos, viewMode]);

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

  const hasActiveFilters = filters.cliente !== '' || filters.fazenda !== '';
  
  // Contador de fazendas únicas
  const totalFazendas = useMemo(() => {
    const clientesUnicos = new Set(consumoFiltrado.map(c => c.cliente_id));
    return clientesUnicos.size;
  }, [consumoFiltrado]);
  const isLoading = loadingAfericoes || loadingEnvios;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            Análise de Consumo
            {consumoFiltrado.length > 0 && (
              <div className="flex items-center gap-3 text-sm font-normal text-muted-foreground">
                <span>{consumoFiltrado.length} períodos</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {totalFazendas} fazendas
                </span>
              </div>
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

        <div className="flex items-center justify-between gap-4 pt-4 border-t mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Visualização:</span>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="periodo" className="text-xs px-3 h-7">
                  Consumo no Período
                </TabsTrigger>
                <TabsTrigger value="30dias" className="text-xs px-3 h-7">
                  Consumo em 30d
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Button
            variant={apenasUltimaMedida ? "default" : "outline"}
            size="sm"
            onClick={() => setApenasUltimaMedida(!apenasUltimaMedida)}
            className="h-8 text-xs"
          >
            <Calendar className="h-3 w-3 mr-1" />
            Última Medida
          </Button>
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
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : consumoFiltrado.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum dado de consumo disponível.</p>
            <p className="text-sm mt-2">
              São necessárias pelo menos 2 aferições do mesmo cliente para calcular o consumo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('cliente')}
                  >
                    <div className="flex items-center">
                      Cliente
                      {getSortIcon('cliente')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('fazenda')}
                  >
                    <div className="flex items-center">
                      Fazenda
                      {getSortIcon('fazenda')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('periodo')}
                  >
                    <div className="flex items-center">
                      Período
                      {getSortIcon('periodo')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none text-center"
                    onClick={() => handleSort('dias')}
                  >
                    <div className="flex items-center justify-center">
                      Dias
                      {getSortIcon('dias')}
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center">
                      Vacas
                    </div>
                  </TableHead>
                  {produtos?.map((produto) => (
                    <>
                      <TableHead key={`${produto.id}-orc`} className="text-center text-xs border-l">
                        Orçado
                      </TableHead>
                      <TableHead 
                        key={`${produto.id}-real`} 
                        className="text-center text-xs"
                      >
                        Realizado
                      </TableHead>
                      <TableHead 
                        key={`${produto.id}-desv-l`} 
                        className="text-center text-xs"
                      >
                        Desvio (L)
                      </TableHead>
                      <TableHead 
                        key={`${produto.id}-desv-p`} 
                        className="text-center text-xs cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort(produto.id)}
                      >
                        <div className="flex items-center justify-center">
                          %
                          {getSortIcon(produto.id)}
                        </div>
                      </TableHead>
                    </>
                  ))}
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
                        <span>
                          {format(parseISO(item.data_inicial), 'dd/MM', { locale: ptBR })}
                          {' → '}
                          <span className="bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded">
                            {format(parseISO(item.data_final), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-medium">{item.dias_periodo}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm">{item.vacas_lactacao || '-'}</span>
                    </TableCell>
                    {produtos?.map((produto) => {
                      const dados = item.produtos[produto.id];
                      
                      // Calcula orçado e desvio baseado no modo de visualização
                      let orcadoExibir: number | null = null;
                      let consumoExibir: number = 0;
                      let desvioLitros: number | null = null;
                      let desvioPercent: number | null = null;
                      
                      if (dados) {
                        if (viewMode === 'periodo') {
                          // No modo período: orçado proporcional aos dias
                          consumoExibir = dados.consumo;
                          if (dados.orcado_30dias !== null && dados.orcado_30dias !== undefined) {
                            orcadoExibir = Math.round(dados.orcado_30dias * (item.dias_periodo / 30));
                            desvioLitros = consumoExibir - orcadoExibir;
                            desvioPercent = orcadoExibir > 0 
                              ? Math.round((desvioLitros / orcadoExibir) * 100)
                              : null;
                          }
                        } else {
                          // No modo 30 dias: valores normalizados
                          consumoExibir = dados.consumo_30dias;
                          orcadoExibir = dados.orcado_30dias;
                          if (orcadoExibir !== null && orcadoExibir !== undefined) {
                            desvioLitros = consumoExibir - orcadoExibir;
                            desvioPercent = orcadoExibir > 0 
                              ? Math.round((desvioLitros / orcadoExibir) * 100)
                              : null;
                          }
                        }
                      }
                      
                      // Cores do semáforo
                      const getSemaforoColor = (desvio: number | null) => {
                        if (desvio === null) return 'bg-muted text-muted-foreground';
                        if (desvio <= 0) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                        if (desvio <= 20) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
                        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                      };
                      
                      return (
                        <>
                          <TableCell key={`${produto.id}-orc`} className="text-center border-l">
                            {orcadoExibir !== null ? (
                              <span className="text-sm text-muted-foreground">{orcadoExibir}L</span>
                            ) : '-'}
                          </TableCell>
                          <TableCell key={`${produto.id}-real`} className="text-center">
                            {dados ? (
                              <span className="text-sm font-medium">{consumoExibir}L</span>
                            ) : '-'}
                          </TableCell>
                          <TableCell key={`${produto.id}-desv-l`} className="text-center">
                            {desvioLitros !== null ? (
                              <span className="text-sm">
                                {desvioLitros > 0 ? '+' : ''}{desvioLitros}L
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell key={`${produto.id}-desv-p`} className="text-center">
                            {desvioPercent !== null ? (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getSemaforoColor(desvioPercent)}`}>
                                {desvioPercent > 0 ? '+' : ''}{desvioPercent}%
                              </span>
                            ) : '-'}
                          </TableCell>
                        </>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
              {totais && (
                <tfoot className="border-t-2 bg-muted/50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 font-semibold text-sm">
                      Total ({consumoFiltrado.length} períodos)
                    </td>
                    {produtos?.map((produto) => {
                      const dados = totais[produto.id];
                      const getSemaforoColor = (desvio: number | null) => {
                        if (desvio === null) return 'bg-muted text-muted-foreground';
                        if (desvio <= 0) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                        if (desvio <= 20) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
                        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                      };
                      
                      return (
                        <>
                          <td key={`${produto.id}-orc-total`} className="px-4 py-3 text-center border-l">
                            <span className="text-sm font-medium text-muted-foreground">
                              {dados.orcado}L
                            </span>
                          </td>
                          <td key={`${produto.id}-real-total`} className="px-4 py-3 text-center">
                            <span className="text-sm font-semibold">
                              {dados.realizado}L
                            </span>
                          </td>
                          <td key={`${produto.id}-desv-l-total`} className="px-4 py-3 text-center">
                            <span className="text-sm font-medium">
                              {dados.desvioL > 0 ? '+' : ''}{dados.desvioL}L
                            </span>
                          </td>
                          <td key={`${produto.id}-desv-p-total`} className="px-4 py-3 text-center">
                            {dados.desvioP !== null ? (
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${getSemaforoColor(dados.desvioP)}`}>
                                {dados.desvioP > 0 ? '+' : ''}{dados.desvioP}%
                              </span>
                            ) : '-'}
                          </td>
                        </>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
