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

export default function Estoque() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: afericoes, isLoading, refetch } = useQuery({
    queryKey: ['afericoes-estoque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_cliente')
        .select(`
          *,
          clientes(nome, fazenda),
          produtos_quimicos(nome)
        `)
        .order('data_afericao', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Agrupa aferições por cliente_id + data_afericao + responsavel para mostrar como uma linha
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
        produtos: [],
      };
    }
    acc[key].produtos.push({
      nome: item.produtos_quimicos?.nome || '',
      galoes_cheios: item.galoes_cheios,
      nivel_galao_parcial: item.nivel_galao_parcial,
      quantidade: item.quantidade,
    });
    return acc;
  }, {} as Record<string, {
    cliente_id: string;
    cliente_nome: string;
    cliente_fazenda: string;
    data_afericao: string;
    responsavel: string;
    data_atualizacao: string;
    produtos: { nome: string; galoes_cheios: number; nivel_galao_parcial: number | null; quantidade: number }[];
  }>);

  const listaAfericoes = Object.values(afericoesAgrupadas || {});

  const calcularTotalLitros = (galoesCheios: number, nivelParcial: number | null) => {
    const cheios = galoesCheios * VOLUME_GALAO;
    const parcial = nivelParcial !== null ? (nivelParcial / 100) * VOLUME_GALAO : 0;
    return cheios + parcial;
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
                    <TableHead>Produtos</TableHead>
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
                      <TableCell>
                        <div className="space-y-1">
                          {afericao.produtos.map((produto, pIndex) => (
                            <div key={pIndex} className="text-sm">
                              <span className="font-medium">{produto.nome}:</span>{' '}
                              <span className="text-muted-foreground">
                                {produto.galoes_cheios} galões
                                {produto.nivel_galao_parcial !== null && ` + ${produto.nivel_galao_parcial}%`}
                                {' '}({calcularTotalLitros(produto.galoes_cheios, produto.nivel_galao_parcial)}L)
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
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
