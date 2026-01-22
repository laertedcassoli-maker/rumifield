import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Building2, Loader2, Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Calendar, RefreshCw, MapPin, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Cliente {
  id: string;
  nome: string;
  fazenda: string | null;
  cod_imilk: string | null;
  cidade: string | null;
  estado: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  status: string;
  data_ativacao_rumiflow: string | null;
  ordenhas_dia: number | null;
  tipo_painel: string | null;
  tipo_pistola_id: string | null;
  quantidade_pistolas: number | null;
  latitude: number | null;
  longitude: number | null;
  link_maps: string | null;
  consultor_rplus_id: string | null;
  preventive_frequency_days: number | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  nome: string;
}

interface Peca {
  id: string;
  codigo: string;
  nome: string;
}

interface ClienteForm {
  nome: string;
  fazenda: string;
  cod_imilk: string;
  cidade: string;
  estado: string;
  status: string;
  data_ativacao_rumiflow: Date | undefined;
  ordenhas_dia: number;
  tipo_painel: string;
  tipo_pistola_id: string;
  quantidade_pistolas: number | null;
  latitude: string;
  longitude: string;
  link_maps: string;
  consultor_rplus_id: string;
  preventive_frequency_days: number | null;
}

type SortField = 'nome' | 'fazenda' | 'cod_imilk' | 'status';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

const statusOptions = [
  { value: 'ativo', label: 'Ativo', color: 'bg-success text-success-foreground' },
  { value: 'inativo', label: 'Inativo', color: 'bg-muted text-muted-foreground' },
  { value: 'suspenso', label: 'Suspenso', color: 'bg-warning text-warning-foreground' },
];

