import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  BookOpen, 
  FileText, 
  Plus, 
  MessageSquare,
  Layers,
  Shield,
  Eye,
  Database,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Loader2,
  Search,
  Copy,
  Check
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  visao_geral: { label: 'Visão Geral', icon: Eye, color: 'bg-blue-100 text-blue-700' },
  modulo: { label: 'Módulo', icon: Layers, color: 'bg-green-100 text-green-700' },
  regra_transversal: { label: 'Regra', icon: Shield, color: 'bg-amber-100 text-amber-700' },
  permissao: { label: 'Permissão', icon: Shield, color: 'bg-purple-100 text-purple-700' },
  tabela: { label: 'Tabela', icon: Database, color: 'bg-cyan-100 text-cyan-700' },
};

interface SchemaChange {
  type: string;
  table_name: string;
  details: string;
}

interface SchemaSummary {
  total_tables: number;
  documented_tables: number;
  undocumented_count: number;
  changes: SchemaChange[];
}

interface CodeChange {
  type: string;
  module_name: string;
  module_type: string;
  module_path: string;
  details: string;
}

interface CodeSummary {
  total_modules: number;
  documented_modules: number;
  undocumented_count: number;
  changes: CodeChange[];
  module_types: {
    pages: number;
    components: number;
    hooks: number;
    contexts: number;
  };
}

