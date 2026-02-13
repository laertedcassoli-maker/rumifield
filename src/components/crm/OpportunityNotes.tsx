import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, ListTodo, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface OpportunityNotesProps {
  clientProductId: string;
  clientId: string;
}

export function OpportunityNotes({ clientProductId, clientId }: OpportunityNotesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [createAction, setCreateAction] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');
  const [actionPriority, setActionPriority] = useState<number>(2);

  const { data: notes, isLoading } = useQuery({
    queryKey: ['crm-opportunity-notes', clientProductId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_opportunity_notes')
        .select('id, content, created_at, user_id, profiles:user_id(nome)')
        .eq('client_product_id', clientProductId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        content: string;
        created_at: string;
        user_id: string;
        profiles: { nome: string } | null;
      }>;
    },
    enabled: !!clientProductId,
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await (supabase as any)
        .from('crm_opportunity_notes')
        .insert({ client_product_id: clientProductId, user_id: user!.id, content: text });
      if (error) throw error;

      // Create CRM action if toggle is on
      if (createAction) {
        const title = actionTitle.trim() || text.substring(0, 80);
        const { error: actionError } = await supabase
          .from('crm_actions')
          .insert({
            client_id: clientId,
            client_product_id: clientProductId,
            title,
            type: 'tarefa',
            status: 'aberta',
            priority: actionPriority,
            due_at: actionDueDate || null,
            description: text,
            owner_user_id: user!.id,
            created_by: user!.id,
          });
        if (actionError) throw actionError;
      }
    },
    onSuccess: () => {
      const actionCreated = createAction;
      setContent('');
      setCreateAction(false);
      setActionTitle('');
      setActionDueDate('');
      setActionPriority(2);
      queryClient.invalidateQueries({ queryKey: ['crm-opportunity-notes', clientProductId] });
      queryClient.invalidateQueries({ queryKey: ['crm-opportunity-notes-counts', clientId] });
      if (actionCreated) {
        queryClient.invalidateQueries({ queryKey: ['crm-360-actions'] });
        toast.success('Interação registrada e ação criada');
      } else {
        toast.success('Interação registrada');
      }
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    addNote.mutate(trimmed);
  };

  const handleToggleAction = (checked: boolean) => {
    setCreateAction(checked);
    if (checked && !actionTitle) {
      setActionTitle(content.trim().substring(0, 80));
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  if (isLoading) return <Skeleton className="h-16 w-full" />;

  return (
    <div className="space-y-3">
      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Nova interação..."
          value={content}
          onChange={e => setContent(e.target.value)}
          className="min-h-[60px] text-sm resize-none"
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit(); }}
        />
        <Button
          size="icon"
          className="shrink-0 self-end"
          disabled={!content.trim() || addNote.isPending}
          onClick={handleSubmit}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Create Action Toggle */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Switch
            id={`create-action-${clientProductId}`}
            checked={createAction}
            onCheckedChange={handleToggleAction}
          />
          <Label htmlFor={`create-action-${clientProductId}`} className="text-xs flex items-center gap-1 cursor-pointer">
            <ListTodo className="h-3.5 w-3.5" />
            Criar ação pendente
          </Label>
        </div>

        {createAction && (
          <div className="space-y-2 pl-1 border-l-2 border-primary/20 ml-4 animate-fade-in">
            <Input
              placeholder="Título da ação (opcional, usa texto da nota)"
              value={actionTitle}
              onChange={e => setActionTitle(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="date"
                    value={actionDueDate}
                    onChange={e => setActionDueDate(e.target.value)}
                    className="h-8 text-sm pl-8"
                    placeholder="Vencimento"
                  />
                </div>
              </div>
              <div className="flex gap-1">
                {[
                  { value: 1, label: 'Alta', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
                  { value: 2, label: 'Média', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                  { value: 3, label: 'Baixa', cls: 'bg-muted text-muted-foreground border-border' },
                ].map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setActionPriority(p.value)}
                    className={`px-2 py-1 text-[10px] rounded border transition-all ${p.cls} ${actionPriority === p.value ? 'ring-1 ring-offset-1 ring-primary font-semibold' : 'opacity-60'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      {notes && notes.length > 0 && (
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className="text-[10px] bg-muted">
                  {getInitials(note.profiles?.nome || '?')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{note.profiles?.nome || 'Usuário'}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(note.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {notes && notes.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhuma interação registrada</p>
      )}
    </div>
  );
}
