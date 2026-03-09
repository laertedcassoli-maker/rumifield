import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Pencil, RefreshCw, CheckCircle2, XCircle, Eye, EyeOff, Settings, ImageIcon, Package, Activity, ChevronDown, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

type ProdutoSortField = 'nome' | 'unidade' | 'descricao';
type PecaSortField = 'codigo' | 'nome' | 'familia' | 'omie_codigo' | 'descricao' | 'quantidade_estoque';
type ProdutoComercialSortField = 'nome' | 'descricao';
type IndicadorSortField = 'nome' | 'unidade';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

interface ProdutoFormData {
  id?: string;
  nome: string;
  unidade: string;
  descricao: string;
  litros_por_vaca_2x: number;
  litros_por_vaca_3x: number;
}

interface PecaFormData {
  id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  omie_codigo: string;
  is_asset: boolean;
  familia: string;
}

interface ProdutoComercialFormData {
  id?: string;
  nome: string;
  descricao: string;
}

interface IndicadorFormData {
  id?: string;
  produto_id: string;
  nome: string;
  descricao: string;
  unidade: string;
}

export default function AdminConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [produtoOpen, setProdutoOpen] = useState(false);
  const [pecaOpen, setPecaOpen] = useState(false);
  const [produtoComercialOpen, setProdutoComercialOpen] = useState(false);
  const [indicadorOpen, setIndicadorOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; nome: string } | null>(null);
  const [produtoForm, setProdutoForm] = useState<ProdutoFormData>({ nome: '', unidade: 'litros', descricao: '', litros_por_vaca_2x: 0, litros_por_vaca_3x: 0 });
  const [pecaForm, setPecaForm] = useState<PecaFormData>({ codigo: '', nome: '', descricao: '', omie_codigo: '', is_asset: false, familia: 'RumiFlow' });
  const [customFamilia, setCustomFamilia] = useState(false);
  const [produtoComercialForm, setProdutoComercialForm] = useState<ProdutoComercialFormData>({ nome: '', descricao: '' });
  const [indicadorForm, setIndicadorForm] = useState<IndicadorFormData>({ produto_id: '', nome: '', descricao: '', unidade: '' });
  const [isEditingProduto, setIsEditingProduto] = useState(false);
  const [isEditingPeca, setIsEditingPeca] = useState(false);
  const [isEditingProdutoComercial, setIsEditingProdutoComercial] = useState(false);
  const [isEditingIndicador, setIsEditingIndicador] = useState(false);
  const [expandedProdutos, setExpandedProdutos] = useState<Set<string>>(new Set());
  const [isSyncingOmie, setIsSyncingOmie] = useState(false);

  // Omie integration states
  const [omieAppKey, setOmieAppKey] = useState('');
  const [omieAppSecret, setOmieAppSecret] = useState('');
  const [showAppKey, setShowAppKey] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isSavingOmieConfig, setIsSavingOmieConfig] = useState(false);

  // iMilk integration states
  const [isTestingImilk, setIsTestingImilk] = useState(false);
  const [imilkStatus, setImilkStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [imilkMessage, setImilkMessage] = useState('');

  // Load all configs from database
  const { data: allConfigs } = useQuery({
    queryKey: ['app-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor');
      if (error) throw error;
      return data;
    },
  });

  // Menu visibility states
  const [estoqueMenuEnabled, setEstoqueMenuEnabled] = useState(true);
  const [inicioMenuEnabled, setInicioMenuEnabled] = useState(true);
  const [visitasMenuEnabled, setVisitasMenuEnabled] = useState(false);
  const [nfcMenuEnabled, setNfcMenuEnabled] = useState(true);
  
  // Workshop config states
  const [garantiaMotorHoras, setGarantiaMotorHoras] = useState('400');
  const [isSavingGarantia, setIsSavingGarantia] = useState(false);

  // Set form values when config loads
  useEffect(() => {
    if (allConfigs) {
      const appKey = allConfigs.find(c => c.chave === 'omie_app_key')?.valor || '';
      const appSecret = allConfigs.find(c => c.chave === 'omie_app_secret')?.valor || '';
      const estoqueEnabled = allConfigs.find(c => c.chave === 'estoque_menu_enabled')?.valor !== 'false';
      const inicioEnabled = allConfigs.find(c => c.chave === 'inicio_menu_enabled')?.valor !== 'false';
      const visitasEnabled = allConfigs.find(c => c.chave === 'visitas_menu_enabled')?.valor === 'true';
      const nfcEnabled = allConfigs.find(c => c.chave === 'nfc_menu_enabled')?.valor !== 'false';
      const garantiaHoras = allConfigs.find(c => c.chave === 'garantia_motor_horas')?.valor || '400';
      setOmieAppKey(appKey);
      setOmieAppSecret(appSecret);
      setEstoqueMenuEnabled(estoqueEnabled);
      setInicioMenuEnabled(inicioEnabled);
      setVisitasMenuEnabled(visitasEnabled);
      setNfcMenuEnabled(nfcEnabled);
      setGarantiaMotorHoras(garantiaHoras);
    }
  }, [allConfigs]);

  // Search states
  const [produtoSearch, setProdutoSearch] = useState('');
  const [pecaSearch, setPecaSearch] = useState('');
  const [produtoComercialSearch, setProdutoComercialSearch] = useState('');

  // Sort states
  const [produtoSortField, setProdutoSortField] = useState<ProdutoSortField>('nome');
  const [produtoSortDirection, setProdutoSortDirection] = useState<SortDirection>('asc');
  const [pecaSortField, setPecaSortField] = useState<PecaSortField>('codigo');
  const [pecaSortDirection, setPecaSortDirection] = useState<SortDirection>('asc');
  const [produtoComercialSortField, setProdutoComercialSortField] = useState<ProdutoComercialSortField>('nome');
  const [produtoComercialSortDirection, setProdutoComercialSortDirection] = useState<SortDirection>('asc');

  // Pagination states
  const [produtoPage, setProdutoPage] = useState(1);
  const [pecaPage, setPecaPage] = useState(1);
  const [produtoComercialPage, setProdutoComercialPage] = useState(1);

  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos_quimicos').select('*').order('nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: pecas, isLoading: loadingPecas } = useQuery({
    queryKey: ['pecas-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pecas').select('*').order('codigo');
      if (error) throw error;
      return data;
    },
  });

  const { data: produtosComerciais, isLoading: loadingProdutosComerciais } = useQuery({
    queryKey: ['produtos-comerciais-config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('produtos').select('*').order('nome');
      if (error) throw error;
      return data as { id: string; nome: string; descricao: string | null; ativo: boolean; cod_imilk: string | null; created_at: string; updated_at: string }[];
    },
  });

  const { data: healthIndicators, isLoading: loadingIndicadores } = useQuery({
    queryKey: ['health-indicators-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_health_indicators')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  // Filtered and sorted produtos
  const filteredProdutos = useMemo(() => {
    if (!produtos) return [];
    let filtered = produtos.filter(p =>
      p.nome.toLowerCase().includes(produtoSearch.toLowerCase()) ||
      (p.descricao?.toLowerCase().includes(produtoSearch.toLowerCase()))
    );
    filtered.sort((a, b) => {
      const aVal = (a[produtoSortField] || '').toString().toLowerCase();
      const bVal = (b[produtoSortField] || '').toString().toLowerCase();
      return produtoSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return filtered;
  }, [produtos, produtoSearch, produtoSortField, produtoSortDirection]);

  const paginatedProdutos = useMemo(() => {
    const start = (produtoPage - 1) * ITEMS_PER_PAGE;
    return filteredProdutos.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProdutos, produtoPage]);

  const totalProdutoPages = Math.ceil(filteredProdutos.length / ITEMS_PER_PAGE);

  // Filtered and sorted pecas
  const filteredPecas = useMemo(() => {
    if (!pecas) return [];
    let filtered = pecas.filter(p =>
      p.codigo.toLowerCase().includes(pecaSearch.toLowerCase()) ||
      p.nome.toLowerCase().includes(pecaSearch.toLowerCase()) ||
      (p.descricao?.toLowerCase().includes(pecaSearch.toLowerCase()))
    );
    filtered.sort((a, b) => {
      const aVal = (a[pecaSortField] || '').toString().toLowerCase();
      const bVal = (b[pecaSortField] || '').toString().toLowerCase();
      return pecaSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return filtered;
  }, [pecas, pecaSearch, pecaSortField, pecaSortDirection]);

  const paginatedPecas = useMemo(() => {
    const start = (pecaPage - 1) * ITEMS_PER_PAGE;
    return filteredPecas.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPecas, pecaPage]);

  const totalPecaPages = Math.ceil(filteredPecas.length / ITEMS_PER_PAGE);

  // Filtered and sorted produtos comerciais
  const filteredProdutosComerciais = useMemo(() => {
    if (!produtosComerciais) return [];
    let filtered = produtosComerciais.filter(p =>
      p.nome.toLowerCase().includes(produtoComercialSearch.toLowerCase()) ||
      (p.descricao?.toLowerCase().includes(produtoComercialSearch.toLowerCase()))
    );
    filtered.sort((a, b) => {
      const aVal = (a[produtoComercialSortField] || '').toString().toLowerCase();
      const bVal = (b[produtoComercialSortField] || '').toString().toLowerCase();
      return produtoComercialSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return filtered;
  }, [produtosComerciais, produtoComercialSearch, produtoComercialSortField, produtoComercialSortDirection]);

  const paginatedProdutosComerciais = useMemo(() => {
    const start = (produtoComercialPage - 1) * ITEMS_PER_PAGE;
    return filteredProdutosComerciais.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProdutosComerciais, produtoComercialPage]);

  const totalProdutoComercialPages = Math.ceil(filteredProdutosComerciais.length / ITEMS_PER_PAGE);

  const handleProdutoSort = (field: ProdutoSortField) => {
    if (produtoSortField === field) {
      setProdutoSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setProdutoSortField(field);
      setProdutoSortDirection('asc');
    }
    setProdutoPage(1);
  };

  const handlePecaSort = (field: PecaSortField) => {
    if (pecaSortField === field) {
      setPecaSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPecaSortField(field);
      setPecaSortDirection('asc');
    }
    setPecaPage(1);
  };

  const getSortIcon = (field: string, currentField: string, direction: SortDirection) => {
    if (field !== currentField) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const createProduto = useMutation({
    mutationFn: async (data: ProdutoFormData) => {
      const { error } = await supabase.from('produtos_quimicos').insert({
        nome: data.nome,
        unidade: data.unidade,
        descricao: data.descricao,
        litros_por_vaca_2x: data.litros_por_vaca_2x,
        litros_por_vaca_3x: data.litros_por_vaca_3x,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-config'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-quimicos'] });
      closeProdutoDialog();
      toast({ title: 'Produto cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const updateProduto = useMutation({
    mutationFn: async (data: ProdutoFormData) => {
      if (!data.id) throw new Error('ID do produto não informado');
      const { error } = await supabase.from('produtos_quimicos').update({
        nome: data.nome,
        unidade: data.unidade,
        descricao: data.descricao,
        litros_por_vaca_2x: data.litros_por_vaca_2x,
        litros_por_vaca_3x: data.litros_por_vaca_3x,
      }).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-config'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-quimicos'] });
      closeProdutoDialog();
      toast({ title: 'Produto atualizado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const createPeca = useMutation({
    mutationFn: async (data: PecaFormData) => {
      const { error } = await supabase.from('pecas').insert({
        codigo: data.codigo,
        nome: data.nome,
        descricao: data.descricao,
        omie_codigo: data.omie_codigo,
        is_asset: data.is_asset,
        familia: data.familia || 'RumiFlow',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-config'] });
      queryClient.invalidateQueries({ queryKey: ['pecas'] });
      closePecaDialog();
      toast({ title: 'Peça cadastrada!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const updatePeca = useMutation({
    mutationFn: async (data: PecaFormData) => {
      if (!data.id) throw new Error('ID da peça não informado');
      const { error } = await supabase.from('pecas').update({
        codigo: data.codigo,
        nome: data.nome,
        descricao: data.descricao,
        omie_codigo: data.omie_codigo,
        is_asset: data.is_asset,
        familia: data.familia || 'RumiFlow',
      } as any).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-config'] });
      queryClient.invalidateQueries({ queryKey: ['pecas'] });
      closePecaDialog();
      toast({ title: 'Peça atualizada!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const createProdutoComercial = useMutation({
    mutationFn: async (data: ProdutoComercialFormData) => {
      const { error } = await (supabase as any).from('produtos').insert({
        nome: data.nome,
        descricao: data.descricao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-comerciais-config'] });
      closeProdutoComercialDialog();
      toast({ title: 'Produto cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const updateProdutoComercial = useMutation({
    mutationFn: async (data: ProdutoComercialFormData) => {
      if (!data.id) throw new Error('ID do produto não informado');
      const { error } = await (supabase as any).from('produtos').update({
        nome: data.nome,
        descricao: data.descricao || null,
      }).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-comerciais-config'] });
      closeProdutoComercialDialog();
      toast({ title: 'Produto atualizado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const createIndicador = useMutation({
    mutationFn: async (data: IndicadorFormData) => {
      const { error } = await supabase.from('product_health_indicators').insert({
        produto_id: data.produto_id,
        nome: data.nome,
        descricao: data.descricao || null,
        unidade: data.unidade,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-indicators-config'] });
      closeIndicadorDialog();
      toast({ title: 'Indicador cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const updateIndicador = useMutation({
    mutationFn: async (data: IndicadorFormData) => {
      if (!data.id) throw new Error('ID do indicador não informado');
      const { error } = await supabase.from('product_health_indicators').update({
        nome: data.nome,
        descricao: data.descricao || null,
        unidade: data.unidade,
      }).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-indicators-config'] });
      closeIndicadorDialog();
      toast({ title: 'Indicador atualizado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const deleteIndicador = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_health_indicators').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-indicators-config'] });
      toast({ title: 'Indicador removido!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const openNewProduto = () => {
    setProdutoForm({ nome: '', unidade: 'litros', descricao: '', litros_por_vaca_2x: 0, litros_por_vaca_3x: 0 });
    setIsEditingProduto(false);
    setProdutoOpen(true);
  };

  const openEditProduto = (produto: typeof produtos extends (infer T)[] ? T : never) => {
    setProdutoForm({
      id: produto.id,
      nome: produto.nome,
      unidade: produto.unidade,
      descricao: produto.descricao || '',
      litros_por_vaca_2x: produto.litros_por_vaca_2x || 0,
      litros_por_vaca_3x: produto.litros_por_vaca_3x || 0,
    });
    setIsEditingProduto(true);
    setProdutoOpen(true);
  };

  const closeProdutoDialog = () => {
    setProdutoOpen(false);
    setProdutoForm({ nome: '', unidade: 'litros', descricao: '', litros_por_vaca_2x: 0, litros_por_vaca_3x: 0 });
    setIsEditingProduto(false);
  };

  const openNewPeca = () => {
    setPecaForm({ codigo: '', nome: '', descricao: '', omie_codigo: '', is_asset: false, familia: 'RumiFlow' });
    setCustomFamilia(false);
    setIsEditingPeca(false);
    setPecaOpen(true);
  };

  const familias = useMemo(() => {
    if (!pecas) return ['RumiFlow'];
    const set = new Set<string>();
    pecas.forEach(p => { if (p.familia) set.add(p.familia); });
    if (!set.has('RumiFlow')) set.add('RumiFlow');
    return Array.from(set).sort();
  }, [pecas]);

  const openEditPeca = (peca: typeof pecas extends (infer T)[] ? T : never) => {
    const fam = peca.familia || 'RumiFlow';
    const isKnown = familias.includes(fam);
    setPecaForm({
      id: peca.id,
      codigo: peca.codigo,
      nome: peca.nome,
      descricao: peca.descricao || '',
      omie_codigo: peca.omie_codigo || '',
      is_asset: (peca as any).is_asset ?? false,
      familia: fam,
    });
    setCustomFamilia(!isKnown);
    setIsEditingPeca(true);
    setPecaOpen(true);
  };

  const closePecaDialog = () => {
    setPecaOpen(false);
    setPecaForm({ codigo: '', nome: '', descricao: '', omie_codigo: '', is_asset: false });
    setIsEditingPeca(false);
  };

  const openNewProdutoComercial = () => {
    setProdutoComercialForm({ nome: '', descricao: '' });
    setIsEditingProdutoComercial(false);
    setProdutoComercialOpen(true);
  };

  const openEditProdutoComercial = (produto: typeof produtosComerciais extends (infer T)[] ? T : never) => {
    setProdutoComercialForm({
      id: produto.id,
      nome: produto.nome,
      descricao: produto.descricao || '',
    });
    setIsEditingProdutoComercial(true);
    setProdutoComercialOpen(true);
  };

  const closeProdutoComercialDialog = () => {
    setProdutoComercialOpen(false);
    setProdutoComercialForm({ nome: '', descricao: '' });
    setIsEditingProdutoComercial(false);
  };

  const openNewIndicador = (produtoId: string) => {
    setIndicadorForm({ produto_id: produtoId, nome: '', descricao: '', unidade: '' });
    setIsEditingIndicador(false);
    setIndicadorOpen(true);
  };

  const openEditIndicador = (indicador: { id: string; produto_id: string; nome: string; descricao: string | null; unidade: string }) => {
    setIndicadorForm({
      id: indicador.id,
      produto_id: indicador.produto_id,
      nome: indicador.nome,
      descricao: indicador.descricao || '',
      unidade: indicador.unidade,
    });
    setIsEditingIndicador(true);
    setIndicadorOpen(true);
  };

  const closeIndicadorDialog = () => {
    setIndicadorOpen(false);
    setIndicadorForm({ produto_id: '', nome: '', descricao: '', unidade: '' });
    setIsEditingIndicador(false);
  };

  const toggleProdutoExpanded = (produtoId: string) => {
    setExpandedProdutos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(produtoId)) {
        newSet.delete(produtoId);
      } else {
        newSet.add(produtoId);
      }
      return newSet;
    });
  };

  const getIndicadoresForProduto = (produtoId: string) => {
    return healthIndicators?.filter(i => i.produto_id === produtoId) || [];
  };

  const handleIndicadorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!indicadorForm.nome.trim() || !indicadorForm.unidade.trim()) return;
    if (isEditingIndicador) {
      updateIndicador.mutate(indicadorForm);
    } else {
      createIndicador.mutate(indicadorForm);
    }
  };

  const isIndicadorSaving = createIndicador.isPending || updateIndicador.isPending;

  const handleProdutoComercialSort = (field: ProdutoComercialSortField) => {
    if (produtoComercialSortField === field) {
      setProdutoComercialSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setProdutoComercialSortField(field);
      setProdutoComercialSortDirection('asc');
    }
    setProdutoComercialPage(1);
  };

  const handleProdutoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!produtoForm.nome.trim()) return;
    if (isEditingProduto) {
      updateProduto.mutate(produtoForm);
    } else {
      createProduto.mutate(produtoForm);
    }
  };

  const handlePecaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pecaForm.codigo.trim() || !pecaForm.nome.trim()) return;
    if (isEditingPeca) {
      updatePeca.mutate(pecaForm);
    } else {
      createPeca.mutate(pecaForm);
    }
  };

  const handleProdutoComercialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!produtoComercialForm.nome.trim()) return;
    if (isEditingProdutoComercial) {
      updateProdutoComercial.mutate(produtoComercialForm);
    } else {
      createProdutoComercial.mutate(produtoComercialForm);
    }
  };

  const isProdutoComercialSaving = createProdutoComercial.isPending || updateProdutoComercial.isPending;

  const isProdutoSaving = createProduto.isPending || updateProduto.isPending;
  const isPecaSaving = createPeca.isPending || updatePeca.isPending;

  const handleSyncOmiePecas = async () => {
    setIsSyncingOmie(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-omie-pecas');
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: 'Sincronização concluída!',
          description: `${data.created} criadas, ${data.updated} atualizadas de ${data.total} peças`,
        });
        queryClient.invalidateQueries({ queryKey: ['pecas-config'] });
        queryClient.invalidateQueries({ queryKey: ['pecas'] });
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: error.message || 'Não foi possível sincronizar com Omie',
      });
    } finally {
      setIsSyncingOmie(false);
    }
  };

  const handleTestOmieConnection = async () => {
    if (!omieAppKey.trim() || !omieAppSecret.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha APP KEY e APP SECRET' });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('idle');
    setConnectionMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('test-omie-connection', {
        body: { app_key: omieAppKey, app_secret: omieAppSecret },
      });

      if (error) throw error;

      if (data.success) {
        setConnectionStatus('success');
        let message = data.message;
        if (data.empresa?.razao_social) {
          message += `\n\nEmpresa: ${data.empresa.razao_social}`;
        }
        if (data.empresa?.cnpj) {
          message += `\nCNPJ: ${data.empresa.cnpj}`;
        }
        if (data.total_produtos) {
          message += `\n${data.total_produtos} produtos cadastrados`;
        }
        setConnectionMessage(message);
        toast({ title: 'Conexão OK!', description: data.empresa?.razao_social || data.message });
      } else {
        setConnectionStatus('error');
        setConnectionMessage(data.error || 'Falha na conexão');
        toast({ variant: 'destructive', title: 'Falha na conexão', description: data.error });
      }
    } catch (error: any) {
      setConnectionStatus('error');
      setConnectionMessage(error.message || 'Erro ao testar conexão');
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveOmieConfig = async () => {
    setIsSavingOmieConfig(true);
    try {
      // Update both keys
      const { error: error1 } = await supabase
        .from('configuracoes')
        .update({ valor: omieAppKey })
        .eq('chave', 'omie_app_key');
      
      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from('configuracoes')
        .update({ valor: omieAppSecret })
        .eq('chave', 'omie_app_secret');
      
      if (error2) throw error2;

      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      toast({ title: 'Credenciais salvas!', description: 'As credenciais do Omie foram salvas com sucesso.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } finally {
      setIsSavingOmieConfig(false);
    }
  };

  const handleToggleEstoqueMenu = async (enabled: boolean) => {
    setEstoqueMenuEnabled(enabled);
    try {
      // Check if config exists
      const { data: existing } = await supabase
        .from('configuracoes')
        .select('id')
        .eq('chave', 'estoque_menu_enabled')
        .single();

      if (existing) {
        await supabase
          .from('configuracoes')
          .update({ valor: enabled ? 'true' : 'false' })
          .eq('chave', 'estoque_menu_enabled');
      } else {
        await supabase
          .from('configuracoes')
          .insert({ chave: 'estoque_menu_enabled', valor: enabled ? 'true' : 'false', descricao: 'Exibir menu Estoque Químicos' });
      }

      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      queryClient.invalidateQueries({ queryKey: ['menu-config'] });
      toast({ title: enabled ? 'Menu Estoque ativado' : 'Menu Estoque desativado' });
    } catch (error: any) {
      setEstoqueMenuEnabled(!enabled); // Revert on error
      toast({ variant: 'destructive', title: 'Erro ao salvar configuração', description: error.message });
    }
  };

  const handleToggleInicioMenu = async (enabled: boolean) => {
    setInicioMenuEnabled(enabled);
    try {
      const { data: existing } = await supabase
        .from('configuracoes')
        .select('id')
        .eq('chave', 'inicio_menu_enabled')
        .single();

      if (existing) {
        await supabase
          .from('configuracoes')
          .update({ valor: enabled ? 'true' : 'false' })
          .eq('chave', 'inicio_menu_enabled');
      } else {
        await supabase
          .from('configuracoes')
          .insert({ chave: 'inicio_menu_enabled', valor: enabled ? 'true' : 'false', descricao: 'Exibir menu Início' });
      }

      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      queryClient.invalidateQueries({ queryKey: ['menu-config'] });
      toast({ title: enabled ? 'Menu Início ativado' : 'Menu Início desativado' });
    } catch (error: any) {
      setInicioMenuEnabled(!enabled);
      toast({ variant: 'destructive', title: 'Erro ao salvar configuração', description: error.message });
    }
  };

  const handleToggleVisitasMenu = async (enabled: boolean) => {
    setVisitasMenuEnabled(enabled);
    try {
      const { data: existing } = await supabase
        .from('configuracoes')
        .select('id')
        .eq('chave', 'visitas_menu_enabled')
        .single();

      if (existing) {
        await supabase
          .from('configuracoes')
          .update({ valor: enabled ? 'true' : 'false' })
          .eq('chave', 'visitas_menu_enabled');
      } else {
        await supabase
          .from('configuracoes')
          .insert({ chave: 'visitas_menu_enabled', valor: enabled ? 'true' : 'false', descricao: 'Exibir menu Visitas' });
      }

      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      queryClient.invalidateQueries({ queryKey: ['menu-config'] });
      toast({ title: enabled ? 'Menu Visitas ativado' : 'Menu Visitas desativado' });
    } catch (error: any) {
      setVisitasMenuEnabled(!enabled);
      toast({ variant: 'destructive', title: 'Erro ao salvar configuração', description: error.message });
    }
  };

  const handleToggleNfcMenu = async (enabled: boolean) => {
    setNfcMenuEnabled(enabled);
    try {
      const { data: existing } = await supabase
        .from('configuracoes')
        .select('id')
        .eq('chave', 'nfc_menu_enabled')
        .single();

      if (existing) {
        await supabase
          .from('configuracoes')
          .update({ valor: enabled ? 'true' : 'false' })
          .eq('chave', 'nfc_menu_enabled');
      } else {
        await supabase
          .from('configuracoes')
          .insert({ chave: 'nfc_menu_enabled', valor: enabled ? 'true' : 'false', descricao: 'Exibir menu Leitura NFC' });
      }

      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      queryClient.invalidateQueries({ queryKey: ['menu-config'] });
      toast({ title: enabled ? 'Menu Leitura NFC ativado' : 'Menu Leitura NFC desativado' });
    } catch (error: any) {
      setNfcMenuEnabled(!enabled);
      toast({ variant: 'destructive', title: 'Erro ao salvar configuração', description: error.message });
    }
  };

  const handleSaveGarantiaMotorHoras = async () => {
    setIsSavingGarantia(true);
    try {
      const { data: existing } = await supabase
        .from('configuracoes')
        .select('id')
        .eq('chave', 'garantia_motor_horas')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('configuracoes')
          .update({ valor: garantiaMotorHoras })
          .eq('chave', 'garantia_motor_horas');
      } else {
        await supabase
          .from('configuracoes')
          .insert({ chave: 'garantia_motor_horas', valor: garantiaMotorHoras, descricao: 'Horas de garantia do motor para criação automática de SG' });
      }

      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      queryClient.invalidateQueries({ queryKey: ['warranty-hours-config'] });
      toast({ title: 'Configuração salva!', description: `Garantia de motor definida para ${garantiaMotorHoras}h` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } finally {
      setIsSavingGarantia(false);
    }
  };

  const handleTestImilkConnection = async () => {
    setIsTestingImilk(true);
    setImilkStatus('idle');
    setImilkMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('test-imilk-connection');

      if (error) throw error;

      if (data.success) {
        setImilkStatus('success');
        setImilkMessage(data.message + (data.total_clientes ? ` (${data.total_clientes} clientes encontrados)` : ''));
        toast({ title: 'Conexão OK!', description: data.message });
      } else {
        setImilkStatus('error');
        setImilkMessage(data.error || 'Falha na conexão');
        toast({ variant: 'destructive', title: 'Falha na conexão', description: data.error });
      }
    } catch (error: any) {
      setImilkStatus('error');
      setImilkMessage(error.message || 'Erro ao testar conexão');
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsTestingImilk(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie cadastros e configurações do sistema</p>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="produtos">Produtos Químicos</TabsTrigger>
          <TabsTrigger value="pecas">Catálogo de Peças</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Visibilidade de Menus
              </CardTitle>
              <CardDescription>
                Ative ou desative menus do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">Menu Início</p>
                  <p className="text-sm text-muted-foreground">
                    Página inicial do sistema (Dashboard)
                  </p>
                </div>
                <Switch
                  checked={inicioMenuEnabled}
                  onCheckedChange={handleToggleInicioMenu}
                />
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">Menu Estoque Químicos</p>
                  <p className="text-sm text-muted-foreground">
                    Controle de estoque, aferição, consumo e previsão de envios
                  </p>
                </div>
                <Switch
                  checked={estoqueMenuEnabled}
                  onCheckedChange={handleToggleEstoqueMenu}
                />
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">Menu Visitas</p>
                  <p className="text-sm text-muted-foreground">
                    Registro de visitas técnicas aos clientes
                  </p>
                </div>
                <Switch
                  checked={visitasMenuEnabled}
                  onCheckedChange={handleToggleVisitasMenu}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Menu Leitura NFC</p>
                  <p className="text-sm text-muted-foreground">
                    Leitura de tags e dispositivos NFC
                  </p>
                </div>
                <Switch
                  checked={nfcMenuEnabled}
                  onCheckedChange={handleToggleNfcMenu}
                />
              </div>
            </CardContent>
          </Card>

          {/* Oficina Config Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações Oficina
              </CardTitle>
              <CardDescription>
                Parâmetros de garantia e manutenção
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>Horas de Garantia Motor</Label>
                  <p className="text-xs text-muted-foreground">
                    Motores com menos horas criam SG automaticamente
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={garantiaMotorHoras}
                    onChange={(e) => setGarantiaMotorHoras(e.target.value)}
                    className="w-24"
                    min="0"
                  />
                  <span className="text-sm text-muted-foreground">h</span>
                  <Button 
                    size="sm" 
                    onClick={handleSaveGarantiaMotorHoras}
                    disabled={isSavingGarantia}
                  >
                    {isSavingGarantia ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Produtos Comerciais tab removed - managed in CRM Config */}

        <TabsContent value="produtos" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou descrição..."
                value={produtoSearch}
                onChange={(e) => { setProdutoSearch(e.target.value); setProdutoPage(1); }}
                className="pl-10"
              />
            </div>
            <Button onClick={openNewProduto}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </div>

          {/* Produto Dialog */}
          <Dialog open={produtoOpen} onOpenChange={(open) => !open && closeProdutoDialog()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditingProduto ? 'Editar Produto Químico' : 'Cadastrar Produto Químico'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleProdutoSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={produtoForm.nome}
                    onChange={(e) => setProdutoForm({ ...produtoForm, nome: e.target.value })}
                    placeholder="Nome do produto"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Input
                    value={produtoForm.unidade}
                    onChange={(e) => setProdutoForm({ ...produtoForm, unidade: e.target.value })}
                    placeholder="litros, kg, unidade..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={produtoForm.descricao}
                    onChange={(e) => setProdutoForm({ ...produtoForm, descricao: e.target.value })}
                    placeholder="Descrição do produto"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Consumo 2 Ordenhas (L/vaca.mês)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={produtoForm.litros_por_vaca_2x}
                      onChange={(e) => setProdutoForm({ ...produtoForm, litros_por_vaca_2x: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Consumo 3 Ordenhas (L/vaca.mês)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={produtoForm.litros_por_vaca_3x}
                      onChange={(e) => setProdutoForm({ ...produtoForm, litros_por_vaca_3x: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isProdutoSaving}>
                  {isProdutoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditingProduto ? 'Salvar Alterações' : 'Cadastrar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {loadingProdutos ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleProdutoSort('nome')} className="hover:bg-transparent p-0">
                          Nome {getSortIcon('nome', produtoSortField, produtoSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleProdutoSort('unidade')} className="hover:bg-transparent p-0">
                          Unidade {getSortIcon('unidade', produtoSortField, produtoSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleProdutoSort('descricao')} className="hover:bg-transparent p-0">
                          Descrição {getSortIcon('descricao', produtoSortField, produtoSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProdutos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhum produto encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedProdutos.map((produto) => (
                        <TableRow key={produto.id}>
                          <TableCell className="font-medium">{produto.nome}</TableCell>
                          <TableCell>{produto.unidade}</TableCell>
                          <TableCell className="text-muted-foreground">{produto.descricao || '-'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEditProduto(produto)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalProdutoPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((produtoPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(produtoPage * ITEMS_PER_PAGE, filteredProdutos.length)} de {filteredProdutos.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setProdutoPage(p => p - 1)} disabled={produtoPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Página {produtoPage} de {totalProdutoPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setProdutoPage(p => p + 1)} disabled={produtoPage === totalProdutoPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="pecas" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, nome ou descrição..."
                value={pecaSearch}
                onChange={(e) => { setPecaSearch(e.target.value); setPecaPage(1); }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSyncOmiePecas} disabled={isSyncingOmie}>
                {isSyncingOmie ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sincronizar Omie
              </Button>
              <Button onClick={openNewPeca}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Peça
              </Button>
            </div>
          </div>

          {/* Peça Dialog */}
          <Dialog open={pecaOpen} onOpenChange={(open) => !open && closePecaDialog()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditingPeca ? 'Editar Peça' : 'Cadastrar Peça'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handlePecaSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input
                      value={pecaForm.codigo}
                      onChange={(e) => setPecaForm({ ...pecaForm, codigo: e.target.value })}
                      placeholder="PC-001"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Código Omie</Label>
                    <Input
                      value={pecaForm.omie_codigo}
                      onChange={(e) => setPecaForm({ ...pecaForm, omie_codigo: e.target.value })}
                      placeholder="Código no Omie"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={pecaForm.nome}
                    onChange={(e) => setPecaForm({ ...pecaForm, nome: e.target.value })}
                    placeholder="Nome da peça"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={pecaForm.descricao}
                    onChange={(e) => setPecaForm({ ...pecaForm, descricao: e.target.value })}
                    placeholder="Descrição da peça"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label>Controle de ativo</Label>
                    <p className="text-xs text-muted-foreground">
                      Exige código unívoco ao registrar troca com estoque do técnico
                    </p>
                  </div>
                  <Switch
                    checked={pecaForm.is_asset}
                    onCheckedChange={(checked) => setPecaForm({ ...pecaForm, is_asset: checked })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isPecaSaving}>
                  {isPecaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditingPeca ? 'Salvar Alterações' : 'Cadastrar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {loadingPecas ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Foto</TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handlePecaSort('codigo')} className="hover:bg-transparent p-0">
                          Código {getSortIcon('codigo', pecaSortField, pecaSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handlePecaSort('nome')} className="hover:bg-transparent p-0">
                          Nome {getSortIcon('nome', pecaSortField, pecaSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handlePecaSort('familia')} className="hover:bg-transparent p-0">
                          Família {getSortIcon('familia', pecaSortField, pecaSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handlePecaSort('omie_codigo')} className="hover:bg-transparent p-0">
                          Cód. Omie {getSortIcon('omie_codigo', pecaSortField, pecaSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handlePecaSort('descricao')} className="hover:bg-transparent p-0">
                          Descrição {getSortIcon('descricao', pecaSortField, pecaSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead className="text-center">Controlado</TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" onClick={() => handlePecaSort('quantidade_estoque')} className="hover:bg-transparent p-0">
                          Estoque {getSortIcon('quantidade_estoque', pecaSortField, pecaSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPecas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Nenhuma peça encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPecas.map((peca) => (
                        <TableRow key={peca.id}>
                          <TableCell>
                            {peca.imagem_url ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setPreviewImage({ url: peca.imagem_url!, nome: peca.nome });
                                  setImagePreviewOpen(true);
                                }}
                              >
                                <img
                                  src={peca.imagem_url}
                                  alt={peca.nome}
                                  className="h-8 w-8 object-cover rounded"
                                />
                              </Button>
                            ) : (
                              <div className="h-8 w-8 flex items-center justify-center text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{peca.codigo}</TableCell>
                          <TableCell>
                            {peca.nome}
                          </TableCell>
                          <TableCell>
                            {peca.familia ? (
                              <Badge variant="secondary">{peca.familia}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{peca.omie_codigo || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{peca.descricao || '-'}</TableCell>
                          <TableCell className="text-center">
                            {(peca as any).is_asset ? (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                                Sim
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={peca.quantidade_estoque && peca.quantidade_estoque > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                              {peca.quantidade_estoque ?? 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEditPeca(peca)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPecaPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((pecaPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(pecaPage * ITEMS_PER_PAGE, filteredPecas.length)} de {filteredPecas.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPecaPage(p => p - 1)} disabled={pecaPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Página {pecaPage} de {totalPecaPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPecaPage(p => p + 1)} disabled={pecaPage === totalPecaPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="integracoes" className="space-y-6">
          {/* iMilk Integration */}
          <Card>
            <CardHeader>
              <CardTitle>Conexão iMilk</CardTitle>
              <CardDescription>Integração para sincronização de clientes do iMilk</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Endpoint</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">http://n8n.rumina.com.br/webhook/imilk/rumiflow/clientes</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Autenticação</span>
                  <span className="text-sm text-muted-foreground">API Key (Header Authorization)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Secret configurado</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    IMILK_API_KEY
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button onClick={handleTestImilkConnection} disabled={isTestingImilk}>
                  {isTestingImilk ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    'Testar Conexão'
                  )}
                </Button>

                {imilkStatus === 'success' && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm">{imilkMessage}</span>
                  </div>
                )}
                {imilkStatus === 'error' && (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm">{imilkMessage}</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                A sincronização de clientes do iMilk está disponível na tela de Clientes. O secret IMILK_API_KEY está configurado no backend.
              </p>
            </CardContent>
          </Card>

          {/* Omie Integration */}
          <Card>
            <CardHeader>
              <CardTitle>Conexão Omie</CardTitle>
              <CardDescription>Configure as credenciais de API para integração com o Omie ERP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="omie-app-key">APP KEY</Label>
                  <div className="relative">
                    <Input
                      id="omie-app-key"
                      type={showAppKey ? 'text' : 'password'}
                      value={omieAppKey}
                      onChange={(e) => { setOmieAppKey(e.target.value); setConnectionStatus('idle'); }}
                      placeholder="Digite o APP KEY"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowAppKey(!showAppKey)}
                    >
                      {showAppKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="omie-app-secret">APP SECRET</Label>
                  <div className="relative">
                    <Input
                      id="omie-app-secret"
                      type={showAppSecret ? 'text' : 'password'}
                      value={omieAppSecret}
                      onChange={(e) => { setOmieAppSecret(e.target.value); setConnectionStatus('idle'); }}
                      placeholder="Digite o APP SECRET"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowAppSecret(!showAppSecret)}
                    >
                      {showAppSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button onClick={handleTestOmieConnection} disabled={isTestingConnection || !omieAppKey.trim() || !omieAppSecret.trim()}>
                  {isTestingConnection ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    'Testar Conexão'
                  )}
                </Button>

                {connectionStatus === 'success' && (
                  <div className="flex items-start gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm whitespace-pre-line">{connectionMessage}</span>
                  </div>
                )}
                {connectionStatus === 'error' && (
                  <div className="flex items-start gap-2 text-destructive">
                    <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm whitespace-pre-line">{connectionMessage}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 pt-2 border-t">
                <Button 
                  onClick={handleSaveOmieConfig} 
                  disabled={isSavingOmieConfig || !omieAppKey.trim() || !omieAppSecret.trim()}
                  variant="default"
                >
                  {isSavingOmieConfig ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Credenciais'
                  )}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                As credenciais são usadas para sincronizar peças e clientes do Omie. Obtenha as credenciais no painel da API do Omie.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Image Preview Dialog */}
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewImage?.nome || 'Imagem da Peça'}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            {previewImage?.url && (
              <img
                src={previewImage.url}
                alt={previewImage.nome}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
