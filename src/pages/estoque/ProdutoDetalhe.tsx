import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Beaker, TrendingDown, Calendar, Loader2 } from 'lucide-react';
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

export default function ProdutoDetalhe() {
  const { produtoId } = useParams<{ produtoId: string }>();

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

  const isLoading = loadingProduto || loadingAfericoes || loadingEnvios;

  // Totais
  const totais = useMemo(() => {
    const totalConsumo = consumoData.reduce((acc, c) => acc + c.consumo, 0);
    const totalConsumo30dias = consumoData.length > 0
      ? Math.round(consumoData.reduce((acc, c) => acc + c.consumo_30dias, 0) / consumoData.length)
      : 0;
    const totalEnvios = consumoData.reduce((acc, c) => acc + c.envios, 0);
    return { totalConsumo, totalConsumo30dias, totalEnvios };
  }, [consumoData]);

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

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Consumo Total (períodos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totais.totalConsumo}L</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Média Consumo/30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totais.totalConsumo30dias}L</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Enviado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{totais.totalEnvios}L</div>
          </CardContent>
        </Card>
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
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Consumo por Cliente
                {consumoData.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({consumoData.length} períodos)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {consumoData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum dado de consumo disponível.</p>
                  <p className="text-sm mt-2">
                    São necessárias pelo menos 2 aferições do mesmo cliente.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fazenda</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-center">Dias</TableHead>
                      <TableHead className="text-center">Estoque Inicial</TableHead>
                      <TableHead className="text-center">Envios</TableHead>
                      <TableHead className="text-center">Estoque Final</TableHead>
                      <TableHead className="text-center">Consumo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumoData.map((item, index) => (
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
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="30dias" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Consumo Padronizado (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {consumoData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum dado de consumo disponível.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fazenda</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-center">Dias</TableHead>
                      <TableHead className="text-center">Consumo Real</TableHead>
                      <TableHead className="text-center">Consumo/30 dias</TableHead>
                      <TableHead className="text-center">Orçado</TableHead>
                      <TableHead className="text-center">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumoData.map((item, index) => (
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
                          {/* Placeholder para orçado - futuro */}
                          -
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {/* Placeholder para diferença - futuro */}
                          -
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
