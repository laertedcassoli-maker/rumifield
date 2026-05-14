import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Check, 
  ChevronsUpDown,
  Package,
  ShoppingCart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealtimePecas } from '@/hooks/useRealtimePecas';
import SolenoideModeloDialog, {
  SOLENOIDE_TRIGGER_CODE,
  SOLENOIDE_TARGET_CODE,
  SOLENOIDE_TARGET_QTY,
} from '@/components/pedidos/SolenoideModeloDialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';

interface TicketPartsRequestPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  clientId: string;
  visitId?: string;
}

interface PartItem {
  peca_id: string;
  codigo: string;
  nome: string;
  quantidade: number;
}

export default function TicketPartsRequestPanel({
  open,
  onOpenChange,
  ticketId,
  clientId,
  visitId,
}: TicketPartsRequestPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [items, setItems] = useState<PartItem[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [solenoideModelo, setSolenoideModelo] = useState<'' | '2x' | '3x'>('');
  const [partPopoverOpen, setPartPopoverOpen] = useState(false);
  const [partSearch, setPartSearch] = useState('');
  const [showSolenoideDialog, setShowSolenoideDialog] = useState(false);

  // Fetch active parts
  const { data: availableParts } = useQuery({
    queryKey: ['parts-catalog-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pecas')
        .select('id, codigo, nome, familia')
        .eq('ativo', true)
        .order('familia')
        .order('nome');
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  useRealtimePecas([['parts-catalog-active']]);

  // Filter parts
  const filteredParts = availableParts?.filter(part => {
    if (!partSearch) return true;
    const search = partSearch.toLowerCase();
    return (
      part.codigo.toLowerCase().includes(search) ||
      part.nome.toLowerCase().includes(search) ||
      part.familia?.toLowerCase().includes(search)
    );
  }) || [];

  // Group by familia
  const groupedParts = filteredParts.reduce((acc, part) => {
    const familia = part.familia || 'Outros';
    if (!acc[familia]) acc[familia] = [];
    acc[familia].push(part);
    return acc;
  }, {} as Record<string, typeof filteredParts>);

  // PRD00605 -> PRD00639 ×3 auto-link
  const findPart = (codigo: string) => availableParts?.find(p => p.codigo === codigo);

  const applyAutoLinks = (list: PartItem[]): PartItem[] => {
    const trigger = findPart(SOLENOIDE_TRIGGER_CODE);
    const target = findPart(SOLENOIDE_TARGET_CODE);
    if (!trigger || !target) return list;

    const without = list.filter(i => i.peca_id !== target.id);
    const totalTrigger = without
      .filter(i => i.peca_id === trigger.id)
      .reduce((s, i) => s + i.quantidade, 0);
    const targetQty = totalTrigger * SOLENOIDE_TARGET_QTY;
    if (targetQty <= 0) return without;
    return [
      ...without,
      {
        peca_id: target.id,
        codigo: target.codigo,
        nome: target.nome,
        quantidade: targetQty,
      },
    ];
  };

  const triggerPart = findPart(SOLENOIDE_TRIGGER_CODE);
  const targetPart = findPart(SOLENOIDE_TARGET_CODE);
  const hasSolenoide = !!triggerPart && items.some(i => i.peca_id === triggerPart.id);
  const isAutoLinked = (peca_id: string) => !!targetPart && peca_id === targetPart.id && hasSolenoide;

  const addPart = (part: typeof availableParts[0]) => {
    const existing = items.find(i => i.peca_id === part.id);
    let next: PartItem[];
    if (existing) {
      next = items.map(i =>
        i.peca_id === part.id ? { ...i, quantidade: i.quantidade + 1 } : i
      );
    } else {
      next = [...items, {
        peca_id: part.id,
        codigo: part.codigo,
        nome: part.nome,
        quantidade: 1,
      }];
    }
    setItems(applyAutoLinks(next));
    setPartPopoverOpen(false);
    setPartSearch('');
  };

  const updateQuantity = (pecaId: string, quantidade: number) => {
    if (isAutoLinked(pecaId)) return;
    let next: PartItem[];
    if (quantidade < 1) {
      next = items.filter(i => i.peca_id !== pecaId);
    } else {
      next = items.map(i => (i.peca_id === pecaId ? { ...i, quantidade } : i));
    }
    setItems(applyAutoLinks(next));
  };

  const removePart = (pecaId: string) => {
    if (isAutoLinked(pecaId)) return;
    const next = items.filter(i => i.peca_id !== pecaId);
    if (triggerPart && pecaId === triggerPart.id) {
      setSolenoideModelo('');
    }
    setItems(applyAutoLinks(next));
  };

  // Create parts request mutation
  const createRequest = useMutation({
    mutationFn: async () => {
      if (!items.length) throw new Error('Adicione pelo menos uma peça');

      // Create pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          solicitante_id: user!.id,
          cliente_id: clientId,
          status: 'solicitado',
          observacoes: observacoes || null,
          origem: 'chamado',
          urgencia: 'normal',
          solenoide_modelo: hasSolenoide ? solenoideModelo || null : null,
        } as any)
        .select('id')
        .single();

      if (pedidoError) throw pedidoError;

      // Create pedido items
      const { error: itemsError } = await supabase
        .from('pedido_itens')
        .insert(
          items.map(item => ({
            pedido_id: pedido.id,
            peca_id: item.peca_id,
            quantidade: item.quantidade,
          }))
        );

      if (itemsError) throw itemsError;

      // Link to ticket
      const { error: linkError } = await supabase
        .from('ticket_parts_requests')
        .insert({
          ticket_id: ticketId,
          pedido_id: pedido.id,
          visit_id: visitId || null,
        });

      if (linkError) throw linkError;

      // Update ticket substatus to aguardando_peca (keeps em_atendimento status)
      await supabase
        .from('technical_tickets')
        .update({
          status: 'em_atendimento',
          substatus: 'aguardando_peca',
        })
        .eq('id', ticketId);

      // Add timeline entry
      await supabase.from('ticket_timeline').insert({
        ticket_id: ticketId,
        user_id: user!.id,
        event_type: 'parts_requested',
        event_description: `Solicitação de peças criada (${items.length} item(ns))`,
      });

      return pedido;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-parts-requests', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-timeline', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
      toast({ title: 'Solicitação de peças criada!' });
      setItems([]);
      setObservacoes('');
      setSolenoideModelo('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar solicitação',
        description: error.message,
      });
    },
  });

  const handleClose = () => {
    setItems([]);
    setObservacoes('');
    setSolenoideModelo('');
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (hasSolenoide && !solenoideModelo) {
      toast({
        variant: 'destructive',
        title: 'Selecione o modelo do solenóide',
        description: 'Escolha 2x ou 3x antes de criar a solicitação.',
      });
      return;
    }
    createRequest.mutate();
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Solicitar Peças
          </SheetTitle>
          <SheetDescription>
            Crie uma solicitação de peças vinculada a este chamado.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Add Part */}
          <div className="space-y-2">
            <Label>Adicionar Peça</Label>
            <Popover open={partPopoverOpen} onOpenChange={setPartPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="text-muted-foreground">Buscar peça...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Buscar por código ou nome..." 
                    value={partSearch}
                    onValueChange={setPartSearch}
                  />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
                    {Object.entries(groupedParts).map(([familia, parts]) => (
                      <CommandGroup key={familia} heading={familia}>
                        {parts.slice(0, 20).map((part) => (
                          <CommandItem
                            key={part.id}
                            value={`${part.codigo} ${part.nome}`.toLowerCase()}
                            onSelect={() => addPart(part)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                items.some(i => i.peca_id === part.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs bg-muted px-1 rounded">{part.codigo}</span>
                                <span className="text-sm">{part.nome}</span>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected Parts */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>Peças Selecionadas ({items.length})</Label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {items.map(item => (
                  <div 
                    key={item.peca_id} 
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-muted-foreground">{item.codigo}</div>
                      <div className="text-sm truncate">{item.nome}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => updateQuantity(item.peca_id, parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-center"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removePart(item.peca_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre a solicitação..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={() => createRequest.mutate()}
              disabled={items.length === 0 || createRequest.isPending}
            >
              {createRequest.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Criar Solicitação
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
