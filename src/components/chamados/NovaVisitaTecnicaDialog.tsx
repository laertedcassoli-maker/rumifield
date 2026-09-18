import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/supabase-helpers';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  nome: string;
  fazenda: string | null;
  cidade: string | null;
}

interface NovaVisitaTecnicaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Solicitação de visita técnica em um único passo.
 * O usuário só informa dados da visita; o chamado de suporte é criado
 * nos bastidores para manter a mesma estrutura de dados usada pela
 * execução da visita, relatório público e RPCs de segurança.
 */
export default function NovaVisitaTecnicaDialog({ open, onOpenChange }: NovaVisitaTecnicaDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [technicianId, setTechnicianId] = useState('');
  const [plannedDate, setPlannedDate] = useState<Date | undefined>();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [priority, setPriority] = useState('media');
  const [motivo, setMotivo] = useState('');

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
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

  const { data: technicians } = useQuery({
    queryKey: ['field-technicians'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['tecnico_campo', 'tecnico_oficina']);

      if (!roles?.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', roles.map(r => r.user_id))
        .eq('is_active', true)
        .order('nome');

      return profiles || [];
    },
    enabled: open,
  });

  const filteredClients = (clients || []).filter(client => {
    if (!clientSearch) return true;
    const s = clientSearch.toLowerCase();
    return (
      client.nome.toLowerCase().includes(s) ||
      client.fazenda?.toLowerCase().includes(s) ||
      client.cidade?.toLowerCase().includes(s)
    );
  });

  const selectedClient = clients?.find(c => c.id === clientId);

  const handleClose = () => {
    setClientId('');
    setClientSearch('');
    setTechnicianId('');
    setPlannedDate(undefined);
    setPriority('media');
    setMotivo('');
    onOpenChange(false);
  };

  const createVisita = useMutation({
    mutationFn: async () => {
      const { data: ticketCode, error: codeError } = await withTimeout(
        supabase.rpc('generate_ticket_code')
      );
      if (codeError) throw codeError;

      const { data: ticket, error: ticketError } = await withTimeout(
        supabase
          .from('technical_tickets')
          .insert({
            ticket_code: ticketCode,
            client_id: clientId,
            created_by_user_id: user!.id,
            assigned_technician_id: technicianId,
            title: motivo.trim().substring(0, 80),
            description: motivo.trim(),
            priority: priority as any,
            status: 'aberto',
          })
          .select('id')
          .single()
      );
      if (ticketError) throw ticketError;

      const ticketId = ticket.id;
      let createdVisitId: string | null = null;

      try {
        const { error: tlError } = await supabase.from('ticket_timeline').insert({
          ticket_id: ticketId,
          user_id: user!.id,
          event_type: 'ticket_created',
          event_description: `Chamado criado: ${ticketCode}`,
        });
        if (tlError) throw tlError;

        const { data: visit, error: visitError } = await withTimeout(
          supabase
            .from('ticket_visits')
            .insert({
              ticket_id: ticketId,
              client_id: clientId,
              field_technician_user_id: technicianId,
              status: 'em_elaboracao',
              planned_start_date: plannedDate ? format(plannedDate, 'yyyy-MM-dd') : null,
              internal_notes: null,
            })
            .select('id')
            .single()
        );
        if (visitError) throw visitError;
        createdVisitId = visit.id;

        const { error: updateError } = await supabase
          .from('technical_tickets')
          .update({ status: 'em_atendimento', substatus: 'aguardando_visita' })
          .eq('id', ticketId);
        if (updateError) throw updateError;

        const { error: tl2Error } = await supabase.from('ticket_timeline').insert({
          ticket_id: ticketId,
          user_id: user!.id,
          event_type: 'visit_created',
          event_description: plannedDate
            ? `Visita agendada para ${format(plannedDate, 'dd/MM/yyyy', { locale: ptBR })}`
            : 'Visita criada (data a definir)',
        });
        if (tl2Error) throw tl2Error;
      } catch (err) {
        // Rollback para permitir nova tentativa limpa
        if (createdVisitId) {
          const { error: rbVisit } = await supabase.from('ticket_visits').delete().eq('id', createdVisitId);
          if (rbVisit) console.error('[NovaVisitaTecnica] Erro no rollback da visita:', rbVisit);
        }
        const { error: rbTicket } = await supabase.from('technical_tickets').delete().eq('id', ticketId);
        if (rbTicket) console.error('[NovaVisitaTecnica] Erro no rollback do chamado:', rbTicket);
        throw err;
      }

      return ticketId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visita-tecnica'] });
      queryClient.invalidateQueries({ queryKey: ['technical-tickets'] });
      toast({ title: 'Visita técnica solicitada com sucesso!' });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao solicitar visita técnica',
        description: error.message,
      });
    },
  });

  const handleSubmit = () => {
    if (!clientId || !technicianId || !plannedDate || !motivo.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe cliente, técnico, data planejada e o motivo da visita.',
      });
      return;
    }
    createVisita.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir Visita Técnica</DialogTitle>
          <DialogDescription>
            Solicite uma ida do técnico à fazenda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn('w-full justify-between', !clientId && 'text-muted-foreground')}
                >
                  {selectedClient ? (
                    <span className="truncate">
                      {selectedClient.nome}
                      {selectedClient.fazenda && ` - ${selectedClient.fazenda}`}
                    </span>
                  ) : (
                    'Selecione um cliente...'
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="start">
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
                              'mr-2 h-4 w-4',
                              clientId === client.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{client.nome}</div>
                            {(client.fazenda || client.cidade) && (
                              <div className="text-sm text-muted-foreground truncate">
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

          {/* Técnico */}
          <div className="space-y-2">
            <Label>Técnico *</Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um técnico" />
              </SelectTrigger>
              <SelectContent>
                {technicians?.map(tech => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data planejada */}
          <div className="space-y-2">
            <Label>Data Planejada *</Label>
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !plannedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {plannedDate
                    ? format(plannedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : 'Selecione uma data'}
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
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label>Prioridade *</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo da visita *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da visita..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createVisita.isPending}>
            {createVisita.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Solicitar Visita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