export default function DocsIndex() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDetectingSchema, setIsDetectingSchema] = useState(false);
  const [isDetectingCode, setIsDetectingCode] = useState(false);
  const [isGeneratingTables, setIsGeneratingTables] = useState(false);
  const [isGeneratingModules, setIsGeneratingModules] = useState(false);
  const [schemaChanges, setSchemaChanges] = useState<SchemaSummary | null>(null);
  const [codeChanges, setCodeChanges] = useState<CodeSummary | null>(null);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [copiedLink, setCopiedLink] = useState(false);
  const [detectionMode, setDetectionMode] = useState<'schema' | 'code' | null>(null);

  const publicDocsUrl = 'https://rumifield.lovable.app/docs/public';

  const canEdit = role === 'admin' || role === 'coordenador_servicos';

  const { data: docs, isLoading, refetch } = useQuery({
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

  const detectSchemaChanges = async () => {
    setIsDetectingSchema(true);
    setSelectedTables(new Set());
    setDetectionMode('schema');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('detect-schema-changes', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      setSchemaChanges(data as SchemaSummary);
      setCodeChanges(null);
    } catch (error) {
      console.error('Error detecting schema changes:', error);
      toast.error('Erro ao detectar mudanças no schema');
    } finally {
      setIsDetectingSchema(false);
    }
  };

  const detectCodeChanges = async () => {
    setIsDetectingCode(true);
    setSelectedModules(new Set());
    setDetectionMode('code');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('detect-code-changes', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      setCodeChanges(data as CodeSummary);
      setSchemaChanges(null);
    } catch (error) {
      console.error('Error detecting code changes:', error);
      toast.error('Erro ao detectar mudanças de código');
    } finally {
      setIsDetectingCode(false);
    }
  };

  const toggleTableSelection = (tableName: string) => {
    setSelectedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
      }
      return newSet;
    });
  };

  const toggleModuleSelection = (moduleName: string) => {
    setSelectedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleName)) {
        newSet.delete(moduleName);
      } else {
        newSet.add(moduleName);
      }
      return newSet;
    });
  };

  const selectAllTables = () => {
    if (!schemaChanges) return;
    const allTables = schemaChanges.changes.map(c => c.table_name);
    setSelectedTables(new Set(allTables));
  };

  const selectAllModules = () => {
    if (!codeChanges) return;
    const allModules = codeChanges.changes.map(c => c.module_name);
    setSelectedModules(new Set(allModules));
  };

  const deselectAllTables = () => {
    setSelectedTables(new Set());
  };

  const deselectAllModules = () => {
    setSelectedModules(new Set());
  };

  const generateTableDocumentation = async () => {
    if (selectedTables.size === 0) {
      toast.error('Selecione pelo menos uma tabela');
      return;
    }

    setIsGeneratingTables(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const tablesToDocument = Array.from(selectedTables);
      
      const { data, error } = await supabase.functions.invoke('generate-table-docs', {
        body: { tables: tablesToDocument },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      
      toast.success(`${data.generated} documento(s) de tabela gerado(s)!`);
      setSchemaChanges(null);
      setSelectedTables(new Set());
      refetch();
    } catch (error) {
      console.error('Error generating table documentation:', error);
      toast.error('Erro ao gerar documentação de tabelas');
    } finally {
      setIsGeneratingTables(false);
    }
  };

  const generateModuleDocumentation = async () => {
    if (selectedModules.size === 0) {
      toast.error('Selecione pelo menos um módulo');
      return;
    }

    setIsGeneratingModules(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const modulesToDocument = codeChanges?.changes
        .filter(c => selectedModules.has(c.module_name))
        .map(c => ({
          name: c.module_name,
          type: c.module_type,
          path: c.module_path,
          category: c.details.includes('regra_transversal') ? 'regra_transversal' : 'modulo'
        })) || [];
      
      const { data, error } = await supabase.functions.invoke('generate-module-docs', {
        body: { modules: modulesToDocument },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      
      toast.success(`${data.generated} documento(s) de módulo gerado(s)!`);
      setCodeChanges(null);
      setSelectedModules(new Set());
      refetch();
    } catch (error) {
      console.error('Error generating module documentation:', error);
      toast.error('Erro ao gerar documentação de módulos');
    } finally {
      setIsGeneratingModules(false);
    }
  };

  const closeDetection = () => {
    setSchemaChanges(null);
    setCodeChanges(null);
    setSelectedTables(new Set());
    setSelectedModules(new Set());
    setDetectionMode(null);
  };

  const filteredDocs = docs?.filter(doc => {
    const matchesTab = activeTab === 'all' || doc.category === activeTab;
    const matchesSearch = !searchQuery || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

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
        <div className="flex flex-wrap gap-2">
          <a href={publicDocsUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Link Público
            </Button>
          </a>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              navigator.clipboard.writeText(publicDocsUrl);
              setCopiedLink(true);
              toast.success('Link copiado!');
              setTimeout(() => setCopiedLink(false), 2000);
            }}
          >
            {copiedLink ? (
              <Check className="mr-2 h-4 w-4 text-green-500" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copiar Link
          </Button>
          {canEdit && (
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={detectSchemaChanges} 
                disabled={isDetectingSchema || isDetectingCode}
              >
                <Database className={`mr-2 h-4 w-4 ${isDetectingSchema ? 'animate-spin' : ''}`} />
                Tabelas
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={detectCodeChanges} 
                disabled={isDetectingSchema || isDetectingCode}
              >
                <Layers className={`mr-2 h-4 w-4 ${isDetectingCode ? 'animate-spin' : ''}`} />
                Módulos
              </Button>
            </div>
          )}
          <Link to="/docs/chat">
            <Button variant="outline" size="sm">
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat com IA
            </Button>
          </Link>
          {canEdit && (
            <Link to="/docs/novo">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Novo Documento
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Schema Changes Result */}
      {schemaChanges && (
        <Card className={schemaChanges.undocumented_count > 0 ? 'border-amber-500' : 'border-green-500'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {schemaChanges.undocumented_count > 0 ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  {schemaChanges.undocumented_count} tabela(s) sem documentação
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Todas as tabelas estão documentadas!
                </>
              )}
            </CardTitle>
            <CardDescription>
              {schemaChanges.documented_tables} de {schemaChanges.total_tables} tabelas documentadas
            </CardDescription>
          </CardHeader>
          {schemaChanges.undocumented_count > 0 && (
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 mb-3">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={selectAllTables}
                >
                  Selecionar todas
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={deselectAllTables}
                >
                  Limpar seleção
                </Button>
                {selectedTables.size > 0 && (
                  <Badge variant="secondary">
                    {selectedTables.size} selecionada(s)
                  </Badge>
                )}
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {schemaChanges.changes.map((change, i) => (
                  <div 
                    key={i} 
                    className={`text-sm p-2 rounded flex items-start gap-3 cursor-pointer transition-colors ${
                      selectedTables.has(change.table_name) 
                        ? 'bg-primary/10 border border-primary/30' 
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                    onClick={() => toggleTableSelection(change.table_name)}
                  >
                    <Checkbox 
                      checked={selectedTables.has(change.table_name)}
                      onCheckedChange={() => toggleTableSelection(change.table_name)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono font-medium">{change.table_name}</span>
                      <p className="text-muted-foreground text-xs mt-1">{change.details}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button 
                  size="sm" 
                  onClick={generateTableDocumentation}
                  disabled={selectedTables.size === 0 || isGeneratingTables}
                >
                  {isGeneratingTables ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Gerar Docs ({selectedTables.size})
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={closeDetection}
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Code Changes Result */}
      {codeChanges && (
        <Card className={codeChanges.undocumented_count > 0 ? 'border-amber-500' : 'border-green-500'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {codeChanges.undocumented_count > 0 ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  {codeChanges.undocumented_count} módulo(s) sem documentação
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Todos os módulos estão documentados!
                </>
              )}
            </CardTitle>
            <CardDescription>
              {codeChanges.documented_modules} de {codeChanges.total_modules} módulos documentados
              <span className="ml-2 text-xs">
                ({codeChanges.module_types.pages} páginas, {codeChanges.module_types.components} componentes, {codeChanges.module_types.hooks} hooks, {codeChanges.module_types.contexts} contexts)
              </span>
            </CardDescription>
          </CardHeader>
          {codeChanges.undocumented_count > 0 && (
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 mb-3">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={selectAllModules}
                >
                  Selecionar todos
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={deselectAllModules}
                >
                  Limpar seleção
                </Button>
                {selectedModules.size > 0 && (
                  <Badge variant="secondary">
                    {selectedModules.size} selecionado(s)
                  </Badge>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {codeChanges.changes.map((change, i) => (
                  <div 
                    key={i} 
                    className={`text-sm p-2 rounded flex items-start gap-3 cursor-pointer transition-colors ${
                      selectedModules.has(change.module_name) 
                        ? 'bg-primary/10 border border-primary/30' 
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                    onClick={() => toggleModuleSelection(change.module_name)}
                  >
                    <Checkbox 
                      checked={selectedModules.has(change.module_name)}
                      onCheckedChange={() => toggleModuleSelection(change.module_name)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{change.module_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {change.module_type}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs mt-1 font-mono">{change.module_path}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button 
                  size="sm" 
                  onClick={generateModuleDocumentation}
                  disabled={selectedModules.size === 0 || isGeneratingModules}
                >
                  {isGeneratingModules ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Gerar Docs ({selectedModules.size})
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={closeDetection}
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Search + Tabs */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar documentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="visao_geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="modulo">Módulos</TabsTrigger>
            <TabsTrigger value="regra_transversal">Regras</TabsTrigger>
            <TabsTrigger value="permissao">Permissões</TabsTrigger>
            <TabsTrigger value="tabela">Tabelas</TabsTrigger>
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
    </div>
  );
}