export default function AdminClientes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [form, setForm] = useState<ClienteForm>({
    nome: '',
    fazenda: '',
    cod_imilk: '',
    cidade: '',
    estado: '',
    status: 'ativo',
    data_ativacao_rumiflow: undefined,
    ordenhas_dia: 3,
    tipo_painel: '',
    tipo_pistola_id: '',
    quantidade_pistolas: null,
    latitude: '',
    longitude: '',
    link_maps: '',
    consultor_rplus_id: '',
    preventive_frequency_days: null,
  });
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => 
    localStorage.getItem('lastIlmilkSyncTime')
  );
  const [pistolaSearch, setPistolaSearch] = useState('');
  const [isExtractingCoords, setIsExtractingCoords] = useState(false);

  // Function to extract coordinates from Google Maps URL
  const extractCoordsFromMapsUrl = async (url: string) => {
    if (!url || (!url.includes('google.com/maps') && !url.includes('maps.app.goo.gl') && !url.includes('goo.gl/maps'))) {
      return;
    }
    
    setIsExtractingCoords(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-coords-from-maps', {
        body: { url }
      });
      
      if (error) {
        console.error('Error extracting coordinates:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível extrair coordenadas do link',
          variant: 'destructive'
        });
        return;
      }
      
      if (data?.success && data.latitude !== undefined && data.longitude !== undefined) {
        setForm(prev => ({
          ...prev,
          latitude: data.latitude.toString(),
          longitude: data.longitude.toString()
        }));
        toast({
          title: 'Coordenadas extraídas!',
          description: `Lat: ${data.latitude}, Lng: ${data.longitude}`,
        });
      } else {
        toast({
          title: 'Aviso',
          description: data?.error || 'Não foi possível extrair coordenadas deste link',
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('Failed to extract coords:', err);
    } finally {
      setIsExtractingCoords(false);
    }
  };

  // Fetch clientes
  const { data: clientes, isLoading } = useQuery({
    queryKey: ['clientes-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cod_imilk, cidade, estado, endereco, telefone, email, observacoes, status, data_ativacao_rumiflow, ordenhas_dia, tipo_painel, tipo_pistola_id, quantidade_pistolas, latitude, longitude, link_maps, consultor_rplus_id, preventive_frequency_days, created_at, updated_at')
        .order('nome');
      if (error) throw error;
      return data as unknown as Cliente[];
    },
  });

  // Fetch consultores R+ (users with consultor_rplus role)
  const { data: consultores = [] } = useQuery({
    queryKey: ['consultores-rplus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(id, nome)')
        .in('role', ['consultor_rplus', 'coordenador_rplus', 'admin']);
      if (error) throw error;
      return data?.map(ur => ({
        id: (ur.profiles as unknown as Profile).id,
        nome: (ur.profiles as unknown as Profile).nome,
      })) || [];
    },
  });

  // Fetch pistolas (products linked to "Reparo de Pistolas" activity)
  const { data: pistolas = [] } = useQuery({
    queryKey: ['pistolas-options'],
    queryFn: async () => {
      // First get the activity "Reparo de Pistolas"
      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .select('id')
        .ilike('name', '%pistola%')
        .single();
      
      if (activityError || !activity) {
        console.log('Activity "Reparo de Pistolas" not found');
        return [];
      }

      // Get products linked to this activity
      const { data: activityProducts, error: productsError } = await supabase
        .from('activity_products')
        .select('omie_product_id, pecas!inner(id, codigo, nome)')
        .eq('activity_id', activity.id);

      if (productsError) throw productsError;

      return activityProducts?.map(ap => ({
        id: (ap.pecas as unknown as Peca).id,
        codigo: (ap.pecas as unknown as Peca).codigo,
        nome: (ap.pecas as unknown as Peca).nome,
      })) || [];
    },
  });

  // Filter pistolas for search
  const filteredPistolas = useMemo(() => {
    if (!pistolaSearch || pistolaSearch.length < 2) return pistolas;
    const searchLower = pistolaSearch.toLowerCase();
    return pistolas.filter(p => 
      p.nome.toLowerCase().includes(searchLower) || 
      p.codigo.toLowerCase().includes(searchLower)
    );
  }, [pistolas, pistolaSearch]);

  const filteredAndSortedClientes = useMemo(() => {
    if (!clientes) return [];
    
    let result = clientes.filter((cliente) =>
      cliente.nome.toLowerCase().includes(search.toLowerCase()) ||
      cliente.fazenda?.toLowerCase().includes(search.toLowerCase()) ||
      cliente.cod_imilk?.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      const comparison = aValue.localeCompare(bValue, 'pt-BR', { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [clientes, search, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedClientes.length / ITEMS_PER_PAGE);
  const paginatedClientes = filteredAndSortedClientes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  // Generate Google Maps link from lat/long
  const generateMapsLink = (lat: string, lng: string) => {
    if (lat && lng) {
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }
    return '';
  };

  const createCliente = useMutation({
    mutationFn: async (data: ClienteForm) => {
      const mapsLink = data.link_maps || generateMapsLink(data.latitude, data.longitude);
      const { error } = await supabase.from('clientes').insert({
        nome: data.nome,
        fazenda: data.fazenda || null,
        cod_imilk: data.cod_imilk || null,
        cidade: data.cidade || null,
        estado: data.estado || null,
        status: data.status,
        data_ativacao_rumiflow: data.data_ativacao_rumiflow ? format(data.data_ativacao_rumiflow, 'yyyy-MM-dd') : null,
        ordenhas_dia: data.ordenhas_dia,
        tipo_painel: data.tipo_painel || null,
        tipo_pistola_id: data.tipo_pistola_id || null,
        quantidade_pistolas: data.quantidade_pistolas,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        link_maps: mapsLink || null,
        consultor_rplus_id: data.consultor_rplus_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      closeDialog();
      toast({ title: 'Cliente cadastrado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao cadastrar', description: error.message });
    },
  });

  const updateCliente = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClienteForm }) => {
      const mapsLink = data.link_maps || generateMapsLink(data.latitude, data.longitude);
      const { error } = await supabase
        .from('clientes')
        .update({
          nome: data.nome,
          fazenda: data.fazenda || null,
          cod_imilk: data.cod_imilk || null,
          cidade: data.cidade || null,
          estado: data.estado || null,
          status: data.status,
          data_ativacao_rumiflow: data.data_ativacao_rumiflow ? format(data.data_ativacao_rumiflow, 'yyyy-MM-dd') : null,
          ordenhas_dia: data.ordenhas_dia,
          tipo_painel: data.tipo_painel || null,
          tipo_pistola_id: data.tipo_pistola_id || null,
          quantidade_pistolas: data.quantidade_pistolas,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          link_maps: mapsLink || null,
          consultor_rplus_id: data.consultor_rplus_id || null,
          preventive_frequency_days: data.preventive_frequency_days,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      closeDialog();
      toast({ title: 'Cliente atualizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
    },
  });

  const deleteCliente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setDeleteDialogOpen(false);
      setDeletingCliente(null);
      toast({ title: 'Cliente excluído com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    },
  });

  const syncIlmilk = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-imilk-clientes');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clientes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      const now = new Date().toISOString();
      localStorage.setItem('lastIlmilkSyncTime', now);
      setLastSyncTime(now);
      
      const parts = [`${data.created} novos`, `${data.updated} atualizados`];
      if (data.reactivated) parts.push(`${data.reactivated} reativados`);
      if (data.deactivated) parts.push(`${data.deactivated} desativados`);
      
      toast({ 
        title: 'Sincronização concluída!',
        description: `${parts.join(', ')} de ${data.total} clientes`,
      });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro na sincronização', description: error.message });
    },
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingCliente(null);
    setPistolaSearch('');
    setForm({
      nome: '',
      fazenda: '',
      cod_imilk: '',
      cidade: '',
      estado: '',
      status: 'ativo',
      data_ativacao_rumiflow: undefined,
      ordenhas_dia: 3,
      tipo_painel: '',
      tipo_pistola_id: '',
      quantidade_pistolas: null,
      latitude: '',
      longitude: '',
      link_maps: '',
      consultor_rplus_id: '',
      preventive_frequency_days: null,
    });
  };

  const openEditDialog = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setForm({
      nome: cliente.nome,
      fazenda: cliente.fazenda || '',
      cod_imilk: cliente.cod_imilk || '',
      cidade: cliente.cidade || '',
      estado: cliente.estado || '',
      status: cliente.status || 'ativo',
      data_ativacao_rumiflow: cliente.data_ativacao_rumiflow ? new Date(cliente.data_ativacao_rumiflow) : undefined,
      ordenhas_dia: cliente.ordenhas_dia || 3,
      tipo_painel: cliente.tipo_painel || '',
      tipo_pistola_id: cliente.tipo_pistola_id || '',
      quantidade_pistolas: cliente.quantidade_pistolas,
      latitude: cliente.latitude?.toString() || '',
      longitude: cliente.longitude?.toString() || '',
      link_maps: cliente.link_maps || '',
      consultor_rplus_id: cliente.consultor_rplus_id || '',
      preventive_frequency_days: cliente.preventive_frequency_days,
    });
    setOpen(true);
  };

  const openDeleteDialog = (cliente: Cliente) => {
    setDeletingCliente(cliente);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome do produtor é obrigatório' });
      return;
    }

    if (editingCliente) {
      updateCliente.mutate({ id: editingCliente.id, data: form });
    } else {
      createCliente.mutate(form);
    }
  };

  // Get pistola name by ID
  const getPistolaName = (id: string | null) => {
    if (!id) return null;
    const pistola = pistolas.find(p => p.id === id);
    return pistola ? pistola.nome : null;
  };

  // Get consultor name by ID
  const getConsultorName = (id: string | null) => {
    if (!id) return null;
    const consultor = consultores.find(c => c.id === id);
    return consultor ? consultor.nome : null;
  };

  const isPending = createCliente.isPending || updateCliente.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gerencie os produtores e fazendas</p>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-col items-end">
            <Button 
              variant="outline" 
              onClick={() => syncIlmilk.mutate()}
              disabled={syncIlmilk.isPending}
            >
              {syncIlmilk.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sincronizar iMilk
            </Button>
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground mt-1">
                Última sync: {format(new Date(lastSyncTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
          <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) closeDialog();
            else setOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome Produtor *</Label>
                      <Input
                        id="nome"
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                        placeholder="Nome do produtor"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fazenda">Nome da Fazenda</Label>
                      <Input
                        id="fazenda"
                        value={form.fazenda}
                        onChange={(e) => setForm({ ...form, fazenda: e.target.value })}
                        placeholder="Nome da fazenda"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cod_imilk">Cod Imilk</Label>
                      <Input
                        id="cod_imilk"
                        value={form.cod_imilk}
                        onChange={(e) => setForm({ ...form, cod_imilk: e.target.value })}
                        placeholder="Código Imilk"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        value={form.cidade}
                        onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                        placeholder="Cidade"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estado">Estado (UF)</Label>
                      <Input
                        id="estado"
                        value={form.estado}
                        onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase().slice(0, 2) })}
                        placeholder="Ex: SP"
                        maxLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(value) => setForm({ ...form, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data Ativação RumiFlow</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !form.data_ativacao_rumiflow && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {form.data_ativacao_rumiflow ? (
                              format(form.data_ativacao_rumiflow, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              "Selecione"
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={form.data_ativacao_rumiflow}
                            onSelect={(date) => setForm({ ...form, data_ativacao_rumiflow: date })}
                            locale={ptBR}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Consultor R+</Label>
                      <Select
                        value={form.consultor_rplus_id || '_none'}
                        onValueChange={(value) => setForm({ ...form, consultor_rplus_id: value === '_none' ? '' : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Nenhum</SelectItem>
                          {consultores.map((consultor) => (
                            <SelectItem key={consultor.id} value={consultor.id}>
                              {consultor.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Equipment Info */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-3">Equipamentos</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo Painel</Label>
                        <Select
                          value={form.tipo_painel || '_none'}
                          onValueChange={(value) => setForm({ ...form, tipo_painel: value === '_none' ? '' : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Não definido</SelectItem>
                            <SelectItem value="2x">2x</SelectItem>
                            <SelectItem value="3x">3x</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Ordenhas/Dia</Label>
                        <Select
                          value={form.ordenhas_dia.toString()}
                          onValueChange={(value) => setForm({ ...form, ordenhas_dia: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">2 ordenhas</SelectItem>
                            <SelectItem value="3">3 ordenhas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Qtd Pistolas</Label>
                        <Select
                          value={form.quantidade_pistolas?.toString() || '_none'}
                          onValueChange={(value) => setForm({ ...form, quantidade_pistolas: value === '_none' ? null : parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Não definido</SelectItem>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      <Label>Tipo de Pistola</Label>
                      <div className="space-y-2">
                        <Input
                          placeholder="Buscar pistola por nome ou código..."
                          value={pistolaSearch}
                          onChange={(e) => setPistolaSearch(e.target.value)}
                        />
                        {pistolaSearch.length >= 2 && (
                          <div className="border rounded-md max-h-40 overflow-y-auto">
                            {filteredPistolas.length === 0 ? (
                              <p className="p-2 text-sm text-muted-foreground">Nenhuma pistola encontrada</p>
                            ) : (
                              filteredPistolas.map((pistola) => (
                                <button
                                  key={pistola.id}
                                  type="button"
                                  className={cn(
                                    "w-full text-left px-3 py-2 text-sm hover:bg-muted",
                                    form.tipo_pistola_id === pistola.id && "bg-primary/10"
                                  )}
                                  onClick={() => {
                                    setForm({ ...form, tipo_pistola_id: pistola.id });
                                    setPistolaSearch('');
                                  }}
                                >
                                  <span className="font-mono text-xs text-muted-foreground">{pistola.codigo}</span>
                                  <span className="ml-2">{pistola.nome}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                        {form.tipo_pistola_id && (
                          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <span className="text-sm flex-1">{getPistolaName(form.tipo_pistola_id)}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setForm({ ...form, tipo_pistola_id: '' })}
                            >
                              Remover
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Preventive Maintenance */}
                    <div className="mt-4 space-y-2">
                      <Label>Frequência Preventiva (dias)</Label>
                      <Input
                        type="number"
                        placeholder="Ex: 90, 120, 160..."
                        value={form.preventive_frequency_days?.toString() || ''}
                        onChange={(e) => setForm({ 
                          ...form, 
                          preventive_frequency_days: e.target.value ? parseInt(e.target.value) : null 
                        })}
                        min="1"
                      />
                      <p className="text-xs text-muted-foreground">
                        Intervalo em dias entre manutenções preventivas
                      </p>
                    </div>
                  </div>

                  {/* Location Info */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-3">Localização</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="latitude">Latitude</Label>
                        <Input
                          id="latitude"
                          type="text"
                          value={form.latitude}
                          onChange={(e) => {
                            const newLat = e.target.value;
                            setForm({ 
                              ...form, 
                              latitude: newLat,
                              link_maps: form.link_maps || generateMapsLink(newLat, form.longitude)
                            });
                          }}
                          placeholder="-23.5505"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="longitude">Longitude</Label>
                        <Input
                          id="longitude"
                          type="text"
                          value={form.longitude}
                          onChange={(e) => {
                            const newLng = e.target.value;
                            setForm({ 
                              ...form, 
                              longitude: newLng,
                              link_maps: form.link_maps || generateMapsLink(form.latitude, newLng)
                            });
                          }}
                          placeholder="-46.6333"
                        />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="link_maps">Link Google Maps</Label>
                      <div className="flex gap-2">
                        <Input
                          id="link_maps"
                          value={form.link_maps}
                          onChange={(e) => setForm({ ...form, link_maps: e.target.value })}
                          onBlur={(e) => {
                            // Auto-extract coordinates when user finishes typing/pasting
                            const url = e.target.value;
                            if (url && !form.latitude && !form.longitude) {
                              extractCoordsFromMapsUrl(url);
                            }
                          }}
                          onPaste={(e) => {
                            // Also trigger on paste for immediate feedback
                            setTimeout(() => {
                              const url = (e.target as HTMLInputElement).value;
                              if (url) {
                                extractCoordsFromMapsUrl(url);
                              }
                            }, 100);
                          }}
                          placeholder="Cole o link do Google Maps aqui..."
                          className="flex-1"
                        />
                        {isExtractingCoords && (
                          <Button type="button" variant="outline" size="icon" disabled>
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </Button>
                        )}
                        {!isExtractingCoords && form.link_maps && !form.latitude && !form.longitude && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => extractCoordsFromMapsUrl(form.link_maps)}
                            title="Extrair coordenadas"
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                        )}
                        {form.link_maps && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            asChild
                          >
                            <a href={form.link_maps} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cole um link do Google Maps para extrair automaticamente latitude e longitude
                      </p>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingCliente ? (
                      'Salvar Alterações'
                    ) : (
                      'Cadastrar Cliente'
                    )}
                  </Button>
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, fazenda ou código..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginatedClientes.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {filteredAndSortedClientes.length} cliente{filteredAndSortedClientes.length !== 1 ? 's' : ''} encontrado{filteredAndSortedClientes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <Card>
            <ScrollArea className="w-full">
              <div className="min-w-[1400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">
                        <Button variant="ghost" onClick={() => handleSort('nome')} className="h-auto p-0 font-medium hover:bg-transparent">
                          Nome Produtor {getSortIcon('nome')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('fazenda')} className="h-auto p-0 font-medium hover:bg-transparent">
                          Fazenda {getSortIcon('fazenda')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('cod_imilk')} className="h-auto p-0 font-medium hover:bg-transparent">
                          Cod iMilk {getSortIcon('cod_imilk')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('status')} className="h-auto p-0 font-medium hover:bg-transparent">
                          Status {getSortIcon('status')}
                        </Button>
                      </TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Consultor R+</TableHead>
                      <TableHead>Ativação</TableHead>
                      <TableHead>Painel</TableHead>
                      <TableHead>Ord/Dia</TableHead>
                      <TableHead>Tipo Pistola</TableHead>
                      <TableHead>Qtd Pistolas</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead className="sticky right-0 bg-background z-10 w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClientes.map((cliente) => {
                      const statusOption = statusOptions.find(s => s.value === cliente.status) || statusOptions[0];
                      return (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium sticky left-0 bg-background z-10">
                          {cliente.nome}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {cliente.fazenda || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {cliente.cod_imilk || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", statusOption.color)}>
                            {statusOption.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {cliente.cidade || cliente.estado 
                            ? `${cliente.cidade || ''}${cliente.cidade && cliente.estado ? '/' : ''}${cliente.estado || ''}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {getConsultorName(cliente.consultor_rplus_id) || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {cliente.data_ativacao_rumiflow 
                            ? format(new Date(cliente.data_ativacao_rumiflow), "dd/MM/yyyy", { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {cliente.tipo_painel || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {cliente.ordenhas_dia || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate" title={getPistolaName(cliente.tipo_pistola_id) || undefined}>
                          {getPistolaName(cliente.tipo_pistola_id) || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {cliente.quantidade_pistolas || '-'}
                        </TableCell>
                        <TableCell>
                          {cliente.link_maps ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="h-7 px-2"
                            >
                              <a href={cliente.link_maps} target="_blank" rel="noopener noreferrer">
                                <MapPin className="h-3 w-3 mr-1" />
                                Ver mapa
                              </a>
                            </Button>
                          ) : cliente.latitude && cliente.longitude ? (
                            <span className="text-xs text-muted-foreground">
                              {Number(cliente.latitude).toFixed(4)}, {Number(cliente.longitude).toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="sticky right-0 bg-background z-10">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(cliente)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(cliente)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedClientes.length)} de {filteredAndSortedClientes.length} registros
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">
              {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </h3>
            <p className="text-muted-foreground">
              {search ? 'Tente outra busca' : 'Clique em "Novo Cliente" para começar.'}
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{deletingCliente?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingCliente(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCliente && deleteCliente.mutate(deletingCliente.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCliente.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
