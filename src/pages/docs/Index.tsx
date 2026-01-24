import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BookOpen, 
  FileText, 
  Plus, 
  MessageSquare,
  Layers,
  Shield,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  visao_geral: { label: 'Visão Geral', icon: Eye, color: 'bg-blue-100 text-blue-700' },
  modulo: { label: 'Módulo', icon: Layers, color: 'bg-green-100 text-green-700' },
  regra_transversal: { label: 'Regra', icon: Shield, color: 'bg-amber-100 text-amber-700' },
  permissao: { label: 'Permissão', icon: Shield, color: 'bg-purple-100 text-purple-700' },
};

export default function DocsIndex() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState('all');

  const canEdit = role === 'admin' || role === 'coordenador_servicos';

  const { data: docs, isLoading } = useQuery({
    queryKey: ['system-documentation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_documentation')
        .select('*')
        .order('category')
        .order('title');
      
      if (error) throw error;
      return data;
    },
  });

  const filteredDocs = docs?.filter(doc => 
    activeTab === 'all' || doc.category === activeTab
  );

  const groupedDocs = filteredDocs?.reduce((acc, doc) => {
    const category = doc.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, typeof docs>);

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Documentação do Sistema
          </h1>
          <p className="text-muted-foreground mt-1">
            Base de conhecimento e regras de negócio
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/docs/chat">
            <Button variant="outline">
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat com IA
            </Button>
          </Link>
          {canEdit && (
            <Link to="/docs/novo">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Documento
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="visao_geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="modulo">Módulos</TabsTrigger>
          <TabsTrigger value="regra_transversal">Regras</TabsTrigger>
          <TabsTrigger value="permissao">Permissões</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : !filteredDocs?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-1">Nenhum documento encontrado</h3>
                <p className="text-muted-foreground text-sm">
                  {canEdit ? 'Crie o primeiro documento para começar.' : 'A documentação será adicionada em breve.'}
                </p>
                {canEdit && (
                  <Link to="/docs/novo">
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Documento
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedDocs || {}).map(([category, categoryDocs]) => {
                const config = categoryConfig[category] || { label: category, icon: FileText, color: 'bg-gray-100 text-gray-700' };
                const CategoryIcon = config.icon;
                
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-4">
                      <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                      <h2 className="text-lg font-semibold">{config.label}</h2>
                      <Badge variant="secondary" className="ml-2">
                        {categoryDocs?.length}
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {categoryDocs?.map(doc => (
                        <Link key={doc.id} to={`/docs/${doc.slug}`}>
                          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                            <CardHeader>
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-base line-clamp-2">
                                  {doc.title}
                                </CardTitle>
                                <Badge className={config.color}>
                                  {config.label}
                                </Badge>
                              </div>
                              {doc.summary && (
                                <CardDescription className="line-clamp-2">
                                  {doc.summary}
                                </CardDescription>
                              )}
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-xs text-muted-foreground">
                                Atualizado em {format(new Date(doc.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
