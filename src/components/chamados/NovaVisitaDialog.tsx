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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Loader2, 
  CalendarIcon,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface NovaVisitaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  clientId: string;
}

export default function NovaVisitaDialog({
  open,
  onOpenChange,
  ticketId,
  clientId,
}: NovaVisitaDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [technicianId, setTechnicianId] = useState<string>('');
  const [plannedDate, setPlannedDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [checklistTemplateId, setChecklistTemplateId] = useState<string>('');
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // Fetch field technicians
  const { data: technicians } = useQuery({
    queryKey: ['field-technicians'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'tecnico_campo');
      
      if (!roles?.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', roles.map(r => r.user_id))
        .order('nome');
      
      return profiles || [];
    },
    enabled: open,
  });

  // Fetch active checklist templates
  const { data: checklistTemplates } = useQuery({
    queryKey: ['active-checklist-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Create visit mutation
  const createVisit = useMutation({
    mutationFn: async () => {
      if (!technicianId) throw new Error('Selecione um técnico');

      const { data: visit, error } = await supabase
        .from('ticket_visits')
        .insert({
          ticket_id: ticketId,
          client_id: clientId,
          field_technician_user_id: technicianId,
          status: 'em_elaboracao',
          planned_start_date: plannedDate ? format(plannedDate, 'yyyy-MM-dd') : null,
          checklist_template_id: checklistTemplateId || null,
          internal_notes: notes || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Update ticket status to em_atendimento and substatus to aguardando_visita
      await supabase
        .from('technical_tickets')
        .update({
          status: 'em_atendimento',
          substatus: 'aguardando_visita',
        })
        .eq('id', ticketId);

      // Add timeline entry
      await supabase.from('ticket_timeline').insert({
        ticket_id: ticketId,
        user_id: user!.id,
        event_type: 'visit_created',
        event_description: plannedDate 
          ? `Visita agendada para ${format(plannedDate, "dd/MM/yyyy", { locale: ptBR })}`
          : 'Visita criada (data a definir)',
      });

      return visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-visits', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-timeline', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
      toast({ title: 'Visita agendada com sucesso!' });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao agendar visita',
        description: error.message,
      });
    },
  });

  const handleClose = () => {
    setTechnicianId('');
    setPlannedDate(undefined);
    setNotes('');
    setChecklistTemplateId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Visita Corretiva</DialogTitle>
          <DialogDescription>
            Agende uma visita técnica para resolver este chamado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Técnico */}
          <div className="space-y-2">
            <Label>Técnico de Campo *</Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um técnico" />
              </SelectTrigger>
              <SelectContent>
                {technicians?.map(tech => (
                  <SelectItem key={tech.id} value={tech.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {tech.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Planejada */}
          <div className="space-y-2">
            <Label>Data Planejada</Label>
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
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Checklist Template */}
          <div className="space-y-2">
            <Label>Template de Checklist</Label>
            <Select value={checklistTemplateId} onValueChange={setChecklistTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template (opcional)" />
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

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas Internas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções para o técnico..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => createVisit.mutate()}
            disabled={!technicianId || createVisit.isPending}
          >
            {createVisit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agendar Visita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
