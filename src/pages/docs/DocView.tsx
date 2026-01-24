import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  BookOpen,
  Calendar,
  User,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const categoryConfig: Record<string, { label: string; color: string }> = {
  visao_geral: { label: 'Visão Geral', color: 'bg-blue-100 text-blue-700' },
  modulo: { label: 'Módulo', color: 'bg-green-100 text-green-700' },
  regra_transversal: { label: 'Regra Transversal', color: 'bg-amber-100 text-amber-700' },
  permissao: { label: 'Permissão', color: 'bg-purple-100 text-purple-700' },
};

export default function DocView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, user } = useAuth();

  const canEdit = role === 'admin' || role === 'coordenador_servicos';

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ['system-documentation', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_documentation')
        .select('*, profiles:updated_by(nome)')
        .eq('slug', slug)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('system_documentation')
        .delete()
        .eq('id', doc?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-documentation'] });
      toast.success('Documento excluído');
      navigate('/docs');
    },
    onError: () => {
      toast.error('Erro ao excluir documento');
    },
  });

  if (!role || !['admin', 'coordenador_servicos'].includes(role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              A documentação do sistema está disponível apenas para Admin e Coordenadores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="space-y-6">
        <Link to="/docs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-1">Documento não encontrado</h3>
            <p className="text-muted-foreground text-sm">
              O documento solicitado não existe ou foi removido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = categoryConfig[doc.category] || { label: doc.category, color: 'bg-gray-100 text-gray-700' };

  // Simple markdown to HTML conversion
  const renderContent = (content: string) => {
    return content
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-2xl font-bold mt-6 mb-4">{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-medium mt-4 mb-2">{line.slice(4)}</h3>;
        }
        // List items
        if (line.startsWith('- **') && line.includes('**:')) {
          const match = line.match(/^- \*\*(.+?)\*\*:(.+)$/);
          if (match) {
            return (
              <li key={i} className="ml-4 mb-1">
                <strong>{match[1]}</strong>:{match[2]}
              </li>
            );
          }
        }
        if (line.startsWith('- ')) {
          return <li key={i} className="ml-4 mb-1">{line.slice(2)}</li>;
        }
        // Numbered list
        if (/^\d+\. /.test(line)) {
          const match = line.match(/^(\d+)\. (.+)$/);
          if (match) {
            return <li key={i} className="ml-4 mb-1 list-decimal">{match[2]}</li>;
          }
        }
        // Bold text
        if (line.includes('**')) {
          const parts = line.split(/\*\*(.+?)\*\*/g);
          return (
            <p key={i} className="mb-2">
              {parts.map((part, j) => 
                j % 2 === 1 ? <strong key={j}>{part}</strong> : part
              )}
            </p>
          );
        }
        // Empty line
        if (line.trim() === '') {
          return <br key={i} />;
        }
        // Regular paragraph
        return <p key={i} className="mb-2">{line}</p>;
      });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <Link to="/docs">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Documentação
        </Button>
      </Link>

      {/* Document card */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={config.color}>{config.label}</Badge>
              </div>
              <h1 className="text-2xl font-bold">{doc.title}</h1>
              {doc.summary && (
                <p className="text-muted-foreground">{doc.summary}</p>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Link to={`/docs/${doc.slug}/editar`}>
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O documento será permanentemente removido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
          
          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Atualizado em {format(new Date(doc.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
            {doc.profiles && (
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>Por {(doc.profiles as any).nome}</span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {renderContent(doc.content)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
