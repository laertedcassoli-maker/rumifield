import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/supabase-helpers';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface EditarVisitaCorretivaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string;
  plannedDate: string | null;
  technicianId: string | null;
  checklistTemplateId: string | null;
}

/**
 * Edição dos dados da própria visita corretiva (data planejada, técnico e
 * template de checklist). Restrito a admin/coordenador de serviços pela tela.
 */
export default function EditarVisitaCorretivaDialog({
  open,
  onOpenChange,
  visitId,
  plannedDate,
  technicianId,
  checklistTemplateId,
}: EditarVisitaCorretivaDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [date, setDate] = useState<Date | undefined>();
  const [tecnico, setTecnico] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(plannedDate ? new Date(`${plannedDate}T12:00:00`) : undefined);
    setTecnico(technicianId ?? '');
    setTemplateId(checklistTemplateId ?? '');
  }, [open, plannedDate, technicianId, checklistTemplateId]);

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
        .eq('is_active', true)
        .order('nome');
      return profiles || [];
    },
    enabled: open,
  });

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

  const salvar = useMutation({
    mutationFn: async () => {
      const { data, error } = await withTimeout(
        supabase
          .from('ticket_visits')
          .update({
            planned_start_date: date ? format(date, 'yyyy-MM-dd') : null,
            field_technician_user_id: tecnico,
            checklist_template_id: templateId,
          })
          .eq('id', visitId)
          .select('id')
      );
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('A alteração não foi confirmada pelo servidor. Verifique suas permissões.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corrective-visit-execution', visitId] });
      queryClient.invalidateQueries({ queryKey: ['my-corrective-visits'] });
      toast({ title: 'Dados da visita atualizados!' });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar visita', description: error.message });
    },
  });

  const handleSubmit = () => {
    if (!date || !tecnico || !templateId) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe a data planejada, o técnico e o checklist da visita.',
      });
      return;
    }
    salvar.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar dados da visita</DialogTitle>
          <DialogDescription>
            Altere a data planejada, o técnico responsável e o checklist da visita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Data Planejada *</Label>
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setDatePopoverOpen(false);
                  }}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Técnico de Campo *</Label>
            <Select value={tecnico} onValueChange={setTecnico}>
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

          <div className="space-y-2">
            <Label>Template de Checklist *</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {checklistTemplates?.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
