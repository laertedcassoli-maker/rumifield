import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TrendingDown, Droplets, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConsumoTab } from '@/components/estoque/ConsumoTab';

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
                className={cn(
                  "gap-2 transition-all duration-200",
                  isSelected ? style.activeClass : style.inactiveClass
                )}
              >
                <Icon className="h-4 w-4" />
                {produto.nome}
              </Button>
            );
          })}
        </div>
      </div>

      {selectedProdutoId && selectedProduto && (
        <ConsumoTab produtoId={selectedProdutoId} />
      )}
    </div>
  );
}
