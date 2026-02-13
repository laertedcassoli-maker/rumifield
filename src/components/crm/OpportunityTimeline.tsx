import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, MessageSquare, CheckSquare, Plus, Circle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OpportunityTimelineProps {
  clientProductId: string;
  clientId: string;
}

interface TimelineItem {
  id: string;
  type: 'note' | 'task';
  created_at: string;
  content?: string;
  user_name?: string;
  title?: string;
  description?: string;
  status?: 'aberta' | 'concluida';
  due_at?: string | null;
  priority?: number;
}

export function OpportunityTimeline({ clientProductId, clientId }: OpportunityTimelineProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [showInput, setShowInput] = useState(false);

  const { data: notes, isLoading: loadingNotes } = useQuery({
    queryKey: ['crm-opportunity-notes', clientProductId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_opportunity_notes')
        .select('id, content, created_at, user_id, profiles:user_id(nome)')
        .eq('client_product_id', clientProductId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        id: string; content: string; created_at: string; user_id: string;
        profiles: { nome: string } | null;
      }>;
    },
    enabled: !!clientProductId,
  });

  const { data: tasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['crm-actions-by-product', clientProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_actions')
        .select('id, title, description, status, due_at, priority, created_at')
        .eq('client_product_id', clientProductId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        id: string; title: string; description: string | null;
        status: string; due_at: string | null; priority: number; created_at: string;
      }>;
    },
    enabled: !!clientProductId,
  });

  const timeline: TimelineItem[] = [
    ...(notes || []).map((n): TimelineItem => ({
      id: n.id, type: 'note', created_at: n.created_at,
      content: n.content, user_name: n.profiles?.nome || 'Usuário',
    })),
    ...(tasks || []).map((t): TimelineItem => ({
      id: t.id, type: 'task', created_at: t.created_at,
      title: t.title, description: t.description || undefined,
      status: t.status as 'aberta' | 'concluida', due_at: t.due_at, priority: t.priority,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await (supabase as any)
        .from('crm_opportunity_notes')
        .insert({ client_product_id: clientProductId, user_id: user!.id, content: text });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent('');
      setShowInput(false);
      queryClient.invalidateQueries({ queryKey: ['crm-opportunity-notes', clientProductId] });
      queryClient.invalidateQueries({ queryKey: ['crm-opportunity-notes-counts', clientId] });
      toast.success('Interação registrada');
    },
    onError: () => toast.error('Erro ao salvar interação'),
  });

  const toggleTaskStatus = useMutation({
    mutationFn: async ({ taskId, newStatus }: { taskId: string; newStatus: 'aberta' | 'concluida' }) => {
      const { error } = await supabase
        .from('crm_actions')
        .update({ status: newStatus })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-actions-by-product', clientProductId] });
      queryClient.invalidateQueries({ queryKey: ['crm-actions-flat'] });
      queryClient.invalidateQueries({ queryKey: ['crm-360-actions'] });
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    addNote.mutate(trimmed);
  };

  const isLoading = loadingNotes || loadingTasks;
  if (isLoading) return <Skeleton className="h-16 w-full" />;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Interações e Tarefas</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowInput(v => !v)}
        >
          <Plus className="h-3 w-3" />
          Nova Interação
        </Button>
      </div>

      {/* Collapsible input */}
      {showInput && (
        <div className="flex gap-2">
          <Textarea
            placeholder="Nova interação..."
            value={content}
            onChange={e => setContent(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit(); }}
            autoFocus
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
      )}

      {/* Timeline */}
      {timeline.length > 0 ? (
        <div className="relative">
          {timeline.map((item, idx) => {
            const isLast = idx === timeline.length - 1;
            const isNote = item.type === 'note';
            const isDone = item.status === 'concluida';

            const iconBg = isNote
              ? 'bg-blue-100 text-blue-600'
              : isDone
                ? 'bg-green-100 text-green-600'
                : 'bg-amber-100 text-amber-600';

            return (
              <div key={item.id} className="flex gap-3">
                {/* Left: icon + line */}
                <div className="flex flex-col items-center">
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', iconBg)}>
                    {isNote ? (
                      <MessageSquare className="h-4 w-4" />
                    ) : (
                      <CheckSquare className="h-4 w-4" />
                    )}
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-border" />}
                </div>

                {/* Right: content */}
                <div className={cn('flex-1 min-w-0', !isLast && 'pb-4')}>
                  {isNote ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold">Interação</span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.user_name} · {format(new Date(item.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">{item.content}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          className="shrink-0"
                          onClick={() => toggleTaskStatus.mutate({
                            taskId: item.id,
                            newStatus: isDone ? 'aberta' : 'concluida',
                          })}
                          disabled={toggleTaskStatus.isPending}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                          )}
                        </button>
                        <span className={cn('text-xs font-semibold', isDone && 'line-through text-muted-foreground')}>
                          {item.title}
                        </span>
                        {item.due_at && (
                          <span className={cn('text-[10px] flex items-center gap-0.5',
                            !isDone && new Date(item.due_at) < new Date() ? 'text-destructive' : 'text-muted-foreground'
                          )}>
                            <Clock className="h-2.5 w-2.5" />
                            {format(new Date(item.due_at), 'dd/MM')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(item.created_at), "dd/MM/yy", { locale: ptBR })} · Tarefa
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhuma interação ou tarefa registrada</p>
      )}
    </div>
  );
}
