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

/** Template padrão de checklist (RumiFlow v1) — usuário pode trocar */
const DEFAULT_CHECKLIST_TEMPLATE_ID = '3b86c956-891a-4a82-9871-d8a5c2981a6d';

interface Client {
  id: string;
  nome: string;
  fazenda: string | null;
  cidade: string | null;
}

type TipoVisita = 'corretiva' | 'preventiva';

interface NovaVisitaTecnicaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Solicitação de visita técnica em um único passo.
 * Corretiva: cria o chamado nos bastidores + ticket_visits, mantendo a
 * estrutura esperada pela execução, relatório público e RPCs de segurança.
 * Preventiva: cria uma rota preventiva enxuta (um cliente, um dia).
 */
export default function NovaVisitaTecnicaDialog({ open, onOpenChange }: NovaVisitaTecnicaDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tipo, setTipo] = useState<TipoVisita>('corretiva');
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [technicianId, setTechnicianId] = useState('');
  const [plannedDate, setPlannedDate] = useState<Date | undefined>();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [priority, setPriority] = useState('media');
  const [checklistTemplateId, setChecklistTemplateId] = useState(DEFAULT_CHECKLIST_TEMPLATE_ID);
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

  // Checklists ativos — mesma query usada na criação de rotas preventivas
  const { data: checklistTemplates } = useQuery({
    queryKey: ['active-checklist-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name, description')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
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
    setTipo('corretiva');
    setClientId('');
    setClientSearch('');
    setTechnicianId('');
    setPlannedDate(undefined);
    setPriority('media');
    setChecklistTemplateId(DEFAULT_CHECKLIST_TEMPLATE_ID);
    setMotivo('');
    onOpenChange(false);
  };

  const createVisita = useMutation({
    mutationFn: async () => {
      const dataPlanejada = format(plannedDate!, 'yyyy-MM-dd');

      if (tipo === 'preventiva') {
        const { data: routeCode, error: codeError } = await withTimeout(
          supabase.rpc('generate_preventive_route_code')
        );
        if (codeError) throw codeError;

        const { data: route, error: routeError } = await withTimeout(
          supabase
            .from('preventive_routes')
            .insert({
              route_code: routeCode,
              start_date: dataPlanejada,
              end_date: dataPlanejada,
              field_technician_user_id: technicianId,
              checklist_template_id: checklistTemplateId,
              notes: null,
              created_by_user_id: user!.id,
              status: 'em_elaboracao',
            } as any)
            .select('id')
            .single()
        );
        if (routeError) throw routeError;

        const { error: itemError } = await withTimeout(
          supabase.from('preventive_route_items').insert({
            route_id: route.id,
            client_id: clientId,
            order_index: 0,
            planned_date: dataPlanejada,
            suggested_reason: null,
            status: 'planejado' as const,
          })
        );

        if (itemError) {
          // Limpa a rota órfã para permitir nova tentativa
          const { error: rbErr } = await supabase
            .from('preventive_routes')
            .delete()
            .eq('id', route.id);
          if (rbErr) console.error('[NovaVisitaTecnica] Falha ao limpar rota órfã:', rbErr);
          throw itemError;
        }

        // Finalizar planejamento (mesma lógica de DetalheRota): cria preventive_maintenance
        // + estrutura do checklist e muda a rota para 'planejada'
        const rollbackRoute = async () => {
          await supabase.from('preventive_maintenance').delete().eq('route_id', route.id);
          await supabase.from('preventive_route_items').delete().eq('route_id', route.id);
          const { error: rbErr } = await supabase.from('preventive_routes').delete().eq('id', route.id);
          if (rbErr) console.error('[NovaVisitaTecnica] Falha ao limpar rota:', rbErr);
        };

        try {
          const { data: template, error: templateError } = await withTimeout(
            supabase
              .from('checklist_templates')
              .select(`id, blocks:checklist_template_blocks(id, block_name, order_index, items:checklist_template_items(id, item_name, order_index, active))`)
              .eq('id', checklistTemplateId)
              .single()
          );
          if (templateError) throw templateError;

          const { data: pm, error: pmError } = await withTimeout(
            supabase
              .from('preventive_maintenance')
              .insert({
                client_id: clientId,
                route_id: route.id,
                scheduled_date: dataPlanejada,
                status: 'planejada' as const,
                technician_user_id: technicianId,
                notes: `Planejada na rota ${routeCode}`,
              })
              .select('id')
              .single()
          );
          if (pmError) throw pmError;

          const { data: checklist, error: checklistError } = await supabase
            .from('preventive_checklists')
            .insert({ preventive_id: pm.id, template_id: template.id })
            .select('id')
            .single();
          if (checklistError) {
            console.error('[NovaVisitaTecnica] Erro ao criar checklist:', checklistError);
          } else {
            for (const block of (template as any).blocks || []) {
              const { data: execBlock, error: blockError } = await supabase
                .from('preventive_checklist_blocks')
                .insert({
                  checklist_id: checklist.id,
                  template_block_id: block.id,
                  block_name_snapshot: block.block_name,
                  order_index: block.order_index,
                })
                .select('id')
                .single();
              if (blockError) {
                console.error('[NovaVisitaTecnica] Erro ao criar bloco:', blockError);
                continue;
              }
              const activeItems = block.items?.filter((it: any) => it.active) || [];
              if (activeItems.length > 0) {
                const { error: itemsError } = await supabase
                  .from('preventive_checklist_items')
                  .insert(activeItems.map((it: any) => ({
                    exec_block_id: execBlock.id,
                    template_item_id: it.id,
                    item_name_snapshot: it.item_name,
                    order_index: it.order_index,
                  })));
                if (itemsError) console.error('[NovaVisitaTecnica] Erro ao criar itens:', itemsError);
              }
            }
          }

          const { error: statusError } = await withTimeout(
            supabase.from('preventive_routes').update({ status: 'planejada' } as any).eq('id', route.id)
          );
          if (statusError) throw statusError;
        } catch (e) {
          await rollbackRoute();
          throw e;
        }

        return route.id;
      }

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
              planned_start_date: dataPlanejada,
              checklist_template_id: checklistTemplateId,
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
          event_description: `Visita agendada para ${format(plannedDate!, 'dd/MM/yyyy', { locale: ptBR })}`,
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
      if (tipo === 'preventiva') {
        queryClient.invalidateQueries({ queryKey: ['preventive-routes'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['technical-tickets'] });
      }
      toast({
        title: tipo === 'preventiva'
          ? 'Visita preventiva solicitada com sucesso!'
          : 'Visita técnica solicitada com sucesso!',
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao solicitar visita',
        description: error.message,
      });
    },
  });

  const handleSubmit = () => {
    if (!clientId || !technicianId || !plannedDate || (tipo === 'corretiva' && !motivo.trim())) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe cliente, técnico, data planejada e o motivo da visita.',
      });
      return;
    }
    if (!checklistTemplateId) {
      toast({
        variant: 'destructive',
        title: 'Checklist obrigatório',
        description: 'Selecione o checklist da visita.',
      });
      return;
    }
    createVisita.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Visita</DialogTitle>
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

          {/* Tipo de visita */}
          <div className="space-y-2">
            <Label>Tipo de visita *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={tipo === 'corretiva' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTipo('corretiva')}
              >
                Corretiva
              </Button>
              <Button
                type="button"
                variant={tipo === 'preventiva' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTipo('preventiva')}
              >
                Preventiva
              </Button>
            </div>
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

          {/* Prioridade (apenas corretiva) */}
          {tipo === 'corretiva' && (
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
          )}

          {/* Checklist — obrigatório nos dois tipos */}
          <div className="space-y-2">
            <Label>Checklist *</Label>
            <Select value={checklistTemplateId} onValueChange={setChecklistTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o checklist" />
              </SelectTrigger>
              <SelectContent>
                {checklistTemplates?.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo (apenas corretiva) */}
          {tipo === 'corretiva' && (
            <div className="space-y-2">
              <Label>Motivo da visita *</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo da visita..."
                rows={4}
              />
            </div>
          )}
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
