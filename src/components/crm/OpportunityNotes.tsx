import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface OpportunityNotesProps {
  clientProductId: string;
  clientId: string;
  onCreateAction?: (noteContent: string) => void;
}

export function OpportunityNotes({ clientProductId, clientId, onCreateAction }: OpportunityNotesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');

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
      return text;
    },
    onSuccess: (savedText) => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['crm-opportunity-notes', clientProductId] });
      queryClient.invalidateQueries({ queryKey: ['crm-opportunity-notes-counts', clientId] });
      
      if (onCreateAction) {
        toast.success('Interação registrada', {
          action: {
            label: 'Criar Ação',
            onClick: () => onCreateAction(savedText),
          },
          duration: 6000,
        });
      } else {
        toast.success('Interação registrada');
      }
    },
    onError: () => toast.error('Erro ao salvar interação'),
  });

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    addNote.mutate(trimmed);
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
