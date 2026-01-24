import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const categories = [
  { value: 'visao_geral', label: 'Visão Geral' },
  { value: 'modulo', label: 'Módulo' },
  { value: 'regra_transversal', label: 'Regra Transversal' },
  { value: 'permissao', label: 'Permissão' },
];

export default function DocEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, user } = useAuth();

  const isEditing = !!slug && slug !== 'novo';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('modulo');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');

  const canEdit = role === 'admin' || role === 'coordenador_servicos';

  const { data: doc, isLoading } = useQuery({
    queryKey: ['system-documentation', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_documentation')
        .select('*')
        .eq('slug', slug)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setCategory(doc.category);
      setSummary(doc.summary || '');
      setContent(doc.content);
    }
  }, [doc]);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const slug = isEditing ? doc?.slug : generateSlug(title);
      
      const docData = {
        title,
        slug,
        category: category as 'visao_geral' | 'modulo' | 'regra_transversal' | 'permissao',
        summary: summary || null,
        content,
        updated_by: user?.id,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('system_documentation')
          .update(docData)
          .eq('id', doc?.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_documentation')
          .insert(docData);
        if (error) throw error;
      }

      return slug;
    },
    onSuccess: (slug) => {
      queryClient.invalidateQueries({ queryKey: ['system-documentation'] });
      toast.success(isEditing ? 'Documento atualizado' : 'Documento criado');
      navigate(`/docs/${slug}`);
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um documento com este título');
      } else {
        toast.error('Erro ao salvar documento');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }
    if (!content.trim()) {
      toast.error('Conteúdo é obrigatório');
      return;
    }
    saveMutation.mutate();
  };

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas Admin e Coordenadores podem editar a documentação.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isEditing && isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <Link to="/docs">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Documentação
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Editar Documento' : 'Novo Documento'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Rotas Preventivas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Resumo</Label>
              <Input
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Breve descrição do documento (opcional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Use markdown: # Título, ## Subtítulo, - lista, **negrito**
              </p>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Título do Documento&#10;&#10;## Descrição&#10;Descreva o módulo ou regra...&#10;&#10;## Regras de Negócio&#10;- Regra 1&#10;- Regra 2"
                className="min-h-[400px] font-mono text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Link to="/docs">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isEditing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
