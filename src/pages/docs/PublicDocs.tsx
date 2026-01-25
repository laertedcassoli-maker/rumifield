import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Book, 
  FileText, 
  Layers, 
  Shield, 
  Database,
  ExternalLink,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  visao_geral: { label: 'Visão Geral', icon: Book, color: 'bg-blue-100 text-blue-700' },
  modulo: { label: 'Módulo', icon: Layers, color: 'bg-green-100 text-green-700' },
  regra_transversal: { label: 'Regra', icon: Shield, color: 'bg-amber-100 text-amber-700' },
  permissao: { label: 'Permissão', icon: Shield, color: 'bg-purple-100 text-purple-700' },
  tabela: { label: 'Tabela', icon: Database, color: 'bg-cyan-100 text-cyan-700' },
};

interface Doc {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string | null;
  content: string;
  updated_at: string;
}

export default function PublicDocs() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['public-documentation'],
    queryFn: async () => {
      // @ts-ignore - is_public column not yet in types
      const { data, error } = await supabase
        .from('system_documentation')
        .select('*')
        .eq('is_public', true)
        .order('category')
        .order('title');
      if (error) throw error;
      return data as Doc[];
    },
  });

  const filteredDocs = docs?.filter(doc => {
    const matchesTab = activeTab === 'all' || doc.category === activeTab;
    const matchesSearch = searchQuery === '' || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  }) || [];

  const groupedDocs = filteredDocs.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, Doc[]>);

  if (selectedDoc) {
    const config = categoryConfig[selectedDoc.category] || { label: selectedDoc.category, icon: FileText, color: 'bg-gray-100 text-gray-700' };
    const Icon = config.icon;

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button 
            onClick={() => setSelectedDoc(null)}
            className="text-primary hover:underline mb-6 flex items-center gap-2"
          >
            ← Voltar para lista
          </button>

          <div className="mb-6">
            <Badge className={config.color}>
              <Icon className="mr-1 h-3 w-3" />
              {config.label}
            </Badge>
          </div>

          <h1 className="text-3xl font-bold mb-2">{selectedDoc.title}</h1>
          
          {selectedDoc.summary && (
            <p className="text-muted-foreground mb-6">{selectedDoc.summary}</p>
          )}

          <div className="text-sm text-muted-foreground mb-8">
            Atualizado em {format(new Date(selectedDoc.updated_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </div>

          <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
            {selectedDoc.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Book className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Documentação do Sistema</h1>
          </div>
          <p className="text-muted-foreground">
            Documentação técnica e regras de negócio do RumiField
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar na documentação..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="visao_geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="modulo">Módulos</TabsTrigger>
            <TabsTrigger value="regra_transversal">Regras</TabsTrigger>
            <TabsTrigger value="permissao">Permissões</TabsTrigger>
            <TabsTrigger value="tabela">Tabelas</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-semibold">Nenhum documento encontrado</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Tente uma busca diferente' : 'Nenhum documento disponível nesta categoria'}
                </p>
              </div>
            ) : (
              Object.entries(groupedDocs).map(([category, categoryDocs]) => {
                const config = categoryConfig[category] || { label: category, icon: FileText, color: 'bg-gray-100 text-gray-700' };
                const Icon = config.icon;

                return (
                  <div key={category} className="mb-8">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {config.label}
                      <Badge variant="secondary" className="ml-2">{categoryDocs.length}</Badge>
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {categoryDocs.map(doc => (
                        <Card 
                          key={doc.id} 
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setSelectedDoc(doc)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <Badge className={`${config.color} text-xs`}>
                                <Icon className="mr-1 h-3 w-3" />
                                {config.label}
                              </Badge>
                            </div>
                            <CardTitle className="text-base mt-2">{doc.title}</CardTitle>
                            {doc.summary && (
                              <CardDescription className="line-clamp-2">
                                {doc.summary}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-muted-foreground">
                              Atualizado em {format(new Date(doc.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
