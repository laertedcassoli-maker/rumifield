import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ChevronUp, ChevronDown, Warehouse, Truck } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/hooks/use-toast';

interface ConsumedPart {
  id: string;
  part_id: string;
  part_code_snapshot: string;
  part_name_snapshot: string;
  quantity: number;
  unit_cost_snapshot: number | null;
  stock_source: 'fazenda' | 'tecnico';
  consumed_at: string;
}

interface ConsumedPartsBlockProps {
  preventiveId: string;
  isCompleted?: boolean;
}

export default function ConsumedPartsBlock({ preventiveId, isCompleted = false }: ConsumedPartsBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch consumed parts
  const { data: parts, isLoading } = useQuery({
    queryKey: ['preventive-consumed-parts', preventiveId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_part_consumption')
        .select('id, part_id, part_code_snapshot, part_name_snapshot, quantity, unit_cost_snapshot, stock_source, consumed_at')
        .eq('preventive_id', preventiveId)
        .order('consumed_at', { ascending: true });

      if (error) throw error;
      return (data || []) as ConsumedPart[];
    },
    enabled: !!preventiveId,
  });

  // Update stock source mutation
  const updateStockSourceMutation = useMutation({
    mutationFn: async ({ partId, stockSource }: { partId: string; stockSource: 'fazenda' | 'tecnico' }) => {
      const { error } = await supabase
        .from('preventive_part_consumption')
        .update({ stock_source: stockSource })
        .eq('id', partId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-consumed-parts', preventiveId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleStockSourceChange = (partId: string, value: string) => {
    if (value && (value === 'fazenda' || value === 'tecnico')) {
      updateStockSourceMutation.mutate({ partId, stockSource: value });
    }
  };

  // Calculate totals
  const totalParts = parts?.length || 0;
  const totalQuantity = parts?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;
  const totalCost = parts?.reduce((sum, p) => sum + ((p.quantity || 0) * (p.unit_cost_snapshot || 0)), 0) || 0;

  const hasParts = totalParts > 0;

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Peças</CardTitle>
                {hasParts && (
                  <Badge variant="secondary" className="ml-1">
                    {totalParts}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!hasParts && !isLoading && (
                  <span className="text-xs text-muted-foreground">Nenhuma peça</span>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
          <CardContent className="pt-0 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !hasParts ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Package className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p>Peças serão listadas automaticamente</p>
                <p className="text-xs mt-1">quando houver falhas no checklist</p>
              </div>
            ) : (
              <>
                {/* Parts List */}
                <div className="space-y-3">
                  {parts?.map((part) => (
                    <div
                      key={part.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      {/* Part Info */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs shrink-0">
                              {part.part_code_snapshot}
                            </Badge>
                            <Badge variant="secondary" className="shrink-0">
                              Qtd: {part.quantity}
                            </Badge>
                          </div>
                          <p className="text-sm mt-1.5 leading-tight">
                            {part.part_name_snapshot}
                          </p>
                        </div>
                      </div>

                      {/* Stock Source Toggle */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-muted-foreground shrink-0">Origem:</span>
                        <ToggleGroup
                          type="single"
                          value={part.stock_source || 'tecnico'}
                          onValueChange={(value) => handleStockSourceChange(part.id, value)}
                          disabled={isCompleted}
                          className="gap-1"
                        >
                          <ToggleGroupItem
                            value="tecnico"
                            aria-label="Estoque do técnico"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-blue-500/10 data-[state=on]:text-blue-600 data-[state=on]:border-blue-500/30"
                          >
                            <Truck className="h-3 w-3" />
                            Técnico
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="fazenda"
                            aria-label="Estoque da fazenda"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-green-500/10 data-[state=on]:text-green-600 data-[state=on]:border-green-500/30"
                          >
                            <Warehouse className="h-3 w-3" />
                            Fazenda
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="border-t pt-3 mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total de itens:</span>
                    <span className="font-medium">{totalQuantity} peça(s)</span>
                  </div>
                  {totalCost > 0 && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Custo estimado:</span>
                      <span className="font-medium">
                        {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
