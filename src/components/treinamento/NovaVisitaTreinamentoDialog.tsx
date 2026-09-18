import { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
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

interface Responsavel {
  id: string;
  nome: string;
  tipo: 'tecnico' | 'csm';
}

const ROLE_LABELS: Record<string, string> = {
  tecnico_campo: 'Técnico de Campo',
  tecnico_oficina: 'Técnico de Oficina',
  consultor_rplus: 'Consultor R+',
  coordenador_rplus: 'Coordenador R+',
};

export interface EditingTrainingVisit {
  id: string;
  cliente_id: string;
  checklist_template_id: string | null;
  technician_user_id: string | null;
  csm_user_id: string | null;
  planned_date: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
}

interface NovaVisitaTreinamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando informado, o diálogo edita a visita existente em vez de criar uma nova */
  editingVisit?: EditingTrainingVisit | null;
}

/**
 * Solicitação de visita de treinamento em um único passo: insere direto em
 * training_visits (status 'pendente'), sem tabelas intermediárias.
 * Com editingVisit, atua como edição da visita pendente.
 */
export default function NovaVisitaTreinamentoDialog({ open, onOpenChange, editingVisit }: NovaVisitaTreinamentoDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [responsavelId, setResponsavelId] = useState('');
  const [plannedDate, setPlannedDate] = useState<Date | undefined>();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [checklistTemplateId, setChecklistTemplateId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Modo edição: pré-preenche todos os campos a partir da visita existente
  useEffect(() => {
    if (!open || !editingVisit) return;
    setClientId(editingVisit.cliente_id);
    setResponsavelId(editingVisit.technician_user_id ?? editingVisit.csm_user_id ?? '');
    setChecklistTemplateId(editingVisit.checklist_template_id ?? '');
    setPlannedDate(
      editingVisit.planned_date ? new Date(`${editingVisit.planned_date}T12:00:00`) : undefined
    );
    setContactName(editingVisit.contact_name ?? '');
    setContactPhone(editingVisit.contact_phone ?? '');
    setNotes(editingVisit.notes ?? '');
  }, [open, editingVisit]);

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

  // Responsável: técnicos (campo/oficina) ou CSMs (consultor/coordenador R+)
  const { data: responsaveis } = useQuery<Responsavel[]>({
    queryKey: ['training-responsaveis'],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['tecnico_campo', 'tecnico_oficina', 'consultor_rplus', 'coordenador_rplus']);
      if (error) throw error;
      if (!roles?.length) return [];

      const tipoPorUser = new Map<string, 'tecnico' | 'csm'>();
      const rolePorUser = new Map<string, string>();
      roles.forEach(r => {
        const isTecnico = r.role === 'tecnico_campo' || r.role === 'tecnico_oficina';
        // Se o usuário tem mais de um papel, técnico prevalece
        if (!tipoPorUser.has(r.user_id) || isTecnico) {
          tipoPorUser.set(r.user_id, isTecnico ? 'tecnico' : 'csm');
          rolePorUser.set(r.user_id, r.role);
        }
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', [...tipoPorUser.keys()])
        .eq('is_active', true)
        .order('nome');

      return (profiles || []).map(p => ({
        id: p.id,
        nome: `${p.nome} (${ROLE_LABELS[rolePorUser.get(p.id) ?? ''] ?? ''})`,
        tipo: tipoPorUser.get(p.id) ?? 'csm',
      }));
    },
    enabled: open,
  });

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
    setClientId('');
    setClientSearch('');
    setResponsavelId('');
    setPlannedDate(undefined);
    setChecklistTemplateId('');
    setContactName('');
    setContactPhone('');
    setNotes('');
    onOpenChange(false);
  };

  const createVisita = useMutation({
    mutationFn: async () => {
      const responsavel = responsaveis?.find(r => r.id === responsavelId);
      const payload = {
        cliente_id: clientId,
        checklist_template_id: checklistTemplateId || null,
        technician_user_id: responsavel?.tipo === 'tecnico' ? responsavelId : null,
        csm_user_id: responsavel?.tipo === 'csm' ? responsavelId : null,
        planned_date: plannedDate ? format(plannedDate, 'yyyy-MM-dd') : null,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        notes: notes.trim() || null,
      };

      if (editingVisit) {
        const { data, error } = await withTimeout(
          supabase
            .from('training_visits')
            .update(payload)
            .eq('id', editingVisit.id)
            .select('id')
        );
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('A edição não foi confirmada pelo servidor. Verifique suas permissões.');
        }
        return editingVisit.id;
      }

      const { data, error } = await withTimeout(
        supabase
          .from('training_visits')
          .insert({
            ...payload,
            status: 'pendente',
            created_by_user_id: user!.id,
          })
          .select('id')
          .single()
      );
      if (error) throw error;
      if (!data) throw new Error('A visita de treinamento não foi confirmada pelo servidor.');
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-visits'] });
      toast({
        title: editingVisit
          ? 'Visita de treinamento atualizada com sucesso!'
          : 'Visita de treinamento solicitada com sucesso!',
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: editingVisit
          ? 'Erro ao atualizar visita de treinamento'
          : 'Erro ao solicitar visita de treinamento',
        description: error.message,
      });
    },
  });

  const handleSubmit = () => {
    if (!clientId || !responsavelId) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe o cliente e o responsável pela visita.',
      });
      return;
    }
    createVisita.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Visita de Treinamento</DialogTitle>
          <DialogDescription>
            Solicite uma visita para treinar a equipe do cliente.
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

          {/* Técnico ou CSM responsável */}
          <div className="space-y-2">
            <Label>Técnico ou CSM responsável *</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {responsaveis?.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <Label>Checklist</Label>
            <Select value={checklistTemplateId} onValueChange={setChecklistTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o checklist (opcional)" />
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

          {/* Data planejada */}
          <div className="space-y-2">
            <Label>Data Planejada</Label>
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

          {/* Responsável treinado */}
          <div className="space-y-2">
            <Label>Nome de quem receberá o treinamento</Label>
            <Input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Ex.: João (operador)"
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* Motivo/observação */}
          <div className="space-y-2">
            <Label>Motivo / observação</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Descreva o objetivo do treinamento..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={createVisita.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createVisita.isPending}>
            {createVisita.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Solicitar Treinamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
