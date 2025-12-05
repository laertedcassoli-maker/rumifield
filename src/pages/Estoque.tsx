import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Beaker, Loader2, Plus, Calendar, User, ArrowUpDown, ArrowUp, ArrowDown, X, TrendingDown, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NovaAfericaoDialog } from '@/components/estoque/NovaAfericaoDialog';
import { EditarAfericaoDialog } from '@/components/estoque/EditarAfericaoDialog';
import { ConsumoTab } from '@/components/estoque/ConsumoTab';

const VOLUME_GALAO = 50;

interface ProdutoInfo {
  id: string;
  nome: string;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'cliente' | 'fazenda' | 'data' | 'responsavel' | string;

interface Filters {
  cliente: string;
  fazenda: string;
  responsavel: string;
  dataInicio: string;
  dataFim: string;
}

interface AfericaoAgrupada {
  cliente_id: string;
  cliente_nome: string;
  cliente_fazenda: string;
  data_afericao: string;
  responsavel: string;
  data_atualizacao: string;
  produtosPorId: Record<string, { galoes_cheios: number; nivel_galao_parcial: number | null; quantidade: number }>;
}

export default function Estoque() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAfericao, setSelectedAfericao] = useState<AfericaoAgrupada | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [filters, setFilters] = useState<Filters>({
    cliente: '',
    fazenda: '',
    responsavel: '',
    dataInicio: '',
    dataFim: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data: produtos } = useQuery({
    queryKey: ['produtos-quimicos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos_quimicos').select('id, nome').eq('ativo', true);
      if (error) throw error;
      return data as ProdutoInfo[];
    },
  });

  const { data: afericoes, isLoading, refetch } = useQuery({
    queryKey: ['afericoes-estoque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_cliente')
        .select(`
          *,
          clientes(nome, fazenda),
          produtos_quimicos(id, nome)
        `)
        .order('data_afericao', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Agrupa aferições por cliente_id + data_afericao + responsavel
  const afericoesAgrupadas = useMemo(() => {
    return afericoes?.reduce((acc, item) => {
      const key = `${item.cliente_id}-${item.data_afericao}-${item.responsavel}`;
      if (!acc[key]) {
        acc[key] = {
          cliente_id: item.cliente_id,
          cliente_nome: item.clientes?.nome || '',
          cliente_fazenda: item.clientes?.fazenda || '',
          data_afericao: item.data_afericao,
          responsavel: item.responsavel,
          data_atualizacao: item.data_atualizacao,
          produtosPorId: {} as Record<string, { galoes_cheios: number; nivel_galao_parcial: number | null; quantidade: number }>,
        };
      }
      const produtoId = item.produtos_quimicos?.id || item.produto_id;
      acc[key].produtosPorId[produtoId] = {
        galoes_cheios: item.galoes_cheios,
        nivel_galao_parcial: item.nivel_galao_parcial,
        quantidade: item.quantidade,
      };
      return acc;
    }, {} as Record<string, {
      cliente_id: string;
      cliente_nome: string;
      cliente_fazenda: string;
      data_afericao: string;
      responsavel: string;
      data_atualizacao: string;
      produtosPorId: Record<string, { galoes_cheios: number; nivel_galao_parcial: number | null; quantidade: number }>;
    }>);
  }, [afericoes]);

  // Filtra e ordena os dados
  const listaAfericoes = useMemo(() => {
    let lista = Object.values(afericoesAgrupadas || {});

    // Aplicar filtros
    if (filters.cliente) {
      lista = lista.filter(a => 
        a.cliente_nome.toLowerCase().includes(filters.cliente.toLowerCase())
      );
    }
    if (filters.fazenda) {
      lista = lista.filter(a => 
        a.cliente_fazenda?.toLowerCase().includes(filters.fazenda.toLowerCase())
      );
    }
    if (filters.responsavel) {
      lista = lista.filter(a => a.responsavel === filters.responsavel);
    }
    if (filters.dataInicio) {
      lista = lista.filter(a => a.data_afericao >= filters.dataInicio);
    }
    if (filters.dataFim) {
      lista = lista.filter(a => a.data_afericao <= filters.dataFim);
    }

    // Aplicar ordenação
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
        } else if (sortColumn === 'data') {
          valueA = a.data_afericao || '';
          valueB = b.data_afericao || '';
        } else if (sortColumn === 'responsavel') {
          valueA = a.responsavel;
          valueB = b.responsavel;
        } else {
          // É um produto - ordenar por quantidade total
          const produtoA = a.produtosPorId[sortColumn];
          const produtoB = b.produtosPorId[sortColumn];
          valueA = produtoA ? calcularTotalLitros(produtoA.galoes_cheios, produtoA.nivel_galao_parcial) : 0;
          valueB = produtoB ? calcularTotalLitros(produtoB.galoes_cheios, produtoB.nivel_galao_parcial) : 0;
        }

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return lista;
  }, [afericoesAgrupadas, filters, sortColumn, sortDirection]);

  const calcularTotalLitros = (galoesCheios: number, nivelParcial: number | null) => {
    const cheios = galoesCheios * VOLUME_GALAO;
    const parcial = nivelParcial !== null ? (nivelParcial / 100) * VOLUME_GALAO : 0;
    return Math.round(cheios + parcial);
  };

  const formatarProduto = (dados: { galoes_cheios: number; nivel_galao_parcial: number | null } | undefined) => {
    if (!dados) return '-';
    const total = calcularTotalLitros(dados.galoes_cheios, dados.nivel_galao_parcial);
    return (
      <div className="text-sm">
        <div className="font-medium">{total}L</div>
        <div className="text-muted-foreground text-xs">
          {dados.galoes_cheios} galões
          {dados.nivel_galao_parcial !== null && ` + ${dados.nivel_galao_parcial}%`}
        </div>
      </div>
    );
  };

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
    setFilters({
      cliente: '',
      fazenda: '',
      responsavel: '',
      dataInicio: '',
      dataFim: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Controle de Estoque</h1>
          <p className="text-muted-foreground">Aferições e análise de consumo de produtos químicos</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Aferição
        </Button>
      </div>

      <Tabs defaultValue="afericoes" className="w-full">
        <TabsList>
          <TabsTrigger value="afericoes" className="flex items-center gap-2">
            <Beaker className="h-4 w-4" />
            Aferições
          </TabsTrigger>
          <TabsTrigger value="consumo" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Consumo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="afericoes" className="mt-4">

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Beaker className="h-5 w-5 text-primary" />
              Aferições Registradas
              {listaAfericoes.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({listaAfericoes.length} registros)
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

          {/* Filtros */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t mt-4">
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
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Responsável</label>
                <Select 
                  value={filters.responsavel} 
                  onValueChange={(v) => setFilters(f => ({ ...f, responsavel: v === 'all' ? '' : v }))}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Cliente">Cliente</SelectItem>
                    <SelectItem value="CSM">CSM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data início</label>
                <Input
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) => setFilters(f => ({ ...f, dataInicio: e.target.value }))}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data fim</label>
                <Input
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) => setFilters(f => ({ ...f, dataFim: e.target.value }))}
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
          ) : listaAfericoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {hasActiveFilters 
                ? 'Nenhuma aferição encontrada com os filtros aplicados.'
                : 'Nenhuma aferição registrada ainda.'
              }
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
                      onClick={() => handleSort('data')}
                    >
                      <div className="flex items-center">
                        Data Aferição
                        {getSortIcon('data')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('responsavel')}
                    >
                      <div className="flex items-center">
                        Responsável
                        {getSortIcon('responsavel')}
                      </div>
                    </TableHead>
                    {produtos?.map((produto) => (
                      <TableHead 
                        key={produto.id} 
                        className="text-center cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort(produto.id)}
                      >
                        <div className="flex items-center justify-center">
                          {produto.nome}
                          {getSortIcon(produto.id)}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaAfericoes.map((afericao, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{afericao.cliente_nome}</TableCell>
                      <TableCell>{afericao.cliente_fazenda || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {afericao.data_afericao 
                            ? format(parseISO(afericao.data_afericao), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {afericao.responsavel}
                        </div>
                      </TableCell>
                      {produtos?.map((produto) => (
                        <TableCell key={produto.id} className="text-center">
                          {formatarProduto(afericao.produtosPorId[produto.id])}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedAfericao(afericao);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="consumo" className="mt-4">
          <ConsumoTab />
        </TabsContent>
      </Tabs>

      <NovaAfericaoDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false);
          refetch();
        }}
      />

      <EditarAfericaoDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen}
        afericao={selectedAfericao}
        onSuccess={() => {
          setEditDialogOpen(false);
          setSelectedAfericao(null);
          refetch();
        }}
      />
    </div>
  );
}
