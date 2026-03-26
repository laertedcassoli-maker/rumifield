import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
  Loader2, 
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Building2,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface NovaVisitaDiretaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRODUCTS = [
  { key: 'rumiflow', label: 'RumiFlow', color: 'bg-blue-500' },
  { key: 'rumiprocare', label: 'RumiProcare', color: 'bg-green-500' },
  { key: 'rumiaction', label: 'RumiAction', color: 'bg-orange-500' },
];

const MAINTENANCE_CATEGORY_ID = '00cad095-5a3f-432b-a3d4-916a5acd5dd2';

export default function NovaVisitaDiretaDialog({
  open,
  onOpenChange,
}: NovaVisitaDiretaDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [plannedDate, setPlannedDate] = useState<Date | undefined>(new Date());
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // Fetch active clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['active-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade')
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const filteredClients = clients?.filter(client => {
    if (!clientSearch) return true;
    const search = clientSearch.toLowerCase();
    return (
      client.nome.toLowerCase().includes(search) ||
      client.fazenda?.toLowerCase().includes(search) ||
      client.cidade?.toLowerCase().includes(search)
    );
  }) || [];

  const selectedClient = clients?.find(c => c.id === clientId);

  const toggleProduct = (productKey: string) => {
    setSelectedProducts(prev => 
      prev.includes(productKey) 
        ? prev.filter(p => p !== productKey)
        : [...prev, productKey]
    );
  };

  const createVisitMutation = useMutation({
    mutationFn: async () => {
      if (!clientId || !title.trim()) {
        throw new Error('Preencha os campos obrigatórios (Cliente e Título)');
      }

      // Bug #4: Check connectivity
      if (!navigator.onLine) {
        throw new Error('Sem conexão com a internet. Conecte-se e tente novamente.');
      }

      // Bug #2: Track created IDs for rollback
      let createdTicketId: string | null = null;

      try {
        // 1. Generate ticket code
        const { data: ticketCode, error: codeError } = await supabase.rpc('generate_ticket_code');
        if (codeError) throw codeError;

        // 2. Create ticket
        const { data: ticket, error: ticketError } = await supabase
          .from('technical_tickets')
          .insert({
            ticket_code: ticketCode,
            client_id: clientId,
            created_by_user_id: user!.id,
            assigned_technician_id: user!.id,
            title,
            description: description || null,
            priority: 'urgente',
            status: 'em_atendimento',
            substatus: 'aguardando_visita',
            products: selectedProducts,
            category_id: MAINTENANCE_CATEGORY_ID,
          })
          .select('id')
          .single();

        if (ticketError) throw ticketError;
        createdTicketId = ticket.id;

        // 3. Create corrective visit
        const { error: visitError } = await supabase
          .from('ticket_visits')
          .insert({
            ticket_id: ticket.id,
            client_id: clientId,
            field_technician_user_id: user!.id,
            status: 'em_elaboracao',
            planned_start_date: plannedDate ? format(plannedDate, 'yyyy-MM-dd') : null,
            internal_notes: description || null,
          });

        if (visitError) throw visitError;

        // 4. NON-CRITICAL: Add timeline entry
        try {
          await supabase.from('ticket_timeline').insert({
            ticket_id: ticket.id,
            user_id: user!.id,
            event_type: 'ticket_created',
            event_description: `Chamado e Visita criados simultaneamente: ${ticketCode}`,
          });
        } catch (timelineErr) {
          console.error('[Nova Visita] Timeline não criada:', timelineErr);
        }

        return { ticketId: ticket.id, ticketCode };
      } catch (error: any) {
        // Bug #2: Rollback — delete ticket (cascade deletes visit via FK)
        if (createdTicketId) {
          await supabase
            .from('technical_tickets')
            .delete()
            .eq('id', createdTicketId)
            .then(({ error: rollbackErr }) => {
              if (rollbackErr) console.error('[Nova Visita] Erro no rollback do chamado:', rollbackErr);
              else console.log('[Nova Visita] Rollback do chamado realizado com sucesso');
            });
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['technical-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['my-corrective-visits'] });
      toast({ title: `Nova Visita agendada: ${data.ticketCode}` });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar visita',
        description: error.message,
      });
    },
  });

  const handleClose = () => {
    setClientId('');
    setClientSearch('');
    setTitle('');
    setDescription('');
    setSelectedProducts([]);
    setPlannedDate(new Date());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Visita Corretiva</DialogTitle>
          <DialogDescription>
            Crie um chamado urgente de manutenção e agende a visita agora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Cliente *
            </Label>
            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between",
                    !clientId && "text-muted-foreground"
                  )}
                >
                  {selectedClient ? (
                    <span className="truncate">
                      {selectedClient.nome}
                      {selectedClient.fazenda && ` - ${selectedClient.fazenda}`}
                    </span>
                  ) : (
                    "Selecione um cliente..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] sm:w-[400px] p-0" align="start">
                 <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Buscar cliente..." 
                    value={clientSearch}
                    onValueChange={setClientSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {clientsLoading ? 'Carregando...' : 'Nenhum cliente encontrado.'}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredClients.slice(0, 50).map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.id}
                          onSelect={() => {
                            setClientId(client.id);
                            setClientPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              clientId === client.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <div className="font-medium">{client.nome}</div>
                            {(client.fazenda || client.cidade) && (
                              <div className="text-sm text-muted-foreground">
                                {[client.fazenda, client.cidade].filter(Boolean).join(' • ')}
                              </div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label>Título do Chamado *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Falha na bomba de vácuo"
            />
          </div>

          {/* Produtos */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              Produtos
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRODUCTS.map(product => (
                <Button
                  key={product.key}
                  type="button"
                  variant={selectedProducts.includes(product.key) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleProduct(product.key)}
                  className={cn(
                    "transition-all",
                    selectedProducts.includes(product.key) && product.color
                  )}
                >
                  {selectedProducts.includes(product.key) && (
                    <Check className="mr-1 h-3 w-3" />
                  )}
                  {product.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Data Planejada */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              Data Prevista
            </Label>
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !plannedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {plannedDate 
                    ? format(plannedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : "Selecione uma data"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={plannedDate}
                  onSelect={(date) => {
                    setPlannedDate(date);
                    setDatePopoverOpen(false);
                  }}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição do Problema</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes técnicos para a visita..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => createVisitMutation.mutate()}
            disabled={!clientId || !title.trim() || createVisitMutation.isPending}
          >
            {createVisitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar e Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
