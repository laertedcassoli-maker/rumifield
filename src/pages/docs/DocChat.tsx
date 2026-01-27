import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import ReactMarkdown from 'react-markdown';
import { 
  ArrowLeft, 
  Send, 
  MessageSquare, 
  Bot, 
  User, 
  Loader2,
  BookOpen,
  Shield,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sourceDocIds?: string[];
}

export default function DocChat() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canAccess = role === 'admin' || role === 'coordenador_servicos';

  // Load chat history
  const { data: chatHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['doc-chat-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doc_chat_history')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: canAccess,
  });

  // Load history into messages
  useEffect(() => {
    if (chatHistory) {
      const historicalMessages: Message[] = chatHistory.flatMap(entry => [
        {
          id: `${entry.id}-q`,
          role: 'user' as const,
          content: entry.question,
          timestamp: new Date(entry.created_at),
        },
        {
          id: `${entry.id}-a`,
          role: 'assistant' as const,
          content: entry.answer,
          timestamp: new Date(entry.created_at),
          sourceDocIds: entry.source_doc_ids || [],
        },
      ]);
      setMessages(historicalMessages);
    }
  }, [chatHistory]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const { data, error } = await supabase.functions.invoke('doc-chat', {
        body: { question },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onMutate: (question) => {
      // Add user message immediately
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: question,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
    },
    onSuccess: async (data) => {
      // Add assistant message
      const assistantMessage: Message = {
        id: `resp-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        sourceDocIds: data.source_doc_ids || [],
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Save to history
      if (user) {
        await supabase.from('doc_chat_history').insert({
          user_id: user.id,
          question: input,
          answer: data.answer,
          source_doc_ids: data.source_doc_ids || [],
        });
      }
    },
    onError: (error: Error) => {
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
      toast.error(error.message || 'Erro ao processar pergunta');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;
    
    const question = input.trim();
    setInput('');
    chatMutation.mutate(question);
  };

  const handleClearHistory = async () => {
    if (!user) return;
    
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('doc_chat_history')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ['doc-chat-history'] });
      toast.success('Histórico limpo com sucesso');
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      toast.error('Erro ao limpar histórico');
    } finally {
      setIsClearing(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              O chat de documentação está disponível apenas para Admin e Coordenadores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    
    return (
      <div
        key={message.id}
        className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
      >
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
        <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
          <div
            className={`inline-block p-3 rounded-lg text-left ${
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap text-sm">{message.content}</div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-code:bg-background/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {format(message.timestamp, 'HH:mm', { locale: ptBR })}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/docs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Chat com IA
            </h1>
            <p className="text-sm text-muted-foreground">
              Pergunte sobre regras e funcionalidades do sistema
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isClearing}>
                  {isClearing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Limpar</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar histórico?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá apagar todo o histórico de conversas com a IA. 
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearHistory}>
                    Limpar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Badge variant="secondary" className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            Baseado na documentação
          </Badge>
        </div>
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col h-[calc(100%-5rem)]">
        <CardContent className="flex-1 p-0 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {historyLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-20 flex-1 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Bot className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold mb-2">Assistente de Documentação</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Faça perguntas sobre regras de negócio, fluxos do sistema e permissões.
                  As respostas são baseadas exclusivamente na documentação oficial.
                </p>
                <div className="mt-6 space-y-2 text-left">
                  <p className="text-xs text-muted-foreground font-medium">Exemplos de perguntas:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Quem pode editar uma rota preventiva?',
                      'Quais status existem para um chamado?',
                      'Quando usar substatus aguardando_peca?',
                    ].map((q, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setInput(q)}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(renderMessage)}
                {chatMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm text-muted-foreground">Consultando documentação...</p>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua pergunta sobre o sistema..."
                disabled={chatMutation.isPending}
                className="flex-1"
              />
              <Button type="submit" disabled={chatMutation.isPending || !input.trim()}>
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Respostas baseadas exclusivamente na documentação interna do sistema.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
