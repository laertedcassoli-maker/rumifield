import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Package, Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionPart {
  id: string;
  action_id: string;
  part_id: string;
  default_quantity: number;
  part?: {
    id: string;
    codigo: string;
    nome: string;
    familia: string | null;
  };
}

interface ActionPartsManagerProps {
  actionId: string;
  actionLabel: string;
}

export default function ActionPartsManager({ actionId, actionLabel }: ActionPartsManagerProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");

  // Fetch parts associated with this action
  const { data: actionParts, isLoading } = useQuery({
    queryKey: ['action-parts', actionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_action_parts')
        .select(`
          id,
          action_id,
          part_id,
          default_quantity,
          part:pecas(id, codigo, nome, familia)
        `)
        .eq('action_id', actionId);
      
      if (error) throw error;
      return data as ActionPart[];
    },
    enabled: isOpen
  });

  // Fetch available parts from catalog
  const { data: availableParts } = useQuery({
    queryKey: ['parts-catalog-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pecas')
        .select('id, codigo, nome, familia')
        .eq('ativo', true)
        .not('familia', 'is', null)
        .order('familia')
        .order('nome');
      
      if (error) throw error;
      return data;
    },
    enabled: isAddOpen
  });

  // Add part mutation
  const addPartMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPartId) throw new Error('Selecione uma peça');
      
      const { error } = await supabase
        .from('checklist_action_parts')
        .insert({
          action_id: actionId,
          part_id: selectedPartId,
          default_quantity: parseFloat(quantity) || 1
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-parts', actionId] });
      toast.success('Peça associada!');
      setIsAddOpen(false);
      setSelectedPartId(null);
      setQuantity("1");
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Esta peça já está associada a esta ação');
      } else {
        toast.error('Erro ao associar peça: ' + error.message);
      }
    }
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, newQuantity }: { id: string; newQuantity: number }) => {
      const { error } = await supabase
        .from('checklist_action_parts')
        .update({ default_quantity: newQuantity })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-parts', actionId] });
    }
  });

  // Remove part mutation
  const removePartMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('checklist_action_parts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-parts', actionId] });
      toast.success('Peça removida!');
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    }
  });

  const selectedPart = availableParts?.find(p => p.id === selectedPartId);

  // Filter out already associated parts
  const filteredParts = availableParts?.filter(
    (p: { id: string }) => !actionParts?.some(ap => ap.part_id === p.id)
  );

  // Group parts by family
  type PartType = { id: string; codigo: string; nome: string; familia: string | null };
  const groupedParts = filteredParts?.reduce<Record<string, PartType[]>>((acc, part) => {
    const family = part.familia || 'Sem família';
    if (!acc[family]) acc[family] = [];
    acc[family].push(part);
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 gap-1">
          <Package className="h-3 w-3" />
          <span className="text-xs">Peças</span>
          {actionParts && actionParts.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-xs">
              {actionParts.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Peças Associadas
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ação: {actionLabel}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* List of associated parts */}
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              Carregando...
            </div>
          ) : actionParts?.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4 border rounded-lg">
              Nenhuma peça associada a esta ação.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {actionParts?.map(ap => (
                <div key={ap.id} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {ap.part?.codigo} - {ap.part?.nome}
                    </p>
                    {ap.part?.familia && (
                      <p className="text-xs text-muted-foreground">{ap.part.familia}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Qtd:</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={ap.default_quantity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (val > 0) {
                          updateQuantityMutation.mutate({ id: ap.id, newQuantity: val });
                        }
                      }}
                      className="w-16 h-7 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removePartMutation.mutate(ap.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add part section */}
          <div className="border-t pt-4">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Peça
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Peça</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Peça *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between h-auto min-h-10 whitespace-normal text-left"
                        >
                          {selectedPart ? (
                            <span className="break-words">
                              {selectedPart.codigo} - {selectedPart.nome}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Selecione uma peça...</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar peça..." />
                          <CommandList className="max-h-64">
                            <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
                            {groupedParts && Object.entries(groupedParts).map(([family, parts]) => (
                              <CommandGroup key={family} heading={family}>
                                {parts?.map(part => (
                                  <CommandItem
                                    key={part.id}
                                    value={`${part.codigo} ${part.nome}`}
                                    onSelect={() => setSelectedPartId(part.id)}
                                    className="flex items-center gap-2"
                                  >
                                    <Check
                                      className={cn(
                                        "h-4 w-4",
                                        selectedPartId === part.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span className="truncate">
                                      {part.codigo} - {part.nome}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Quantidade Padrão</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Quantidade consumida quando esta ação é aplicada.
                    </p>
                  </div>

                  <Button
                    onClick={() => addPartMutation.mutate()}
                    disabled={!selectedPartId || addPartMutation.isPending}
                    className="w-full"
                  >
                    Adicionar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
