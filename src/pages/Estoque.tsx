import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Beaker, Loader2, Plus, Calendar, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NovaAfericaoDialog } from '@/components/estoque/NovaAfericaoDialog';

const VOLUME_GALAO = 50;

interface ProdutoInfo {
  id: string;
  nome: string;
}

export default function Estoque() {
  const [dialogOpen, setDialogOpen] = useState(false);

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
  const afericoesAgrupadas = afericoes?.reduce((acc, item) => {
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

  const listaAfericoes = Object.values(afericoesAgrupadas || {});

  const calcularTotalLitros = (galoesCheios: number, nivelParcial: number | null) => {
    const cheios = galoesCheios * VOLUME_GALAO;
    const parcial = nivelParcial !== null ? (nivelParcial / 100) * VOLUME_GALAO : 0;
    return cheios + parcial;
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Controle de Estoque</h1>
          <p className="text-muted-foreground">Histórico de aferições de produtos químicos</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Aferição
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            Aferições Registradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : listaAfericoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma aferição registrada ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fazenda</TableHead>
                    <TableHead>Data Aferição</TableHead>
                    <TableHead>Responsável</TableHead>
                    {produtos?.map((produto) => (
                      <TableHead key={produto.id} className="text-center">
                        {produto.nome}
                      </TableHead>
                    ))}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <NovaAfericaoDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
