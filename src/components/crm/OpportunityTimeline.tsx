import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Send, MessageSquare, CheckSquare, Circle, CheckCircle2, Clock } from 'lucide-react';
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
  // Note fields
  content?: string;
  user_name?: string;
  // Task fields
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

  // Fetch notes
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
        id: string;
        content: string;
        created_at: string;
        user_id: string;
        profiles: { nome: string } | null;
      }>;
    },
    enabled: !!clientProductId,
  });

  // Fetch linked tasks
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
        id: string;
        title: string;
        description: string | null;
        status: string;
        due_at: string | null;
        priority: number;
        created_at: string;
      }>;
    },
    enabled: !!clientProductId,
  });

  // Merge into timeline
  const timeline: TimelineItem[] = [
    ...(notes || []).map((n): TimelineItem => ({
      id: n.id,
      type: 'note',
      created_at: n.created_at,
      content: n.content,
      user_name: n.profiles?.nome || 'Usuário',
    })),
    ...(tasks || []).map((t): TimelineItem => ({
      id: t.id,
      type: 'task',
      created_at: t.created_at,
      title: t.title,
      description: t.description || undefined,
      status: t.status as 'aberta' | 'concluida',
      due_at: t.due_at,
      priority: t.priority,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Add note mutation
  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await (supabase as any)
        .from('crm_opportunity_notes')
        .insert({ client_product_id: clientProductId, user_id: user!.id, content: text });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['crm-opportunity-notes', clientProductId] });
      queryClient.invalidateQueries({ queryKey: ['crm-opportunity-notes-counts', clientId] });
      toast.success('Interação registrada');
    },
    onError: () => toast.error('Erro ao salvar interação'),
  });

  // Toggle task status mutation
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

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const isLoading = loadingNotes || loadingTasks;

  if (isLoading) return <Skeleton className="h-16 w-full" />;

  return (
    <div className="space-y-3">
      {/* Input for new interaction */}
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

      {/* Unified Timeline */}
      {timeline.length > 0 ? (
        <div className="space-y-2">
          {timeline.map(item => (
            item.type === 'note' ? (
              <div key={item.id} className="flex gap-2">
                <div className="flex flex-col items-center">
                  <div className="rounded-full p-1 bg-muted">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium">{item.user_name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(item.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                </div>
              </div>
            ) : (
              <div key={item.id} className={cn(
                "flex gap-2 p-2 rounded-md border",
                item.status === 'concluida' ? 'bg-muted/50 opacity-70' : 'bg-background'
              )}>
                <button
                  className="shrink-0 mt-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTaskStatus.mutate({
                      taskId: item.id,
                      newStatus: item.status === 'concluida' ? 'aberta' : 'concluida',
                    });
                  }}
                  disabled={toggleTaskStatus.isPending}
                >
                  {item.status === 'concluida' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium", item.status === 'concluida' && 'line-through')}>
                      {item.title}
                    </span>
                    {item.due_at && (
                      <span className={cn("text-[10px] flex items-center gap-0.5",
                        item.status !== 'concluida' && new Date(item.due_at) < new Date() ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        <Clock className="h-2.5 w-2.5" />
                        {format(new Date(item.due_at), 'dd/MM')}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(item.created_at), "dd/MM/yy", { locale: ptBR })} · Tarefa
                  </span>
                </div>
              </div>
            )
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhuma interação ou tarefa registrada</p>
      )}
    </div>
  );
}
