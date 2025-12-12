import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TrendingDown } from 'lucide-react';
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

  // Auto-select first product when loaded
  const firstProdutoId = produtos?.[0]?.id;
  if (!selectedProdutoId && firstProdutoId) {
    setSelectedProdutoId(firstProdutoId);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingDown className="h-6 w-6" />
            Consumo de Produtos
          </h1>
          <p className="text-muted-foreground">Analise o consumo por produto químico</p>
        </div>

        <div className="flex gap-2">
          {produtos?.map((produto) => (
            <Button
              key={produto.id}
              variant={selectedProdutoId === produto.id ? "default" : "outline"}
              onClick={() => setSelectedProdutoId(produto.id)}
              disabled={isLoadingProdutos}
            >
              {produto.nome}
            </Button>
          ))}
        </div>
      </div>

      {selectedProdutoId && selectedProduto && (
        <ConsumoTab produtoId={selectedProdutoId} />
      )}
    </div>
  );
}
