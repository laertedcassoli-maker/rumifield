import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Beaker, TrendingDown } from 'lucide-react';
import { ConsumoTab } from '@/components/estoque/ConsumoTab';

export default function Consumo() {
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>('');

  const { data: produtos, isLoading: isLoadingProdutos } = useQuery({
    queryKey: ['produtos-consumo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_quimicos')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const selectedProduto = produtos?.find(p => p.id === selectedProdutoId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingDown className="h-6 w-6" />
          Consumo de Produtos
        </h1>
        <p className="text-muted-foreground">Analise o consumo por produto químico</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Selecione o Produto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedProdutoId} onValueChange={setSelectedProdutoId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione um produto para analisar" />
            </SelectTrigger>
            <SelectContent>
              {produtos?.map((produto) => (
                <SelectItem key={produto.id} value={produto.id}>
                  {produto.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedProdutoId && selectedProduto && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">
            Análise de Consumo: {selectedProduto.nome}
          </h2>
          <ConsumoTab produtoId={selectedProdutoId} />
        </div>
      )}

      {!selectedProdutoId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Beaker className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Selecione um produto acima para visualizar a análise de consumo
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
