import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Loader2, Trash2, Minus, ArrowUpDown, Search, X, Eye, Pencil, ShoppingCart, Package, ImageIcon, Send, FileText, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Truck, HandHelping, AlertTriangle, User, RefreshCcw } from 'lucide-react';
import ProcessarPendenciaDialog from '@/components/pedidos/ProcessarPendenciaDialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import PedidoKanban from '@/components/pedidos/PedidoKanban';
import MultiAssetField from '@/components/pedidos/MultiAssetField';
import EditarPedidoSolicitado from '@/components/pedidos/EditarPedidoSolicitado';
import type { PedidoComItens, PedidoItem } from '@/types/pedidos';
import { useRealtimePecas } from '@/hooks/useRealtimePecas';
import { track } from '@/lib/analytics';

const statusColors: Record<string, string> = {
  rascunho: 'bg-muted text-muted-foreground border-muted-foreground/30',
  solicitado: 'bg-info/10 text-info border-info/20',
  pendente: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/40',
  processamento: 'bg-warning/10 text-warning border-warning/20',
  faturado: 'bg-primary/10 text-primary border-primary/20',
  enviado: 'bg-success/10 text-success border-success/20',
  entregue: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  solicitado: 'Solicitado',
  pendente: 'Pendente',
  processamento: 'Em Processamento',
  faturado: 'Faturado',
  enviado: 'Enviado',
  entregue: 'Entregue',
};

const emptyForm = {
  cliente_id: '',
  observacoes: '',
  urgencia: 'normal',
  tipo_envio: '',
  solenoide_modelo: '',
  tipo_solicitacao: 'envio',
  gera_coleta_reversa: false,
  tipo_coleta: '',
  tecnico_responsavel_user_id: '',
  csm_responsavel_user_id: '',
  coleta_responsavel_tipo: '',
  coleta_auto_tipo: '',
  coleta_auto_responsavel_tipo: '',
  coleta_auto_tecnico_id: '',
  coleta_auto_csm_id: '',
  motivo_relato: '',
  quantidade_volumes: '',
  coleta_auto_volumes: '',
};

const tipoEnvioReviewLabels: Record<string, string> = {
  envio_fisico: 'Envio Físico',
  envio_pelo_tecnico: 'Envio pelo Técnico',
  apenas_nf: 'Apenas NF',
};

const tipoColetaLabels: Record<string, string> = {
  correios: 'Correios',
  coleta_tecnico_csm: 'Coleta pelo Técnico/CSM',
  apenas_nf: 'Apenas NF',
};

// Técnicos fixos do formulário (resolvidos entre usuários com papel tecnico_campo)
const TECNICOS_FIXOS = ['phelipe', 'roger', 'lenilton'];

interface ResponsavelColetaPickerProps {
  respTipo: string;
  tecnicoId: string;
  csmId: string;
  tecnicosFixos: { id: string; nome: string }[];
  consultores: { id: string; nome: string }[];
  onRespTipo: (v: string) => void;
  onTecnico: (id: string) => void;
  onCsm: (id: string) => void;
}

function ResponsavelColetaPicker({ respTipo, tecnicoId, csmId, tecnicosFixos, consultores, onRespTipo, onTecnico, onCsm }: ResponsavelColetaPickerProps) {
  const [csmSearch, setCsmSearch] = useState('');
  const csmMatches = useMemo(() => {
    const q = csmSearch.trim().toLowerCase();
    const list = consultores || [];
    if (!q) return list.slice(0, 5);
    return list.filter(c => {
      const nome = (c.nome || '').toLowerCase();
      if (nome.includes(q)) return true;
      const iniciais = nome.split(/\s+/).map(w => w[0]).join('');
      return iniciais.startsWith(q);
    }).slice(0, 5);
  }, [csmSearch, consultores]);

  const csmNome = consultores?.find(c => c.id === csmId)?.nome;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <Label className="text-xs">Responsável</Label>
      <ToggleGroup
        type="single"
        value={respTipo}
        onValueChange={(v) => v && onRespTipo(v)}
        className="justify-start"
      >
        <ToggleGroupItem value="tecnico" className="text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          <User className="h-3 w-3" />
          Técnico
        </ToggleGroupItem>
        <ToggleGroupItem value="csm" className="text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          <HandHelping className="h-3 w-3" />
          CSM
        </ToggleGroupItem>
      </ToggleGroup>

      {respTipo === 'tecnico' && (
        <div className="space-y-1">
          <ToggleGroup
            type="single"
            value={tecnicoId}
            onValueChange={(v) => v && onTecnico(v)}
            className="justify-start"
          >
            {tecnicosFixos.map(t => (
              <ToggleGroupItem key={t.id} value={t.id} className="text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                <User className="h-3 w-3" />
                {t.nome.split(' ')[0]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {tecnicosFixos.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum Técnico de Campo encontrado (Phelipe, Roger, Lenilton).</p>
          )}
        </div>
      )}

      {respTipo === 'csm' && (
        <div className="space-y-1">
          {csmId ? (
            <div className="flex items-center justify-between p-2 rounded border bg-primary/5">
              <span className="text-sm font-medium truncate min-w-0">{csmNome}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onCsm('')} aria-label="Remover CSM">
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar CSM por nome ou iniciais..."
                value={csmSearch}
                onChange={(e) => setCsmSearch(e.target.value)}
              />
              <div className="max-h-32 overflow-y-auto rounded border divide-y">
                {csmMatches.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">Nenhum consultor encontrado</p>
                ) : csmMatches.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left text-sm px-2 py-1.5 hover:bg-muted/50 truncate min-w-0"
                    onClick={() => onCsm(c.id)}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Pedidos() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<any>(null);
  const [viewingStack, setViewingStack] = useState<any[]>([]);
  const viewingPedido = viewingStack.length > 0 ? viewingStack[viewingStack.length - 1] : null;
  const setViewingPedido = useCallback((next: any) => {
    setViewingStack((stack) => {
      const current = stack.length > 0 ? stack[stack.length - 1] : null;
      const value = typeof next === 'function' ? next(current) : next;
      if (!value) return [];
      // Abrir um pedido diferente a partir da listagem reinicia a pilha
      if (!current || current.id !== value.id) return [value];
      return [...stack.slice(0, -1), value];
    });
  }, []);
  const pushPedido = useCallback((pedido: any) => {
    setIsEditingSolicitado(false);
    setViewingStack((stack) => [...stack, pedido]);
  }, []);
  const popPedido = useCallback(() => {
    setIsEditingSolicitado(false);
    setViewingStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
  }, []);
  const [form, setForm] = useState({ ...emptyForm });
  const [itens, setItens] = useState<{ peca_id: string; quantidade: number; variante?: string }[]>([]);
  // Ativos vinculados na criação (índice do item em `itens` -> workshop_item_ids)
  const [itemAssets, setItemAssets] = useState<Record<number, string[]>>({});
  // Itens da coleta reversa automática: null = ainda usando a sugestão do envio
  const [coletaAutoItens, setColetaAutoItens] = useState<{ peca_id: string; quantidade: number; variante?: string }[] | null>(null);
  const [coletaAutoAssets, setColetaAutoAssets] = useState<Record<number, string[]>>({});
  const [coletaAutoPecaSearches, setColetaAutoPecaSearches] = useState<Record<number, string>>({});
  const [autoLinkDismissed, setAutoLinkDismissed] = useState(false);
  // UI-only filter: true = all orders (default), false = only mine
  const [viewAll, setViewAll] = useState(true);
  const [solicitanteFilter, setSolicitanteFilter] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  // Aviso não bloqueante de possível duplicidade (mesmo cliente + peça nos últimos 7 dias)
  const [duplicateWarning, setDuplicateWarning] = useState<string[] | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; nome: string } | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [editingAssetItemId, setEditingAssetItemId] = useState<string | null>(null);
  const [isEditingSolicitado, setIsEditingSolicitado] = useState(false);
  const [consultorNames, setConsultorNames] = useState<Record<string, string>>({});
  const [pedidoToDelete, setPedidoToDelete] = useState<PedidoComItens | null>(null);
  const [pendenciaPedido, setPendenciaPedido] = useState<PedidoComItens | null>(null);
  const [isDeletingPedido, setIsDeletingPedido] = useState(false);
  
  const isAdmin = role === 'admin' || role === 'coordenador_rplus' || role === 'coordenador_servicos' || role === 'coordenador_logistica';
  const canManagePedidos = role === 'admin' || role === 'coordenador_logistica' || role === 'coordenador_servicos';
  // Admin, coord. logística e coord. de serviços podem excluir pedidos de outros usuários
  const canDeleteAnyPedido = role === 'admin' || role === 'coordenador_logistica' || role === 'coordenador_servicos';

  // Fetch clientes from Supabase
  const { data: clientes } = useQuery({
    queryKey: ['pedidos-clientes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('id, nome, fazenda, cidade, estado, consultor_rplus_id').eq('status', 'ativo').order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Fetch pecas from Supabase
  const { data: pecas } = useQuery({
    queryKey: ['pedidos-pecas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pecas').select('id, codigo, nome, descricao, familia, imagem_url, is_asset, ativo').eq('ativo', true).order('codigo');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Técnicos de campo (papel tecnico_campo) — Envio pelo Técnico e Coleta pelo Técnico/CSM
  const { data: tecnicosCampo } = useQuery({
    queryKey: ['pedidos-tecnicos-campo'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_pedidos_responsaveis', { p_role: 'tecnico_campo' });
      if (error) throw error;
      return (data || []) as { user_id: string; nome: string }[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Consultores R+ (CSM) — responsáveis de coleta
  const { data: consultoresRplus } = useQuery({
    queryKey: ['pedidos-consultores-rplus'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_pedidos_responsaveis', { p_role: 'consultor_rplus' });
      if (error) throw error;
      return (data || []) as { user_id: string; nome: string }[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const tecnicosFixos = useMemo(() => {
    const all = (tecnicosCampo || []).map(t => ({ id: t.user_id, nome: t.nome }));
    return TECNICOS_FIXOS
      .map(slug => all.find(t => (t.nome || '').trim().toLowerCase().split(/\s+/)[0] === slug))
      .filter(Boolean) as { id: string; nome: string }[];
  }, [tecnicosCampo]);

  const getUserName = (id: string) =>
    tecnicosCampo?.find(t => t.user_id === id)?.nome
    || consultoresRplus?.find(c => c.user_id === id)?.nome
    || '—';

  // Realtime: refresh part catalog when pecas table changes
  useRealtimePecas([['pedidos-pecas']]);

  // Fetch pedidos from Supabase
  const { data: pedidos, isLoading } = useQuery({
    queryKey: ['pedidos'],
    queryFn: async () => {
      let query = supabase
        .from('pedidos')
        .select(`
          *,
          clientes(nome, fazenda, consultor_rplus_id),
          pedido_itens(
            *,
            pecas(nome, codigo, familia, is_asset, imagem_url),
            workshop_items:workshop_item_id(id, unique_code),
            pedido_item_assets(id, pedido_item_id, workshop_item_id, workshop_items:workshop_item_id(id, unique_code))
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500);




      const { data, error } = await query;
      if (error) throw error;

      // Fetch solicitante names
      const solicitanteIds = [...new Set((data || []).map(p => p.solicitante_id))];
      const { data: profiles } = solicitanteIds.length > 0
        ? await supabase.from('profiles').select('id, nome, email').in('id', solicitanteIds)
        : { data: [] as { id: string; nome: string; email: string }[] };
      const profileMap = new Map((profiles || []).map(p => [p.id, { nome: p.nome, email: p.email }]));

      return (data || []).map(p => ({
        ...p,
        solicitante: profileMap.get(p.solicitante_id) || null,
        pedido_itens: (p.pedido_itens || []).map((item: any) => ({
          ...item,
          workshop_item: item.workshop_items || null,
        })),
      })) as PedidoComItens[];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // Pedidos vinculados (envio <-> coleta reversa) do pedido no topo da pilha
  const { data: pedidoVinculos } = useQuery({
    queryKey: ['pedido-vinculos', viewingPedido?.id, viewingPedido?.tipo_solicitacao, viewingPedido?.coleta_reversa_origem_id],
    enabled: !!viewingPedido?.id,
    queryFn: async () => {
      const selectStr = `
        *,
        clientes(nome, fazenda, consultor_rplus_id),
        pedido_itens(
          *,
          pecas(nome, codigo, familia, is_asset, imagem_url),
          workshop_items:workshop_item_id(id, unique_code),
          pedido_item_assets(id, pedido_item_id, workshop_item_id, workshop_items:workshop_item_id(id, unique_code))
        )
      `;
      const normalize = (p: any) => ({
        ...p,
        pedido_itens: (p.pedido_itens || []).map((item: any) => ({
          ...item,
          workshop_item: item.workshop_items || null,
        })),
      });

      if (viewingPedido.tipo_solicitacao === 'coleta_reversa') {
        if (!viewingPedido.coleta_reversa_origem_id) return { origem: null, coletas: [] as any[] };
        const { data, error } = await supabase
          .from('pedidos')
          .select(selectStr)
          .eq('id', viewingPedido.coleta_reversa_origem_id)
          .maybeSingle();
        if (error) throw error;
        return { origem: data ? normalize(data) : null, coletas: [] as any[] };
      }

      const { data, error } = await supabase
        .from('pedidos')
        .select(selectStr)
        .eq('coleta_reversa_origem_id', viewingPedido.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return { origem: null, coletas: (data || []).map(normalize) };
    },
  });






  // Tab state for drafts vs submitted
  const [activeTab, setActiveTab] = useState<'rascunhos' | 'pedidos' | 'pendentes'>('pedidos');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({});
  const [clienteSearch, setClienteSearch] = useState('');
  const [pecaSearches, setPecaSearches] = useState<Record<number, string>>({});
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'30' | 'all'>('30');
  const [tipoEnvioFilter, setTipoEnvioFilter] = useState<'all' | 'envio' | 'apenas_nf' | 'envio_pelo_tecnico'>('all');
  const [tipoLogisticaFilter, setTipoLogisticaFilter] = useState<'all' | 'correios' | 'entrega_propria'>('all');
  const [searchParams] = useSearchParams();
  const tipoParam = searchParams.get('tipo');
  const [tipoSolicitacaoFilter, setTipoSolicitacaoFilter] = useState<'all' | 'envio' | 'coleta_reversa'>(
    () => (tipoParam === 'envio' || tipoParam === 'coleta_reversa' ? tipoParam : 'all')
  );
  const [responsavelFilter, setResponsavelFilter] = useState<'meus' | 'todos'>(() =>
    searchParams.get('meu') === '1' ? 'meus' : 'todos',
  );
  const [situacaoFilter, setSituacaoFilter] = useState<'pendentes' | 'concluidos' | 'todos'>(() =>
    searchParams.get('status') === 'pendente' ? 'pendentes' : 'todos',
  );

  // Sincroniza o filtro quando apenas a query string muda (navegação pelo submenu)
  useEffect(() => {
    setTipoSolicitacaoFilter(tipoParam === 'envio' || tipoParam === 'coleta_reversa' ? tipoParam : 'all');
  }, [tipoParam]);
  const [sortField, setSortField] = useState<'created_at' | 'cliente' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Unique solicitantes for filter dropdown
  const solicitantesUnicos = useMemo(() => {
    if (!pedidos) return [];
    const map = new Map<string, string>();
    for (const p of pedidos) {
      if (p.solicitante_id && !map.has(p.solicitante_id)) {
        map.set(p.solicitante_id, (p as any).solicitante?.nome || p.solicitante_id);
      }
    }
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [pedidos]);

  // Separate drafts from transmitted orders
  const rascunhos = useMemo(() => {
    if (!pedidos) return [];
    return pedidos.filter(p => p.status === 'rascunho');
  }, [pedidos]);

  const pedidosTransmitidos = useMemo(() => {
    if (!pedidos) return [];
    return pedidos.filter(p => p.status !== 'rascunho');
  }, [pedidos]);

  // Coletas reversas pendentes: responsável (técnico/CSM/solicitante em Correios) ou gestão vê todas
  const pendenciasVisiveis = useMemo(() => {
    if (!pedidos) return [];
    return pedidos.filter((p: any) => {
      if (p.status !== 'pendente') return false;
      if (canManagePedidos) return true;
      if (!user?.id) return false;
      return p.tecnico_responsavel_user_id === user.id
        || p.csm_responsavel_user_id === user.id
        || (p.tipo_coleta === 'correios' && p.solicitante_id === user.id);
    });
  }, [pedidos, canManagePedidos, user?.id]);

  // A aba Pendentes não faz sentido na visão "Envios" (envio nunca fica pendente)
  const showPendentesTab = tipoSolicitacaoFilter !== 'envio';

  useEffect(() => {
    if (!showPendentesTab && activeTab === 'pendentes') setActiveTab('pedidos');
  }, [showPendentesTab, activeTab]);

  const filteredAndSortedPedidos = useMemo(() => {
    const source = activeTab === 'rascunhos'
      ? rascunhos
      : activeTab === 'pendentes'
        ? pendenciasVisiveis
        : pedidosTransmitidos;
    if (!source.length) return [];
    
    let filtered = source.filter(pedido => {
        const searchLower = searchTerm.toLowerCase().trim();
        const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);
        
        const matchesSearch = searchTerm === '' || (() => {
          if (pedido.pedido_code?.toLowerCase().includes(searchLower)) return true;
          
          const clienteNome = pedido.clientes?.nome?.toLowerCase() || '';
          const clienteFazenda = pedido.clientes?.fazenda?.toLowerCase() || '';
          const clienteMatch = searchWords.every(word => 
            clienteNome.includes(word) || clienteFazenda.includes(word)
          );
          if (clienteMatch) return true;
          
          return pedido.pedido_itens?.some((item: any) => {
            const pecaCodigo = item.pecas?.codigo?.toLowerCase() || '';
            const pecaNome = item.pecas?.nome?.toLowerCase() || '';
            return searchWords.every(word => 
              pecaCodigo.includes(word) || pecaNome.includes(word)
            );
          });
        })();
      
        const matchesStatus = activeTab === 'rascunhos' || activeTab === 'pendentes' || statusFilter === 'all' || pedido.status === statusFilter;
        
        let matchesDate = true;
        if (dateFilter !== 'all') {
          const daysAgo = parseInt(dateFilter);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
          matchesDate = new Date(pedido.created_at) >= cutoffDate;
        }
        
        let matchesTipoEnvio = true;
        if (tipoEnvioFilter === 'envio') {
          matchesTipoEnvio = pedido.tipo_envio === 'envio_fisico';
        } else if (tipoEnvioFilter === 'apenas_nf') {
          matchesTipoEnvio = pedido.tipo_envio === 'apenas_nf';
        } else if (tipoEnvioFilter === 'envio_pelo_tecnico') {
          matchesTipoEnvio = pedido.tipo_envio === 'envio_pelo_tecnico';
        }

        let matchesTipoLogistica = true;
        if (tipoLogisticaFilter === 'correios') {
          matchesTipoLogistica = pedido.tipo_logistica === 'correios';
        } else if (tipoLogisticaFilter === 'entrega_propria') {
          matchesTipoLogistica = pedido.tipo_logistica === 'entrega_propria';
        }

        let matchesTipoSolicitacao = true;
        if (tipoSolicitacaoFilter === 'envio') {
          matchesTipoSolicitacao = ((pedido as any).tipo_solicitacao ?? 'envio') === 'envio';
        } else if (tipoSolicitacaoFilter === 'coleta_reversa') {
          matchesTipoSolicitacao = ((pedido as any).tipo_solicitacao ?? 'envio') === 'coleta_reversa';
        }

        const matchesSolicitante = solicitanteFilter === 'all' || pedido.solicitante_id === solicitanteFilter;

        // UI-only ownership filter (does not restrict what is read from the database)
        const matchesOwner = viewAll || pedido.solicitante_id === user?.id;

        const matchesResponsavel = responsavelFilter === 'todos'
          || pedido.tecnico_responsavel_user_id === user?.id
          || pedido.csm_responsavel_user_id === user?.id;
        const concluido = pedido.status === 'entregue';
        const matchesSituacao = situacaoFilter === 'todos'
          || (situacaoFilter === 'concluidos' && concluido)
          || (situacaoFilter === 'pendentes' && !concluido);

        return matchesSearch && matchesStatus && matchesDate && matchesTipoEnvio && matchesTipoLogistica && matchesTipoSolicitacao && matchesSolicitante && matchesOwner && matchesResponsavel && matchesSituacao;
      });
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === 'cliente') {
        comparison = (a.clientes?.nome || '').localeCompare(b.clientes?.nome || '');
      } else if (sortField === 'status') {
        const statusOrder = ['rascunho', 'solicitado', 'pendente', 'processamento', 'faturado', 'enviado', 'entregue'];
        comparison = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [pedidos, rascunhos, pedidosTransmitidos, pendenciasVisiveis, activeTab, searchTerm, statusFilter, dateFilter, tipoEnvioFilter, tipoLogisticaFilter, tipoSolicitacaoFilter, solicitanteFilter, sortField, sortOrder, viewAll, user?.id, responsavelFilter, situacaoFilter]);

  // Paginated data (only for Transmitidos tab)
  const paginatedPedidos = useMemo(() => {
    if (activeTab === 'rascunhos') return filteredAndSortedPedidos;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedPedidos.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedPedidos, currentPage, activeTab, ITEMS_PER_PAGE]);

  const totalPages = useMemo(() => {
    if (activeTab === 'rascunhos') return 1;
    return Math.ceil(filteredAndSortedPedidos.length / ITEMS_PER_PAGE);
  }, [filteredAndSortedPedidos.length, activeTab, ITEMS_PER_PAGE]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, tipoEnvioFilter, tipoLogisticaFilter, tipoSolicitacaoFilter, solicitanteFilter, activeTab]);

  const toggleSort = (field: 'created_at' | 'cliente' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
    setTipoEnvioFilter('all');
    setTipoLogisticaFilter('all');
    setTipoSolicitacaoFilter('all');
    setSolicitanteFilter('all');
  };

  const handleTransmitir = async (pedidoId: string) => {
    setIsTransmitting(true);
    try {
      const { error } = await supabase.from('pedidos').update({ status: 'solicitado' }).eq('id', pedidoId);
      if (error) throw error;
      track('pedido_transmitted', { count: 1, mode: 'single' }, { entity: 'pedido', entity_id: pedidoId });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({ title: 'Pedido transmitido!', description: 'O pedido foi enviado para processamento.' });
      setActiveTab('pedidos');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao transmitir', description: error.message });
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleTransmitirTodos = async () => {
    if (rascunhos.length === 0) return;
    setIsTransmitting(true);
    try {
      const { error } = await supabase.from('pedidos').update({ status: 'solicitado' }).in('id', rascunhos.map(r => r.id));
      if (error) throw error;
      track('pedido_transmitted', { count: rascunhos.length, mode: 'bulk' }, { entity: 'pedido' });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({ 
        title: 'Todos os rascunhos transmitidos!', 
        description: `${rascunhos.length} pedido(s) enviado(s) para processamento.` 
      });
      setActiveTab('pedidos');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao transmitir', description: error.message });
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleDeletePedido = async () => {
    if (!editingPedido) return;
    setIsDeleting(true);
    try {
      // Delete items first then pedido
      const { error: itensError } = await supabase.from('pedido_itens').delete().eq('pedido_id', editingPedido.id);
      if (itensError) throw itensError;
      const { error: pedidoError } = await supabase.from('pedidos').delete().eq('id', editingPedido.id);
      if (pedidoError) throw pedidoError;
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      track('pedido_deleted', { from_status: 'rascunho' }, { entity: 'pedido', entity_id: editingPedido.id });
      toast({ title: 'Rascunho excluído!' });
      setOpen(false);
      setEditingPedido(null);
      setForm({ ...emptyForm });
      setItens([]);
      setItemAssets({});
      setAutoLinkDismissed(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  // Códigos de peças com vínculo automático
  const AUTO_LINK_TRIGGER_CODE = 'PRD00605';
  const AUTO_LINK_TARGET_CODE = 'PRD00639';
  const AUTO_LINK_TARGET_QTY = 3;
  const SOLENOIDE_CODE = 'PRD00605';

  const normalizePecaCode = (value?: string | null) => (value || '').trim().toUpperCase();

  const findPecaIdByCodigo = (codigo: string) =>
    pecas?.find((p) => normalizePecaCode(p.codigo) === normalizePecaCode(codigo))?.id;

  const solenoideId = findPecaIdByCodigo(SOLENOIDE_CODE);
  const hasSolenoide = itens.some((item) => {
    const codigoPeca = pecas?.find((peca) => peca.id === item.peca_id)?.codigo;
    return normalizePecaCode(codigoPeca) === normalizePecaCode(SOLENOIDE_CODE);
  });

  /**
   * Insere PRD00639 automaticamente na CRIAÇÃO quando PRD00605 estiver no pedido
   * e PRD00639 ainda não estiver presente. Após inserido (ou se já existir),
   * PRD00639 passa a ser tratado como item independente — não recalcula qty
   * nem remove automaticamente.
   */
  const applyAutoLinks = (list: { peca_id: string; quantidade: number }[]) => {
    if (autoLinkDismissed) return list;
    const triggerId = findPecaIdByCodigo(AUTO_LINK_TRIGGER_CODE);
    const targetId = findPecaIdByCodigo(AUTO_LINK_TARGET_CODE);
    if (!triggerId || !targetId) return list;
    const totalTrigger = list
      .filter(i => i.peca_id === triggerId)
      .reduce((sum, i) => sum + (Number(i.quantidade) || 0), 0);
    const hasTarget = list.some(i => i.peca_id === targetId);
    if (totalTrigger > 0 && !hasTarget) {
      return [...list, { peca_id: targetId, quantidade: totalTrigger * AUTO_LINK_TARGET_QTY }];
    }
    return list;
  };


  const addItem = () => {
    setItens([...itens, { peca_id: '', quantidade: 1 }]);
  };

  const updateItem = (index: number, field: 'peca_id' | 'quantidade', value: string | number) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], [field]: value };
    if (field === 'peca_id') {
      setItemAssets((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
    setItens(applyAutoLinks(newItens));
  };

  const incrementQuantity = (index: number) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], quantidade: newItens[index].quantidade + 1 };
    setItens(applyAutoLinks(newItens));
  };

  const decrementQuantity = (index: number) => {
    const newItens = [...itens];
    if (newItens[index].quantidade > 1) {
      newItens[index] = { ...newItens[index], quantidade: newItens[index].quantidade - 1 };
      setItens(applyAutoLinks(newItens));
    }
  };

  const removeItem = (index: number) => {
    const removed = itens[index];
    const solenoideIdLocal = solenoideId;
    const targetIdLocal = findPecaIdByCodigo(AUTO_LINK_TARGET_CODE);
    const next = itens.filter((_, i) => i !== index);
    // Se removeu a solenóide PRD00605, limpa o modelo selecionado e reseta o flag
    if (removed?.peca_id && solenoideIdLocal && removed.peca_id === solenoideIdLocal) {
      setForm((f) => ({ ...f, solenoide_modelo: '' }));
      setAutoLinkDismissed(false);
    }
    // Se removeu manualmente PRD00639, marca para não reinserir automaticamente
    if (removed?.peca_id && targetIdLocal && removed.peca_id === targetIdLocal) {
      setAutoLinkDismissed(true);
    }
    // Reindexa os ativos vinculados após a remoção
    setItemAssets((prev) => {
      const reindexed: Record<number, string[]> = {};
      itens.forEach((_, i) => {
        if (i === index) return;
        const target = i > index ? i - 1 : i;
        if (prev[i]) reindexed[target] = prev[i];
      });
      return reindexed;
    });
    // Remoção manual: não reinsere PRD00639 automaticamente
    setItens(next);
  };


  const getPecaLabel = (pecaId: string) => {
    const peca = pecas?.find(p => p.id === pecaId);
    return peca ? `${peca.codigo} - ${peca.nome}` : 'Selecione a peça';
  };

  const handleEditPedido = (pedido: any) => {
    // Pedidos transmitidos (status 'solicitado') usam o editor incremental que preserva log/assets
    if (pedido.status === 'solicitado') {
      setViewingPedido(pedido);
      setIsEditingSolicitado(true);
      return;
    }
    setEditingPedido(pedido);
    setForm({
      ...emptyForm,
      cliente_id: pedido.cliente_id,
      observacoes: pedido.observacoes || '',
      urgencia: pedido.urgencia || 'normal',
      tipo_envio: pedido.tipo_envio || '',
      solenoide_modelo: (pedido as any).solenoide_modelo || '',
      tipo_solicitacao: (pedido as any).tipo_solicitacao || 'envio',
      gera_coleta_reversa: false,
      tipo_coleta: (pedido as any).tipo_coleta || '',
      tecnico_responsavel_user_id: (pedido as any).tecnico_responsavel_user_id || '',
      csm_responsavel_user_id: (pedido as any).csm_responsavel_user_id || '',
      coleta_responsavel_tipo: (pedido as any).tecnico_responsavel_user_id ? 'tecnico' : ((pedido as any).csm_responsavel_user_id ? 'csm' : ''),
      motivo_relato: (pedido as any).motivo_relato || '',
      quantidade_volumes: (pedido as any).quantidade_volumes != null ? String((pedido as any).quantidade_volumes) : '',
    });
    setItens(
      pedido.pedido_itens?.map((item: any) => ({
        peca_id: item.peca_id,
        quantidade: item.quantidade,
      })) || []
    );
    setItemAssets(
      Object.fromEntries(
        (pedido.pedido_itens || []).map((item: any, idx: number) => [
          idx,
          (item.pedido_item_assets || []).map((a: any) => a.workshop_item_id).filter(Boolean),
        ]).filter(([, ids]: any) => (ids as string[]).length > 0)
      ) as Record<number, string[]>
    );
    setOpen(true);
  };

  const handleDeletePedidoSolicitado = async () => {
    if (!pedidoToDelete) return;
    setIsDeletingPedido(true);
    try {
      const itemIds = (pedidoToDelete.pedido_itens || []).map((i: any) => i.id);
      // 1) pedido_item_assets
      if (itemIds.length > 0) {
        const { error: assetsErr } = await supabase
          .from('pedido_item_assets')
          .delete()
          .in('pedido_item_id', itemIds);
        if (assetsErr) throw assetsErr;
      }
      // 2) pedido_item_log
      const { error: logErr } = await supabase
        .from('pedido_item_log')
        .delete()
        .eq('pedido_id', pedidoToDelete.id);
      if (logErr) throw logErr;
      // 3) pedido_itens
      const { error: itensErr } = await supabase
        .from('pedido_itens')
        .delete()
        .eq('pedido_id', pedidoToDelete.id);
      if (itensErr) throw itensErr;
      // 4) pedidos — usar .select() para detectar falha silenciosa de RLS
      const { data: deletedRows, error: pedidoErr } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', pedidoToDelete.id)
        .select('id');
      if (pedidoErr) throw pedidoErr;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('Não foi possível excluir o pedido. Verifique suas permissões.');
      }

      await queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      track('pedido_deleted', {
        from_status: pedidoToDelete.status,
        pedido_code: pedidoToDelete.pedido_code || null,
      }, { entity: 'pedido', entity_id: pedidoToDelete.id });
      toast({
        title: 'Pedido excluído',
        description: `${pedidoToDelete.pedido_code || 'Pedido'} foi removido permanentemente.`,
      });
      setPedidoToDelete(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    } finally {
      setIsDeletingPedido(false);
    }
  };

  const handleCloseDialog = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingPedido(null);
      setForm({ ...emptyForm });
      setItens([]);
      setItemAssets({});
      setAutoLinkDismissed(false);
      setShowConfirmation(false);
      setClienteSearch('');
      setPecaSearches({});
    } else if (!editingPedido && tipoSolicitacaoFilter !== 'all') {
      // Abertura do formulário de criação numa visão filtrada: tipo fixo pelo contexto
      setForm({ ...emptyForm, tipo_solicitacao: tipoSolicitacaoFilter });
    }
  };

  // Itens da criação que exigem vínculo de ativo (peças is_asset)
  const assetItens = itens
    .map((item, index) => ({ index, item, peca: pecas?.find(p => p.id === item.peca_id) }))
    .filter(entry => !!entry.peca?.is_asset);
  // Envio com ativo controlado (pecas.is_asset) sempre gera coleta reversa automática
  const coletaReversaObrigatoria =
    !editingPedido && form.tipo_solicitacao === 'envio' && assetItens.length > 0;
  const geraColetaReversaAtivo =
    form.tipo_solicitacao === 'envio' && (form.gera_coleta_reversa || coletaReversaObrigatoria);
  // Ativos exigidos na criação: Coleta Reversa (manual) e Envio com coleta reversa automática —
  // Envio comum vincula ativo só no Processar
  const requiresAssetsOnCreate =
    !editingPedido &&
    (form.tipo_solicitacao === 'coleta_reversa' || geraColetaReversaAtivo) &&
    assetItens.length > 0;
  const missingAssetItem = assetItens.find(entry => (itemAssets[entry.index] || []).filter(Boolean).length === 0);

  const assetsByPecaId = () => {
    const map: Record<string, string[]> = {};
    itens.forEach((item, index) => {
      const ids = (itemAssets[index] || []).filter(Boolean);
      if (item.peca_id && ids.length > 0) map[item.peca_id] = ids;
    });
    return map;
  };

  const saveAssetsForItems = async (rows: { id: string; peca_id: string }[]) => {
    const byPeca = assetsByPecaId();
    for (const row of rows) {
      const ids = byPeca[row.peca_id];
      if (!ids || ids.length === 0) continue;
      const { error: itemError } = await supabase.from('pedido_itens').update({ workshop_item_id: ids[0] }).eq('id', row.id);
      if (itemError) throw itemError;
      const { error: junctionError } = await supabase
        .from('pedido_item_assets')
        .upsert(ids.map(wsId => ({ pedido_item_id: row.id, workshop_item_id: wsId })), { onConflict: 'pedido_item_id,workshop_item_id', ignoreDuplicates: true });
      if (junctionError) throw junctionError;
      const { data: wsItems } = await supabase.from('workshop_items').select('unique_code').in('id', ids);
      if (wsItems) {
        await supabase.from('pedido_itens').update({ asset_codes: wsItems.map(w => w.unique_code) }).eq('id', row.id);
      }
    }
  };

  const handleShowConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id) {
      toast({ variant: 'destructive', title: 'Selecione um cliente' });
      return;
    }
    if (itens.length === 0 || itens.some((i) => !i.peca_id)) {
      toast({ variant: 'destructive', title: 'Adicione pelo menos uma peça válida' });
      return;
    }
    if (hasSolenoide && !form.solenoide_modelo) {
      toast({ variant: 'destructive', title: 'Selecione o Modelo (2x ou 3x) da solenóide' });
      return;
    }
    if (form.tipo_solicitacao === 'envio' && form.tipo_envio === 'envio_pelo_tecnico' && !form.tecnico_responsavel_user_id) {
      toast({ variant: 'destructive', title: 'Selecione o técnico responsável pelo envio' });
      return;
    }
    if (!form.motivo_relato.trim()) {
      toast({ variant: 'destructive', title: 'Informe o motivo da solicitação e o relato da fazenda' });
      return;
    }
    if (form.tipo_solicitacao === 'coleta_reversa') {
      if (!form.tipo_coleta) {
        toast({ variant: 'destructive', title: 'Selecione o Tipo de Coleta' });
        return;
      }
      if (form.tipo_coleta === 'coleta_tecnico_csm' && !form.tecnico_responsavel_user_id && !form.csm_responsavel_user_id) {
        toast({ variant: 'destructive', title: 'Selecione o Técnico ou CSM responsável pela coleta' });
        return;
      }
      if (!(Number(form.quantidade_volumes) >= 1)) {
        toast({ variant: 'destructive', title: 'Informe a Quantidade de Volumes (mínimo 1)' });
        return;
      }
    }
    if (geraColetaReversaAtivo && !editingPedido) {
      if (!form.coleta_auto_tipo) {
        toast({ variant: 'destructive', title: 'Selecione o Tipo de Coleta da coleta reversa automática' });
        return;
      }
      if (form.coleta_auto_tipo === 'coleta_tecnico_csm' && !form.coleta_auto_tecnico_id && !form.coleta_auto_csm_id) {
        toast({ variant: 'destructive', title: 'Selecione o Técnico ou CSM responsável pela coleta reversa automática' });
        return;
      }
      if (!(Number(form.coleta_auto_volumes) >= 1)) {
        toast({ variant: 'destructive', title: 'Informe a Quantidade de Volumes da coleta reversa automática (mínimo 1)' });
        return;
      }
    }
    if (requiresAssetsOnCreate && missingAssetItem) {
      toast({
        variant: 'destructive',
        title: 'Vincule o ativo da coleta reversa',
        description: `A peça ${missingAssetItem.peca?.codigo || ''} precisa de ao menos um ativo vinculado.`,
      });
      return;
    }
    // Aviso (não bloqueante) de possível duplicidade: mesma peça, mesmo cliente,
    // em pedido não-rascunho criado nos últimos 7 dias.
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: dups } = await supabase
        .from('pedido_itens')
        .select('peca_id, pedidos!inner(id, pedido_code, cliente_id, status, created_at)')
        .in('peca_id', itens.map(i => i.peca_id))
        .is('cancelled_at', null)
        .eq('pedidos.cliente_id', form.cliente_id)
        .neq('pedidos.status', 'rascunho')
        .gte('pedidos.created_at', since);

      const conflitos = (dups || [])
        .filter((d: any) => !editingPedido || d.pedidos?.id !== editingPedido.id)
        .map((d: any) => {
          const peca = pecas?.find(p => p.id === d.peca_id);
          const nome = [peca?.codigo, peca?.descricao].filter(Boolean).join(' — ') || 'Peça';
          return `${nome} (pedido ${d.pedidos?.pedido_code || 's/ código'})`;
        });

      if (conflitos.length > 0) {
        setDuplicateWarning(Array.from(new Set(conflitos)));
        return;
      }
    } catch {
      // Falha na checagem nunca bloqueia o envio
    }

    setShowConfirmation(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (editingPedido) {
        // Update pedido
        const tecnicoRespId = form.tipo_solicitacao === 'envio'
          ? (form.tipo_envio === 'envio_pelo_tecnico' ? (form.tecnico_responsavel_user_id || null) : null)
          : (form.tipo_coleta === 'coleta_tecnico_csm' && form.coleta_responsavel_tipo === 'tecnico' ? (form.tecnico_responsavel_user_id || null) : null);
        const csmRespId = form.tipo_solicitacao === 'coleta_reversa' && form.tipo_coleta === 'coleta_tecnico_csm' && form.coleta_responsavel_tipo === 'csm'
          ? (form.csm_responsavel_user_id || null) : null;
        const { error: pedidoError } = await supabase.from('pedidos').update({
          cliente_id: form.cliente_id,
          observacoes: form.observacoes || null,
          solenoide_modelo: hasSolenoide ? form.solenoide_modelo : null,
          tipo_coleta: form.tipo_solicitacao === 'coleta_reversa' ? (form.tipo_coleta || null) : null,
          tecnico_responsavel_user_id: tecnicoRespId,
          csm_responsavel_user_id: csmRespId,
          motivo_relato: form.motivo_relato || null,
          quantidade_volumes: form.tipo_solicitacao === 'coleta_reversa' && form.quantidade_volumes !== '' ? Number(form.quantidade_volumes) : null,
        } as any).eq('id', editingPedido.id);
        if (pedidoError) throw pedidoError;

        // Delete old items
        const { error: deleteError } = await supabase.from('pedido_itens').delete().eq('pedido_id', editingPedido.id);
        if (deleteError) throw deleteError;

        // Create new items
        const newItens = itens.map(item => ({
          pedido_id: editingPedido.id,
          peca_id: item.peca_id,
          quantidade: item.quantidade,
        }));
        const { data: insertedItens, error: itensError } = await supabase.from('pedido_itens').insert(newItens).select('id, peca_id');
        if (itensError) throw itensError;
        if (form.tipo_solicitacao === 'coleta_reversa' && insertedItens) {
          await saveAssetsForItems(insertedItens as { id: string; peca_id: string }[]);
        }

        toast({ title: 'Pedido atualizado!' });
      } else {
        const geraColetaReversa = geraColetaReversaAtivo;

        // Create new pedido
        const { data: pedido, error: pedidoError } = await supabase
          .from('pedidos')
          .insert({
            solicitante_id: user!.id,
            cliente_id: form.cliente_id,
            observacoes: form.observacoes || null,
            origem: 'chamado',
            tipo_envio: form.tipo_envio || null,
            urgencia: form.urgencia,
            status: 'rascunho',
            solenoide_modelo: hasSolenoide ? form.solenoide_modelo : null,
            tipo_solicitacao: form.tipo_solicitacao,
            gera_coleta_reversa_automatica: geraColetaReversa,
            tipo_coleta: form.tipo_solicitacao === 'coleta_reversa' ? (form.tipo_coleta || null) : null,
            tecnico_responsavel_user_id: form.tipo_solicitacao === 'envio'
              ? (form.tipo_envio === 'envio_pelo_tecnico' ? (form.tecnico_responsavel_user_id || null) : null)
              : (form.tipo_coleta === 'coleta_tecnico_csm' && form.coleta_responsavel_tipo === 'tecnico' ? (form.tecnico_responsavel_user_id || null) : null),
            csm_responsavel_user_id: form.tipo_solicitacao === 'coleta_reversa' && form.tipo_coleta === 'coleta_tecnico_csm' && form.coleta_responsavel_tipo === 'csm'
              ? (form.csm_responsavel_user_id || null) : null,
            motivo_relato: form.motivo_relato || null,
            quantidade_volumes: form.tipo_solicitacao === 'coleta_reversa' && form.quantidade_volumes !== '' ? Number(form.quantidade_volumes) : null,
          } as any)
          .select('id')
          .single();
        if (pedidoError) throw pedidoError;

        // Create items
        const newItens = itens.map(item => ({
          pedido_id: pedido.id,
          peca_id: item.peca_id,
          quantidade: item.quantidade,
        }));
        const { data: insertedItens, error: itensError } = await supabase.from('pedido_itens').insert(newItens).select('id, peca_id');
        if (itensError) {
          // Rollback: delete orphan pedido
          await supabase.from('pedidos').delete().eq('id', pedido.id);
          throw itensError;
        }
        if (form.tipo_solicitacao === 'coleta_reversa' && insertedItens) {
          try {
            await saveAssetsForItems(insertedItens as { id: string; peca_id: string }[]);
          } catch (assetErr: any) {
            await supabase.from('pedidos').delete().eq('id', pedido.id);
            throw assetErr;
          }
        }

        track('pedido_created', {
          items_count: newItens.length,
          total_qty: newItens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0),
          urgencia: form.urgencia,
          tipo_envio: form.tipo_envio || null,
          origem: 'chamado',
          has_solenoide: hasSolenoide,
          tipo_solicitacao: form.tipo_solicitacao,
          gera_coleta_reversa_automatica: geraColetaReversa,
        }, { entity: 'pedido', entity_id: pedido.id });

        // Coleta reversa automática (não reverte o envio em caso de falha)
        let coletaReversaOk = true;
        if (geraColetaReversa) {
          try {
            const { data: coleta, error: coletaError } = await supabase
              .from('pedidos')
              .insert({
                solicitante_id: user!.id,
                cliente_id: form.cliente_id,
                observacoes: form.observacoes || null,
                origem: 'chamado',
                tipo_envio: null,
                urgencia: form.urgencia,
                status: 'rascunho',
                solenoide_modelo: hasSolenoide ? form.solenoide_modelo : null,
                tipo_solicitacao: 'coleta_reversa',
                gera_coleta_reversa_automatica: false,
                coleta_reversa_origem_id: pedido.id,
                tipo_coleta: form.coleta_auto_tipo || null,
                tecnico_responsavel_user_id: form.coleta_auto_tipo === 'coleta_tecnico_csm' && form.coleta_auto_responsavel_tipo === 'tecnico' ? (form.coleta_auto_tecnico_id || null) : null,
                csm_responsavel_user_id: form.coleta_auto_tipo === 'coleta_tecnico_csm' && form.coleta_auto_responsavel_tipo === 'csm' ? (form.coleta_auto_csm_id || null) : null,
                motivo_relato: form.motivo_relato || null,
                quantidade_volumes: form.coleta_auto_volumes !== '' ? Number(form.coleta_auto_volumes) : null,
              } as any)
              .select('id')
              .single();
            if (coletaError) throw coletaError;

            const coletaItens = itens.map(item => ({
              pedido_id: coleta.id,
              peca_id: item.peca_id,
              quantidade: item.quantidade,
            }));
            const { data: insertedColetaItens, error: coletaItensError } = await supabase.from('pedido_itens').insert(coletaItens).select('id, peca_id');
            if (coletaItensError) {
              await supabase.from('pedidos').delete().eq('id', coleta.id);
              throw coletaItensError;
            }
            if (insertedColetaItens) {
              try {
                await saveAssetsForItems(insertedColetaItens as { id: string; peca_id: string }[]);
              } catch (assetErr: any) {
                await supabase.from('pedidos').delete().eq('id', coleta.id);
                throw assetErr;
              }
            }
          } catch (coletaErr: any) {
            coletaReversaOk = false;
            toast({
              variant: 'destructive',
              title: 'Coleta reversa não gerada',
              description: `O envio foi salvo, mas a coleta reversa automática falhou (${coletaErr.message}). Crie a coleta reversa manualmente depois.`,
            });
          }
        }

        if (geraColetaReversa && coletaReversaOk) {
          toast({ title: 'Rascunhos salvos!', description: 'Envio e coleta reversa criados. Clique em "Transmitir" para enviar.' });
        } else {
          toast({ title: 'Rascunho salvo!', description: 'Clique em "Transmitir" para enviar o pedido.' });
        }
        setActiveTab('rascunhos');
      }
      setOpen(false);
      setEditingPedido(null);
      setForm({ ...emptyForm });
      setItens([]);
      setItemAssets({});
      setAutoLinkDismissed(false);
      setShowConfirmation(false);
      setClienteSearch('');
      setPecaSearches({});
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar pedido', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Processar pedido (solicitado -> processamento)
  const handleProcessar = useCallback(async (pedidoId: string, tipoLogistica?: string, itemsWithAssets?: Record<string, string[]>, codigoPostagem?: string, anexoFile?: File) => {
    setIsProcessingAction(true);
    try {
      const pedidoAtual = pedidos.find(p => p.id === pedidoId);
      const isColetaReversa = pedidoAtual?.tipo_solicitacao === 'coleta_reversa';

      const updateData: any = { status: isColetaReversa ? 'pendente' : 'processamento' };
      if (tipoLogistica) updateData.tipo_logistica = tipoLogistica;

      if (isColetaReversa) {
        if (codigoPostagem) updateData.codigo_postagem = codigoPostagem;
        if (anexoFile) {
          const safeName = anexoFile.name.replace(/[^\w.\-]/g, '_');
          const path = `${pedidoId}/${Date.now()}-${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from('pedido-anexos')
            .upload(path, anexoFile, { upsert: false });
          if (uploadError) throw uploadError;
          updateData.anexo_postagem_path = path;
        }
      }
      
      
      const { error } = await supabase
        .from('pedidos')
        .update(updateData)
        .eq('id', pedidoId);
      if (error) throw error;

      // Save asset associations into junction table
      if (itemsWithAssets) {
        for (const [itemId, assetIds] of Object.entries(itemsWithAssets)) {
          const validIds = assetIds.filter(id => !!id);
          if (validIds.length > 0) {
            // Set first asset as workshop_item_id for backwards compat
            const { error: itemError } = await supabase.from('pedido_itens').update({ workshop_item_id: validIds[0] }).eq('id', itemId).neq('workshop_item_id', validIds[0]);
            if (itemError) throw itemError;

            // Insert all into junction table
            const rows = validIds.map(wsId => ({ pedido_item_id: itemId, workshop_item_id: wsId }));
            const { error: junctionError } = await supabase.from('pedido_item_assets').insert(rows);
            if (junctionError) throw junctionError;

            // Fetch unique_codes for asset_codes array
            const { data: wsItems } = await supabase.from('workshop_items').select('unique_code').in('id', validIds);
            if (wsItems) {
              const codes = wsItems.map(w => w.unique_code);
              await supabase.from('pedido_itens').update({ asset_codes: codes }).eq('id', itemId);
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      track('pedido_processed', {
        tipo_logistica: tipoLogistica || null,
        assets_linked_items: itemsWithAssets ? Object.keys(itemsWithAssets).filter(k => (itemsWithAssets[k] || []).length > 0).length : 0,
      }, { entity: 'pedido', entity_id: pedidoId });
      toast({ title: isColetaReversa ? 'Coleta reversa marcada como pendente!' : 'Pedido movido para processamento!' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setIsProcessingAction(false);
    }
  }, [toast, queryClient, pedidos]);

  // Responsável pela pendência da coleta reversa (definido na criação)
  const isResponsavelPendencia = useCallback((pedido: any) => {
    if (!user?.id) return false;
    return pedido?.tecnico_responsavel_user_id === user.id
      || pedido?.csm_responsavel_user_id === user.id
      || (pedido?.tipo_coleta === 'correios' && pedido?.solicitante_id === user.id);
  }, [user?.id]);

  // Processar pendência da coleta reversa (pendente -> processamento + código de rastreio)
  const handleProcessarPendencia = useCallback(async (pedidoId: string, codigoRastreio: string, anexoFile?: File) => {
    setIsProcessingAction(true);
    try {
      const updateData: any = { status: 'processamento', codigo_rastreio: codigoRastreio };

      if (anexoFile) {
        const safeName = anexoFile.name.replace(/[^\w.\-]/g, '_');
        const path = `${pedidoId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('pedido-anexos')
          .upload(path, anexoFile, { upsert: false });
        if (uploadError) throw uploadError;
        updateData.anexo_rastreio_path = path;
      }

      const { error } = await supabase.from('pedidos').update(updateData).eq('id', pedidoId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      track('pedido_pendencia_processada', {}, { entity: 'pedido', entity_id: pedidoId });
      toast({ title: 'Pendência processada!', description: 'A coleta reversa foi movida para Em Processamento.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setIsProcessingAction(false);
    }
  }, [toast, queryClient]);

  // Concluir pedido (processamento -> faturado + NF + tipo_logistica)
  const handleConcluir = useCallback(async (pedidoId: string, nfNumero: string, dataFaturamento: string, tipoLogistica: string, itemsWithAssets?: Record<string, string[]>, nfNumero2?: string) => {
    setIsProcessingAction(true);
    try {
      // Save asset associations BEFORE updating status
      if (itemsWithAssets) {
        for (const [itemId, assetIds] of Object.entries(itemsWithAssets)) {
          const validIds = assetIds.filter(id => !!id);
          if (validIds.length > 0) {
            const { error: itemError } = await supabase.from('pedido_itens').update({ workshop_item_id: validIds[0] }).eq('id', itemId).neq('workshop_item_id', validIds[0]);
            if (itemError) throw itemError;

            const rows = validIds.map(wsId => ({ pedido_item_id: itemId, workshop_item_id: wsId }));
            const { error: junctionError } = await supabase
              .from('pedido_item_assets')
              .upsert(rows, { onConflict: 'pedido_item_id,workshop_item_id', ignoreDuplicates: true });
            if (junctionError) throw junctionError;

            const { data: wsItems } = await supabase.from('workshop_items').select('unique_code').in('id', validIds);
            if (wsItems) {
              const codes = wsItems.map(w => w.unique_code);
              await supabase.from('pedido_itens').update({ asset_codes: codes }).eq('id', itemId);
            }
          }
        }
      }

      const { error } = await supabase
        .from('pedidos')
        .update({ 
          status: 'faturado', 
          omie_nf_numero: nfNumero,
          omie_nf_numero_2: nfNumero2 || null,
          omie_data_faturamento: dataFaturamento,
          tipo_logistica: tipoLogistica,
        } as any)
        .eq('id', pedidoId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      const nfLabel = nfNumero2 ? `${nfNumero} / ${nfNumero2}` : nfNumero;
      track('pedido_concluded', {
        tipo_logistica: tipoLogistica,
        has_nf_secondary: !!nfNumero2,
      }, { entity: 'pedido', entity_id: pedidoId });
      toast({ title: 'Pedido concluído!', description: `NF ${nfLabel} registrada.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setIsProcessingAction(false);
    }
  }, [toast, queryClient]);

  // Vincular ativos diretamente no detalhe do pedido (suporta múltiplos)
  const handleAssetsLinked = useCallback(async (itemId: string, assetIds: string[]) => {
    try {
      const validIds = assetIds.filter(id => !!id);

      // Clear existing junction rows for this item
      await supabase.from('pedido_item_assets').delete().eq('pedido_item_id', itemId);

      if (validIds.length > 0) {
        // Set first asset as workshop_item_id for backwards compat
        await supabase.from('pedido_itens').update({ workshop_item_id: validIds[0] }).eq('id', itemId);

        // Insert junction rows
        const rows = validIds.map(wsId => ({ pedido_item_id: itemId, workshop_item_id: wsId }));
        await supabase.from('pedido_item_assets').insert(rows);

        // Update asset_codes for quick reference
        const { data: wsItems } = await supabase.from('workshop_items').select('id, unique_code').in('id', validIds);
        if (wsItems) {
          const codes = wsItems.map(w => w.unique_code);
          await supabase.from('pedido_itens').update({ asset_codes: codes }).eq('id', itemId);
        }

        // Update local state
        const junctionData = (wsItems || []).map(w => ({
          id: crypto.randomUUID(),
          pedido_item_id: itemId,
          workshop_item_id: w.id,
          created_at: new Date().toISOString(),
          workshop_items: { id: w.id, unique_code: w.unique_code },
        }));

        setViewingPedido((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            pedido_itens: prev.pedido_itens?.map((it: any) =>
              it.id === itemId
                ? { ...it, workshop_item_id: validIds[0], workshop_item: wsItems?.[0] || null, pedido_item_assets: junctionData }
                : it
            ),
          };
        });
      } else {
        // Clear all
        await supabase.from('pedido_itens').update({ workshop_item_id: null, asset_codes: [] }).eq('id', itemId);
        setViewingPedido((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            pedido_itens: prev.pedido_itens?.map((it: any) =>
              it.id === itemId
                ? { ...it, workshop_item_id: null, workshop_item: null, pedido_item_assets: [] }
                : it
            ),
          };
        });
      }

      setEditingAssetItemId(null);
      toast({ title: 'Ativos vinculados com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao vincular ativos', description: err.message });
    }
  }, [toast, queryClient]);

  return (
    <div className="space-y-6 animate-fade-in w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Pedidos de Peças</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={open} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
            <Button className="bg-success hover:bg-success/90 text-success-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Novo pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {showConfirmation && !editingPedido ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Confirmar Rascunho
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Tipo de solicitação */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {form.tipo_solicitacao === 'coleta_reversa' ? 'Coleta Reversa' : 'Envio'}
                    </Badge>
                    {geraColetaReversaAtivo && (
                      <Badge variant="outline">Gera coleta reversa automática</Badge>
                    )}
                  </div>

                  {/* Responsáveis e tipo de coleta */}
                  {(form.tipo_solicitacao === 'envio' && form.tipo_envio) || (form.tipo_solicitacao === 'coleta_reversa' && form.tipo_coleta) ? (
                    <div className="text-sm space-y-1 p-3 rounded-md border bg-muted/30">
                      {form.tipo_solicitacao === 'envio' && form.tipo_envio && (
                        <p className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Tipo de envio</span>
                          <span className="font-medium truncate min-w-0">{tipoEnvioReviewLabels[form.tipo_envio] || form.tipo_envio}</span>
                        </p>
                      )}
                      {form.tipo_solicitacao === 'envio' && form.tipo_envio === 'envio_pelo_tecnico' && (
                        <p className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Técnico responsável</span>
                          <span className="font-medium truncate min-w-0">{getUserName(form.tecnico_responsavel_user_id)}</span>
                        </p>
                      )}
                      {form.tipo_solicitacao === 'coleta_reversa' && form.tipo_coleta && (
                        <p className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Tipo de coleta</span>
                          <span className="font-medium truncate min-w-0">{tipoColetaLabels[form.tipo_coleta] || form.tipo_coleta}</span>
                        </p>
                      )}
                      {form.tipo_solicitacao === 'coleta_reversa' && form.tipo_coleta === 'coleta_tecnico_csm' && form.coleta_responsavel_tipo === 'tecnico' && (
                        <p className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Técnico responsável</span>
                          <span className="font-medium truncate min-w-0">{getUserName(form.tecnico_responsavel_user_id)}</span>
                        </p>
                      )}
                      {form.tipo_solicitacao === 'coleta_reversa' && form.tipo_coleta === 'coleta_tecnico_csm' && form.coleta_responsavel_tipo === 'csm' && (
                        <p className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">CSM responsável</span>
                          <span className="font-medium truncate min-w-0">{getUserName(form.csm_responsavel_user_id)}</span>
                        </p>
                      )}
                      {geraColetaReversaAtivo && form.coleta_auto_tipo && (
                        <p className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Coleta reversa automática</span>
                          <span className="font-medium truncate min-w-0">
                            {tipoColetaLabels[form.coleta_auto_tipo] || form.coleta_auto_tipo}
                            {form.coleta_auto_tipo === 'coleta_tecnico_csm' && (
                              form.coleta_auto_responsavel_tipo === 'tecnico' ? ` — ${getUserName(form.coleta_auto_tecnico_id)}`
                              : form.coleta_auto_responsavel_tipo === 'csm' ? ` — ${getUserName(form.coleta_auto_csm_id)}`
                              : ''
                            )}
                          </span>
                        </p>
                      )}
                    </div>
                  ) : null}

                  {/* Cliente destaque */}
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                    <p className="font-semibold text-lg">
                      {clientes?.find(c => c.id === form.cliente_id)?.nome}
                    </p>
                    {clientes?.find(c => c.id === form.cliente_id)?.fazenda && (
                      <p className="text-muted-foreground">
                        {clientes?.find(c => c.id === form.cliente_id)?.fazenda}
                      </p>
                    )}
                  </div>

                  {/* Motivo / volumes / ativos */}
                  <div className="text-sm space-y-2 p-3 rounded-md border bg-muted/30">
                    <div>
                      <p className="text-muted-foreground text-xs">Motivo da solicitação e relato da fazenda</p>
                      <p className="whitespace-pre-wrap break-words">{form.motivo_relato}</p>
                    </div>
                    {form.tipo_solicitacao === 'coleta_reversa' && form.quantidade_volumes !== '' && (
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Quantidade de volumes</span>
                        <span className="font-medium">{form.quantidade_volumes}</span>
                      </p>
                    )}
                    {geraColetaReversaAtivo && form.coleta_auto_volumes !== '' && (
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Volumes (coleta reversa automática)</span>
                        <span className="font-medium">{form.coleta_auto_volumes}</span>
                      </p>
                    )}
                    {requiresAssetsOnCreate && assetItens.map(({ index, peca }) => (
                      <p key={index} className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Ativos — {peca?.codigo}</span>
                        <span className="font-medium">
                          {(itemAssets[index] || []).filter(Boolean).length} vinculado(s)
                        </span>
                      </p>
                    ))}
                  </div>



                  {/* Itens do pedido */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Itens do Pedido ({itens.length})</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {itens.map((item, index) => {
                        const peca = pecas?.find(p => p.id === item.peca_id);
                        return (
                          <div key={index} className="p-2 rounded border bg-muted/30 flex gap-3">
                            {peca?.imagem_url ? (
                              <button
                                type="button"
                                onClick={() => setImagePreview({ url: peca.imagem_url!, nome: peca.nome })}
                                className="shrink-0 hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={peca.imagem_url}
                                  alt={peca.nome}
                                  className="h-12 w-12 object-cover rounded"
                                />
                              </button>
                            ) : (
                              <div className="h-12 w-12 flex items-center justify-center bg-muted rounded shrink-0">
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{peca?.codigo}</span>
                                <Badge variant="secondary" className="shrink-0">
                                  x{item.quantidade}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground break-words">
                                {peca?.descricao || peca?.nome}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Observações */}
                  {form.observacoes && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Observações</p>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                        {form.observacoes}
                      </p>
                    </div>
                  )}

                  {/* Botões */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowConfirmation(false)}
                    >
                      Voltar
                    </Button>
                    <Button 
                      type="button" 
                      className="flex-1"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Salvar Rascunho
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {editingPedido ? 'Editar Pedido' : 'Novo Pedido de Peças'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={editingPedido ? (e) => { e.preventDefault(); handleSubmit(); } : handleShowConfirmation} className="space-y-4">
                  {/* Tipo de Solicitação */}
                  <div className="space-y-2">
                    <Label>Tipo de Solicitação</Label>
                    {!editingPedido && tipoSolicitacaoFilter !== 'all' ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="gap-1 px-2 py-1">
                          {tipoSolicitacaoFilter === 'envio' ? (
                            <>
                              <Truck className="h-3 w-3" />
                              Envio
                            </>
                          ) : (
                            <>
                              <Package className="h-3 w-3" />
                              Coleta Reversa
                            </>
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">definido pelo contexto atual</span>
                      </div>
                    ) : (
                    <ToggleGroup
                      type="single"
                      value={form.tipo_solicitacao}
                      onValueChange={(v) => v && setForm({
                        ...form,
                        tipo_solicitacao: v,
                        gera_coleta_reversa: v === 'envio' ? form.gera_coleta_reversa : false,
                        tipo_envio: v === 'envio' ? form.tipo_envio : '',
                        tecnico_responsavel_user_id: v === 'envio' ? form.tecnico_responsavel_user_id : '',
                        tipo_coleta: v === 'coleta_reversa' ? form.tipo_coleta : '',
                        coleta_responsavel_tipo: v === 'coleta_reversa' ? form.coleta_responsavel_tipo : '',
                      })}
                      className="justify-start"
                      disabled={!!editingPedido}
                    >
                      <ToggleGroupItem value="envio" className="text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                        <Truck className="h-3 w-3" />
                        Envio
                      </ToggleGroupItem>
                      <ToggleGroupItem value="coleta_reversa" className="text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                        <Package className="h-3 w-3" />
                        Coleta Reversa
                      </ToggleGroupItem>
                    </ToggleGroup>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Cliente / Fazenda</Label>
                    {form.cliente_id ? (
                      <div className="flex items-center gap-2 p-3 rounded-md border bg-primary/5">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {clientes?.find(c => c.id === form.cliente_id)?.nome}
                          </div>
                          {clientes?.find(c => c.id === form.cliente_id)?.fazenda && (
                            <div className="text-xs text-muted-foreground">
                              {clientes?.find(c => c.id === form.cliente_id)?.fazenda}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setForm({ ...form, cliente_id: '' });
                            setClienteSearch('');
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder="Digite para buscar cliente..."
                          value={clienteSearch}
                          onChange={(e) => setClienteSearch(e.target.value)}
                          className="mb-2"
                        />
                        <div className="max-h-40 overflow-y-auto border rounded-md bg-background">
                          {clientes
                            ?.filter(c => {
                              const search = clienteSearch.toLowerCase();
                              return c.nome.toLowerCase().includes(search) || 
                                     (c.fazenda?.toLowerCase().includes(search) ?? false);
                            })
                            .slice(0, 20)
                            .map((cliente) => (
                              <div
                                key={cliente.id}
                                onClick={() => {
                                  setForm({ ...form, cliente_id: cliente.id });
                                }}
                                className="px-3 py-2 cursor-pointer hover:bg-muted border-b last:border-b-0"
                              >
                                <div className="font-medium text-sm">{cliente.nome}</div>
                                {cliente.fazenda && (
                                  <div className="text-xs text-muted-foreground">{cliente.fazenda}</div>
                                )}
                              </div>
                            ))}
                          {clientes?.filter(c => {
                            const search = clienteSearch.toLowerCase();
                            return c.nome.toLowerCase().includes(search) || 
                                   (c.fazenda?.toLowerCase().includes(search) ?? false);
                          }).length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              Nenhum cliente encontrado
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Peças ({itens.length})</Label>
                      <Button type="button" size="sm" onClick={addItem} className="bg-green-600 hover:bg-green-700 text-white">
                        <Plus className="mr-1 h-3 w-3" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {itens.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Clique em "Adicionar" para incluir peças ao pedido
                        </p>
                      )}
                      {itens.map((item, index) => {
                        const selectedPecaIds = itens.map(i => i.peca_id).filter(id => id !== item.peca_id);
                        const availablePecas = pecas?.filter(p => !selectedPecaIds.includes(p.id)) || [];
                        const selectedPeca = pecas?.find(p => p.id === item.peca_id);
                        const triggerIdLocal = findPecaIdByCodigo(AUTO_LINK_TRIGGER_CODE);
                        const targetIdLocal = findPecaIdByCodigo(AUTO_LINK_TARGET_CODE);
                        const hasTriggerInList = !!triggerIdLocal && itens.some(i => i.peca_id === triggerIdLocal);
                        const isAutoLinked = !!targetIdLocal && item.peca_id === targetIdLocal && hasTriggerInList;

                        return (
                          <div key={index} className="p-2 rounded-lg border bg-muted/30 space-y-2">
                            {selectedPeca ? (
                              <div className="flex items-center gap-3 p-2 rounded-md border bg-primary/5">
                                {selectedPeca.imagem_url ? (
                                  <button
                                    type="button"
                                    onClick={() => setImagePreview({ url: selectedPeca.imagem_url!, nome: selectedPeca.nome })}
                                    className="shrink-0 hover:opacity-80 transition-opacity"
                                  >
                                    <img
                                      src={selectedPeca.imagem_url}
                                      alt={selectedPeca.nome}
                                      className="h-12 w-12 object-cover rounded"
                                    />
                                  </button>
                                ) : (
                                  <div className="h-12 w-12 flex items-center justify-center bg-muted rounded shrink-0">
                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{selectedPeca.codigo}</div>
                                  <div className="text-xs text-muted-foreground break-words">
                                    {selectedPeca.descricao || selectedPeca.nome}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0"
                                  onClick={() => {
                                    updateItem(index, 'peca_id', '');
                                    setPecaSearches({ ...pecaSearches, [index]: '' });
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Input
                                  placeholder="Buscar peça por código ou nome..."
                                  value={pecaSearches[index] || ''}
                                  onChange={(e) => setPecaSearches({ ...pecaSearches, [index]: e.target.value })}
                                  autoFocus
                                />
                                <div className="max-h-40 overflow-y-auto border rounded-md bg-background">
                                  {availablePecas
                                    .filter(p => {
                                      const searchTerms = (pecaSearches[index] || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
                                      if (searchTerms.length === 0) return true;
                                      const searchableText = `${p.codigo} ${p.nome} ${p.descricao || ''}`.toLowerCase();
                                      return searchTerms.every(term => searchableText.includes(term));
                                    })
                                    .slice(0, 15)
                                    .map((peca) => (
                                      <div
                                        key={peca.id}
                                        onClick={() => {
                                          updateItem(index, 'peca_id', peca.id);
                                        }}
                                        className="px-3 py-2 cursor-pointer hover:bg-muted border-b last:border-b-0 text-sm flex items-center gap-2"
                                      >
                                        {peca.imagem_url ? (
                                          <img
                                            src={peca.imagem_url}
                                            alt={peca.nome}
                                            className="h-8 w-8 object-cover rounded shrink-0"
                                          />
                                        ) : (
                                          <div className="h-8 w-8 flex items-center justify-center bg-muted rounded shrink-0">
                                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <span className="font-medium">{peca.codigo}</span>
                                          <span className="text-muted-foreground ml-1 break-words">- {peca.descricao || peca.nome}</span>
                                        </div>
                                      </div>
                                    ))}
                                  {availablePecas.filter(p => {
                                    const searchTerms = (pecaSearches[index] || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
                                    if (searchTerms.length === 0) return true;
                                    const searchableText = `${p.codigo} ${p.nome} ${p.descricao || ''}`.toLowerCase();
                                    return searchTerms.every(term => searchableText.includes(term));
                                  }).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      Nenhuma peça encontrada
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => decrementQuantity(index)}
                                  disabled={item.quantidade <= 1}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <div className="min-w-14 h-9 flex items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-lg px-3">
                                  {item.quantidade}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => incrementQuantity(index)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                {isAutoLinked && (
                                  <span className="ml-2 text-[11px] text-muted-foreground">
                                    Vinculado ao PRD00605 (×3)
                                  </span>
                                )}
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-destructive hover:text-destructive"
                                onClick={() => removeItem(index)}
                              >

                                <Trash2 className="h-4 w-4 mr-1" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Modelo da Solenóide (PRD00605) */}
                  {hasSolenoide && (
                    <div className="space-y-2">
                      <Label>Modelo <span className="text-destructive">*</span></Label>
                      <ToggleGroup
                        type="single"
                        value={form.solenoide_modelo}
                        onValueChange={(v) => v && setForm({ ...form, solenoide_modelo: v })}
                        className="justify-start"
                      >
                        <ToggleGroupItem value="2x" className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Modelo 2x</ToggleGroupItem>
                        <ToggleGroupItem value="3x" className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Modelo 3x</ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  )}

                  {/* Urgência */}
                  <div className="space-y-2">
                    <Label>Urgência</Label>
                    <ToggleGroup 
                      type="single" 
                      value={form.urgencia} 
                      onValueChange={(v) => v && setForm({ ...form, urgencia: v })}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="baixa" className="text-xs data-[state=on]:bg-muted">Baixa</ToggleGroupItem>
                      <ToggleGroupItem value="normal" className="text-xs data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700">Normal</ToggleGroupItem>
                      <ToggleGroupItem value="alta" className="text-xs data-[state=on]:bg-orange-100 data-[state=on]:text-orange-700">Alta</ToggleGroupItem>
                      <ToggleGroupItem value="critica" className="text-xs data-[state=on]:bg-red-100 data-[state=on]:text-red-700">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Crítica
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                   {/* Tipo de Envio (apenas para pedidos do tipo Envio) */}
                  {form.tipo_solicitacao === 'envio' && (
                    <div className="space-y-2">
                      <Label>Tipo de Envio</Label>
                      <ToggleGroup
                        type="single"
                        value={form.tipo_envio}
                        onValueChange={(v) => setForm({ ...form, tipo_envio: v || '', tecnico_responsavel_user_id: v === 'envio_pelo_tecnico' ? form.tecnico_responsavel_user_id : '' })}
                        className="justify-start"
                      >
                        <ToggleGroupItem value="envio_fisico" className="text-xs gap-1">
                          <Truck className="h-3 w-3" />
                          Envio Físico
                        </ToggleGroupItem>
                        <ToggleGroupItem value="envio_pelo_tecnico" className="text-xs gap-1">
                          <User className="h-3 w-3" />
                          Envio pelo Técnico
                        </ToggleGroupItem>
                        <ToggleGroupItem value="apenas_nf" className="text-xs gap-1">
                          <FileText className="h-3 w-3" />
                          Apenas NF
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  )}

                  {/* Técnico responsável (Envio pelo Técnico) */}
                  {form.tipo_solicitacao === 'envio' && form.tipo_envio === 'envio_pelo_tecnico' && (
                    <div className="space-y-2">
                      <Label>Técnico Responsável</Label>
                      <ToggleGroup
                        type="single"
                        value={form.tecnico_responsavel_user_id}
                        onValueChange={(v) => v && setForm({ ...form, tecnico_responsavel_user_id: v })}
                        className="justify-start"
                      >
                        {tecnicosFixos.map(t => (
                          <ToggleGroupItem key={t.id} value={t.id} className="text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                            <User className="h-3 w-3" />
                            {t.nome.split(' ')[0]}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      {tecnicosFixos.length === 0 && (
                        <p className="text-xs text-muted-foreground">Nenhum Técnico de Campo encontrado (Phelipe, Roger, Lenilton).</p>
                      )}
                    </div>
                  )}

                  {/* Gera automaticamente coleta reversa? (apenas Envio) */}
                  {form.tipo_solicitacao === 'envio' && !editingPedido && coletaReversaObrigatoria && (
                    <div className="space-y-1">
                      <Label>Gera automaticamente coleta reversa?</Label>
                      <p className="text-xs text-muted-foreground">
                        Obrigatória: o pedido contém ativo controlado, então a coleta reversa é sempre gerada.
                      </p>
                    </div>
                  )}

                  {form.tipo_solicitacao === 'envio' && !editingPedido && !coletaReversaObrigatoria && (
                    <div className="space-y-2">
                      <Label>Gera automaticamente coleta reversa?</Label>
                      <ToggleGroup
                        type="single"
                        value={form.gera_coleta_reversa ? 'sim' : 'nao'}
                        onValueChange={(v) => v && setForm({ ...form, gera_coleta_reversa: v === 'sim' })}
                        className="justify-start"
                      >
                        <ToggleGroupItem value="nao" className="text-xs data-[state=on]:bg-muted">Não</ToggleGroupItem>
                        <ToggleGroupItem value="sim" className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Sim</ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  )}

                  {/* Tipo de Coleta (apenas Coleta Reversa) */}
                  {form.tipo_solicitacao === 'coleta_reversa' && (
                    <div className="space-y-2">
                      <Label>Tipo de Coleta</Label>
                      <ToggleGroup
                        type="single"
                        value={form.tipo_coleta}
                        onValueChange={(v) => setForm({ ...form, tipo_coleta: v || '', coleta_responsavel_tipo: v === 'coleta_tecnico_csm' ? form.coleta_responsavel_tipo : '' })}
                        className="justify-start"
                      >
                        <ToggleGroupItem value="correios" className="text-xs gap-1">
                          <Truck className="h-3 w-3" />
                          Correios
                        </ToggleGroupItem>
                        <ToggleGroupItem value="coleta_tecnico_csm" className="text-xs gap-1">
                          <User className="h-3 w-3" />
                          Coleta pelo Técnico/CSM
                        </ToggleGroupItem>
                        <ToggleGroupItem value="apenas_nf" className="text-xs gap-1">
                          <FileText className="h-3 w-3" />
                          Apenas NF
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  )}

                  {/* Responsável da coleta (Técnico ou CSM) */}
                  {form.tipo_solicitacao === 'coleta_reversa' && form.tipo_coleta === 'coleta_tecnico_csm' && (
                    <ResponsavelColetaPicker
                      respTipo={form.coleta_responsavel_tipo}
                      tecnicoId={form.tecnico_responsavel_user_id}
                      csmId={form.csm_responsavel_user_id}
                      tecnicosFixos={tecnicosFixos}
                      consultores={(consultoresRplus || []).map(c => ({ id: c.user_id, nome: c.nome }))}
                      onRespTipo={(v) => setForm({ ...form, coleta_responsavel_tipo: v, tecnico_responsavel_user_id: v === 'tecnico' ? form.tecnico_responsavel_user_id : '', csm_responsavel_user_id: v === 'csm' ? form.csm_responsavel_user_id : '' })}
                      onTecnico={(id) => setForm({ ...form, tecnico_responsavel_user_id: id, csm_responsavel_user_id: '' })}
                      onCsm={(id) => setForm({ ...form, csm_responsavel_user_id: id, tecnico_responsavel_user_id: '' })}
                    />
                  )}

                  {/* Tipo de Coleta da coleta reversa automática (Envio + geração automática) */}
                  {geraColetaReversaAtivo && !editingPedido && (
                    <div className="space-y-2">
                      <Label>Tipo de Coleta <span className="text-muted-foreground font-normal">(coleta reversa automática)</span></Label>
                      <ToggleGroup
                        type="single"
                        value={form.coleta_auto_tipo}
                        onValueChange={(v) => setForm({ ...form, coleta_auto_tipo: v || '', coleta_auto_responsavel_tipo: v === 'coleta_tecnico_csm' ? form.coleta_auto_responsavel_tipo : '' })}
                        className="justify-start"
                      >
                        <ToggleGroupItem value="correios" className="text-xs gap-1">
                          <Truck className="h-3 w-3" />
                          Correios
                        </ToggleGroupItem>
                        <ToggleGroupItem value="coleta_tecnico_csm" className="text-xs gap-1">
                          <User className="h-3 w-3" />
                          Coleta pelo Técnico/CSM
                        </ToggleGroupItem>
                        <ToggleGroupItem value="apenas_nf" className="text-xs gap-1">
                          <FileText className="h-3 w-3" />
                          Apenas NF
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  )}
                  {geraColetaReversaAtivo && !editingPedido && form.coleta_auto_tipo === 'coleta_tecnico_csm' && (
                    <ResponsavelColetaPicker
                      respTipo={form.coleta_auto_responsavel_tipo}
                      tecnicoId={form.coleta_auto_tecnico_id}
                      csmId={form.coleta_auto_csm_id}
                      tecnicosFixos={tecnicosFixos}
                      consultores={(consultoresRplus || []).map(c => ({ id: c.user_id, nome: c.nome }))}
                      onRespTipo={(v) => setForm({ ...form, coleta_auto_responsavel_tipo: v, coleta_auto_tecnico_id: v === 'tecnico' ? form.coleta_auto_tecnico_id : '', coleta_auto_csm_id: v === 'csm' ? form.coleta_auto_csm_id : '' })}
                      onTecnico={(id) => setForm({ ...form, coleta_auto_tecnico_id: id, coleta_auto_csm_id: '' })}
                      onCsm={(id) => setForm({ ...form, coleta_auto_csm_id: id, coleta_auto_tecnico_id: '' })}
                    />
                  )}

                  {/* Motivo da solicitação (obrigatório em ambos os tipos) */}
                  <div className="space-y-2">
                    <Label>Motivo da solicitação e relato da fazenda: <span className="text-destructive">*</span></Label>
                    <Textarea
                      placeholder="Descreva o motivo da solicitação e o relato da fazenda..."
                      value={form.motivo_relato}
                      onChange={(e) => setForm({ ...form, motivo_relato: e.target.value })}
                      rows={3}
                    />
                  </div>

                  {/* Quantidade de Volumes (Coleta Reversa) */}
                  {form.tipo_solicitacao === 'coleta_reversa' && (
                    <div className="space-y-2">
                      <Label>Quantidade de Volumes: <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="1"
                        value={form.quantidade_volumes}
                        onChange={(e) => setForm({ ...form, quantidade_volumes: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Quantidade de Volumes da coleta reversa automática */}
                  {geraColetaReversaAtivo && !editingPedido && (
                    <div className="space-y-2">
                      <Label>Quantidade de Volumes: <span className="text-muted-foreground font-normal">(coleta reversa automática)</span> <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="1"
                        value={form.coleta_auto_volumes}
                        onChange={(e) => setForm({ ...form, coleta_auto_volumes: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Ativos a coletar (qualquer tipo com peças que exigem ativo) */}
                  {requiresAssetsOnCreate && (
                    <div className="space-y-2">
                      <Label>Ativos a coletar <span className="text-destructive">*</span></Label>
                      {assetItens.map(({ index, item, peca }) => (
                        <MultiAssetField
                          key={`${index}-${item.peca_id}`}
                          pecaId={item.peca_id}
                          pecaNome={`${peca?.codigo || ''} — ${peca?.nome || ''}`}
                          quantidade={item.quantidade}
                          selectedAssets={itemAssets[index] || []}
                          onAssetsChange={(assets) => setItemAssets((prev) => ({ ...prev, [index]: assets }))}
                        />
                      ))}
                    </div>
                  )}


                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      placeholder="Observações adicionais..."
                      value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                      rows={2}
                    />
                  </div>

                  {/* Total de itens */}
                  {itens.length > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="font-bold text-lg">
                        {itens.filter(i => i.peca_id).length} {itens.filter(i => i.peca_id).length === 1 ? 'peça' : 'peças'}, {itens.reduce((sum, item) => sum + item.quantidade, 0)} {itens.reduce((sum, item) => sum + item.quantidade, 0) === 1 ? 'unidade' : 'unidades'}
                      </span>
                    </div>
                  )}

                  {/* Buttons - Delete and Save when editing draft */}
                  <div className="flex gap-2">
                    {editingPedido && editingPedido.status === 'rascunho' && (
                      <Button 
                        type="button" 
                        variant="destructive" 
                        className="flex-1"
                        onClick={handleDeletePedido}
                        disabled={isDeleting || isSubmitting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </>
                        )}
                      </Button>
                    )}
                    <Button type="submit" className={editingPedido?.status === 'rascunho' ? 'flex-1' : 'w-full'} disabled={isSubmitting || isDeleting}>
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Salvar'
                      )}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Tabs for Drafts and Transmitted Orders */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'rascunhos' | 'pedidos' | 'pendentes')} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <TabsList className={cn('grid w-full sm:w-auto', showPendentesTab ? 'grid-cols-3' : 'grid-cols-2')}>
            <TabsTrigger value="rascunhos" className="gap-2">
              <FileText className="h-4 w-4" />
              <span>Rascunhos</span>
              {rascunhos.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {rascunhos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-2">
              <Send className="h-4 w-4" />
              <span>Transmitidos</span>
            </TabsTrigger>
            {showPendentesTab && (
              <TabsTrigger value="pendentes" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Pendentes</span>
                {pendenciasVisiveis.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {pendenciasVisiveis.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>
          
          {activeTab === 'rascunhos' && rascunhos.length > 0 && (
            <Button 
              onClick={handleTransmitirTodos}
              disabled={isTransmitting}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              {isTransmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Transmitir Todos ({rascunhos.length})
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente, fazenda, código ou nome da peça..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {activeTab === 'pedidos' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="solicitado">Solicitado</SelectItem>
                    <SelectItem value="processamento">Em Processamento</SelectItem>
                    <SelectItem value="faturado">Faturado</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all' || tipoEnvioFilter !== 'all' || tipoLogisticaFilter !== 'all' || tipoSolicitacaoFilter !== 'all' || solicitanteFilter !== 'all') && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Date quick filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Período:</span>
              <div className="flex gap-1">
                <Button
                  variant={dateFilter === '30' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter(dateFilter === '30' ? 'all' : '30')}
                  className="h-7 text-xs"
                >
                  30 dias
                </Button>
                <Button
                  variant={dateFilter === 'all' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('all')}
                  className="h-7 text-xs"
                >
                  Todos
                </Button>
              </div>
              
              {/* Tipo envio filter */}
              {activeTab === 'pedidos' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Envio:</span>
                  <div className="flex gap-1">
                    <Button
                      variant={tipoEnvioFilter === 'all' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setTipoEnvioFilter('all')}
                      className="h-7 text-xs"
                    >
                      Todos
                    </Button>
                    <Button
                      variant={tipoEnvioFilter === 'envio' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoEnvioFilter(tipoEnvioFilter === 'envio' ? 'all' : 'envio')}
                      className="h-7 text-xs gap-1"
                    >
                      <Truck className="h-3 w-3" />
                      Envio Físico
                    </Button>
                    <Button
                      variant={tipoEnvioFilter === 'envio_pelo_tecnico' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoEnvioFilter(tipoEnvioFilter === 'envio_pelo_tecnico' ? 'all' : 'envio_pelo_tecnico')}
                      className="h-7 text-xs gap-1"
                    >
                      <User className="h-3 w-3" />
                      Envio pelo Técnico
                    </Button>
                    <Button
                      variant={tipoEnvioFilter === 'apenas_nf' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoEnvioFilter(tipoEnvioFilter === 'apenas_nf' ? 'all' : 'apenas_nf')}
                      className="h-7 text-xs gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Apenas NF
                    </Button>
                  </div>
                </div>
              )}

              {/* Tipo logistica filter */}
              {activeTab === 'pedidos' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Logística:</span>
                  <div className="flex gap-1">
                    <Button
                      variant={tipoLogisticaFilter === 'all' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setTipoLogisticaFilter('all')}
                      className="h-7 text-xs"
                    >
                      Todos
                    </Button>
                    <Button
                      variant={tipoLogisticaFilter === 'correios' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoLogisticaFilter(tipoLogisticaFilter === 'correios' ? 'all' : 'correios')}
                      className="h-7 text-xs gap-1"
                    >
                      <Truck className="h-3 w-3" />
                      Correios
                    </Button>
                    <Button
                      variant={tipoLogisticaFilter === 'entrega_propria' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoLogisticaFilter(tipoLogisticaFilter === 'entrega_propria' ? 'all' : 'entrega_propria')}
                      className="h-7 text-xs gap-1"
                    >
                      <HandHelping className="h-3 w-3" />
                      Entrega Própria
                    </Button>
                  </div>
                </div>
              )}

              {/* Tipo solicitacao filter */}
              {activeTab === 'pedidos' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Solicitação:</span>
                  <div className="flex gap-1">
                    <Button
                      variant={tipoSolicitacaoFilter === 'all' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setTipoSolicitacaoFilter('all')}
                      className="h-7 text-xs"
                    >
                      Todos
                    </Button>
                    <Button
                      variant={tipoSolicitacaoFilter === 'envio' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoSolicitacaoFilter(tipoSolicitacaoFilter === 'envio' ? 'all' : 'envio')}
                      className="h-7 text-xs gap-1"
                    >
                      <Truck className="h-3 w-3" />
                      Envios
                    </Button>
                    <Button
                      variant={tipoSolicitacaoFilter === 'coleta_reversa' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoSolicitacaoFilter(tipoSolicitacaoFilter === 'coleta_reversa' ? 'all' : 'coleta_reversa')}
                      className="h-7 text-xs gap-1"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      Coleta Reversa
                    </Button>
                  </div>
                </div>
              )}

              {/* Visibilidade (filtro apenas de UI) - disponível para todos os papéis */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Visualizar:</span>
                <div className="flex gap-1">
                  <Button
                    variant={viewAll ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewAll(true)}
                    className="h-7 text-xs"
                  >
                    Todos os pedidos
                  </Button>
                  <Button
                    variant={!viewAll ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewAll(false)}
                    className="h-7 text-xs"
                  >
                    Apenas os meus
                  </Button>
                </div>
              </div>

              {/* Responsabilidade (técnico/CSM responsável - filtro apenas de UI) */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Responsabilidade:</span>
                <div className="flex gap-1">
                  <Button
                    variant={responsavelFilter === 'todos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setResponsavelFilter('todos')}
                    className="h-7 text-xs"
                  >
                    Todos
                  </Button>
                  <Button
                    variant={responsavelFilter === 'meus' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setResponsavelFilter('meus')}
                    className="h-7 text-xs"
                  >
                    Sob minha responsabilidade
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Situação:</span>
                <div className="flex gap-1">
                  {(['pendentes', 'concluidos', 'todos'] as const).map(opt => (
                    <Button
                      key={opt}
                      variant={situacaoFilter === opt ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSituacaoFilter(opt)}
                      className="h-7 text-xs"
                    >
                      {opt === 'pendentes' ? 'Pendentes' : opt === 'concluidos' ? 'Concluídos' : 'Todos'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Solicitante filter - visível para todos os papéis */}
              {solicitantesUnicos.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Solicitante:</span>
                  <Select value={solicitanteFilter} onValueChange={setSolicitanteFilter}>
                    <SelectTrigger className="h-7 w-[180px] text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {solicitantesUnicos.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}


              {filteredAndSortedPedidos.length > 0 && (
                <Badge variant="outline" className="ml-2 h-6 px-2">
                  {filteredAndSortedPedidos.length} {filteredAndSortedPedidos.length === 1 ? 'pedido' : 'pedidos'}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pedidos?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Nenhum pedido criado</h3>
            <p className="text-muted-foreground">Clique em "Novo Pedido" para solicitar peças.</p>
          </CardContent>
        </Card>
      ) : activeTab === 'pendentes' ? (
        /* Pendentes (coletas reversas aguardando ação do responsável) */
        filteredAndSortedPedidos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-semibold">Nenhuma pendência</h3>
              <p className="text-muted-foreground">Não há coletas reversas aguardando sua ação.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {paginatedPedidos.map((pedido) => (
              <Card key={pedido.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {pedido.pedido_code && (
                          <span className="font-mono text-xs text-muted-foreground">{pedido.pedido_code}</span>
                        )}
                        <Badge variant="outline" className={cn(statusColors[pedido.status], 'text-xs')}>
                          {statusLabels[pedido.status]}
                        </Badge>
                        {(pedido as any).tipo_coleta && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <RefreshCcw className="h-3 w-3" />
                            {tipoColetaLabels[(pedido as any).tipo_coleta] || (pedido as any).tipo_coleta}
                          </Badge>
                        )}
                        {pedido.urgencia === 'urgente' && (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Urgente
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium mt-2 break-words">{pedido.clientes?.nome}</h3>
                      {pedido.clientes?.fazenda && (
                        <p className="text-sm text-muted-foreground break-words">{pedido.clientes.fazenda}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {(pedido.pedido_itens?.filter((i: any) => !i.cancelled_at)?.length || 0)} {(pedido.pedido_itens?.filter((i: any) => !i.cancelled_at)?.length || 0) === 1 ? 'item' : 'itens'} · {format(new Date(pedido.created_at), "dd/MM/yy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(canManagePedidos || isResponsavelPendencia(pedido)) && (
                        <Button size="sm" className="h-8 gap-1.5" onClick={() => setPendenciaPedido(pedido)}>
                          <ArrowRight className="h-4 w-4" />
                          Processar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setViewingPedido(pedido)}>
                        <Eye className="h-4 w-4" />
                        Detalhes
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )
      ) : activeTab === 'pedidos' ? (
        /* Transmitidos */
        pedidosTransmitidos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Send className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-semibold">Nenhum pedido transmitido</h3>
              <p className="text-muted-foreground">Transmita um rascunho para começar.</p>
            </CardContent>
          </Card>
        ) : canManagePedidos ? (
          <PedidoKanban
            pedidos={filteredAndSortedPedidos}
            onViewPedido={setViewingPedido}
            onProcessar={handleProcessar}
            onConcluir={handleConcluir}
            isProcessing={isProcessingAction}
            consultorNames={consultorNames}
            currentUserId={user?.id}
            canManage={canManagePedidos}
            canDeleteAny={canDeleteAnyPedido}
            onEdit={handleEditPedido}
            onDelete={(p) => setPedidoToDelete(p)}
            onProcessarPendencia={handleProcessarPendencia}
            isResponsavelPendencia={isResponsavelPendencia}
            showPendenteColumn={showPendentesTab}
          />
        ) : (
          /* Tabela somente leitura para perfis sem permissão de gestão */
          <div className="space-y-3">
            {paginatedPedidos.map((pedido) => (
              <Card key={pedido.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {pedido.pedido_code && (
                          <span className="font-mono text-xs text-muted-foreground">{pedido.pedido_code}</span>
                        )}
                        <Badge variant="outline" className={cn(statusColors[pedido.status], 'text-xs')}>
                          {statusLabels[pedido.status]}
                        </Badge>
                        {pedido.tipo_envio === 'apenas_nf' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <FileText className="h-3 w-3" />
                            Apenas NF
                          </Badge>
                        )}
                        {pedido.tipo_envio === 'envio_pelo_tecnico' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <User className="h-3 w-3" />
                            Envio pelo Técnico
                          </Badge>
                        )}
                        {pedido.tipo_envio === 'envio_fisico' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Truck className="h-3 w-3" />
                            Envio Físico
                          </Badge>
                        )}
                        {pedido.tipo_logistica === 'correios' && (
                          <Badge variant="outline" className="text-xs gap-1 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-0">
                            <Truck className="h-3 w-3" />
                            Correios
                          </Badge>
                        )}
                        {pedido.tipo_logistica === 'entrega_propria' && (
                          <Badge variant="outline" className="text-xs gap-1 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-0">
                            <HandHelping className="h-3 w-3" />
                            Entrega Própria
                          </Badge>
                        )}
                        {pedido.urgencia === 'urgente' && (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Urgente
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium mt-2 break-words">{pedido.clientes?.nome}</h3>
                      {pedido.clientes?.fazenda && (
                        <p className="text-sm text-muted-foreground break-words">{pedido.clientes.fazenda}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {(pedido.pedido_itens?.filter((i: any) => !i.cancelled_at)?.length || 0)} {(pedido.pedido_itens?.filter((i: any) => !i.cancelled_at)?.length || 0) === 1 ? 'item' : 'itens'} · {format(new Date(pedido.created_at), "dd/MM/yy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(pedido.status === 'solicitado'
                        ? (pedido.solicitante_id === user?.id || canDeleteAnyPedido)
                        : canDeleteAnyPedido) && (
                        <>
                          {pedido.status === 'solicitado' && (pedido.solicitante_id === user?.id || canManagePedidos) && (
                            <Button
                              variant="outline" size="icon" className="h-8 w-8"
                              onClick={() => handleEditPedido(pedido)}
                              title="Editar pedido"
                              aria-label="Editar pedido"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline" size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setPedidoToDelete(pedido)}
                            title="Excluir pedido"
                            aria-label="Excluir pedido"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {pedido.status === 'pendente' && isResponsavelPendencia(pedido) && (
                        <Button size="sm" className="h-8 gap-1.5" onClick={() => setPendenciaPedido(pedido)}>
                          <ArrowRight className="h-4 w-4" />
                          Processar
                        </Button>
                      )}
                       <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setViewingPedido(pedido)}>
                         <Eye className="h-4 w-4" />
                         Detalhes
                       </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )
      ) : filteredAndSortedPedidos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Nenhum rascunho encontrado</h3>
          </CardContent>
        </Card>
      ) : (
        /* Rascunhos - keep card list */
        <div className="space-y-3">
          {filteredAndSortedPedidos.map((pedido) => (
            <Card key={pedido.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn(statusColors[pedido.status], 'text-xs')}>
                        {statusLabels[pedido.status]}
                      </Badge>
                    </div>
                    <h3 className="font-medium mt-2 break-words">{pedido.clientes?.nome}</h3>
                    {pedido.clientes?.fazenda && (
                      <p className="text-sm text-muted-foreground break-words">{pedido.clientes.fazenda}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleEditPedido(pedido)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-success hover:bg-success/90 text-success-foreground h-9 gap-1"
                      onClick={() => handleTransmitir(pedido.id)}
                      disabled={isTransmitting}
                    >
                      {isTransmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span className="hidden sm:inline">Transmitir</span>
                    </Button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t text-sm space-y-1.5">
                  {(pedido as any).solicitante?.nome && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="truncate">Criado por {(pedido as any).solicitante.nome}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{format(new Date(pedido.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setViewingPedido(pedido)}>
                      <Eye className="h-4 w-4" />
                      Detalhes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </Tabs>

      {/* View Order Dialog (Read-Only) */}
      <Dialog open={!!viewingPedido} onOpenChange={(open) => { if (!open) { setViewingPedido(null); setIsEditingSolicitado(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingStack.length > 1 ? (
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 -ml-2" onClick={popPedido}>
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              ) : (
                <Eye className="h-5 w-5" />
              )}
              {isEditingSolicitado ? 'Editar Pedido' : 'Detalhes do Pedido'}
              {viewingPedido?.pedido_code && (
                <span className="font-mono text-sm font-normal text-muted-foreground">{viewingPedido.pedido_code}</span>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEditingSolicitado ? 'Editar itens do pedido' : 'Visualizar detalhes do pedido'}
            </DialogDescription>
          </DialogHeader>
          
          {viewingPedido && isEditingSolicitado ? (
            <EditarPedidoSolicitado
              pedido={viewingPedido}
              onSaved={(updated) => {
                setViewingPedido(updated);
                setIsEditingSolicitado(false);
                queryClient.invalidateQueries({ queryKey: ['pedidos'] });
              }}
              onCancel={() => setIsEditingSolicitado(false)}
            />
          ) : viewingPedido && (
            <div className="space-y-4">
              {/* Status Badge + Edit Button */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={cn(statusColors[viewingPedido.status], 'text-sm')}>
                  {statusLabels[viewingPedido.status]}
                </Badge>
                {canManagePedidos && viewingPedido.status === 'solicitado' && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setIsEditingSolicitado(true)}>
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                )}
              </div>

              {/* Cliente Info */}
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-semibold">{viewingPedido.clientes?.nome}</p>
                {viewingPedido.clientes?.fazenda && (
                  <p className="text-sm text-muted-foreground">{viewingPedido.clientes.fazenda}</p>
                )}
              </div>

              {/* Modelo do Solenoide */}
              {(viewingPedido as any).solenoide_modelo && (
                <div className="p-3 rounded-lg bg-muted/50 border flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Modelo do Solenoide</span>
                  <Badge variant="secondary" className="font-mono">
                    {(viewingPedido as any).solenoide_modelo}
                  </Badge>
                </div>
              )}

              {/* Data */}
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Criado em: </span>
                  <span className="font-medium">
                    {format(new Date(viewingPedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>

              {/* Itens */}
              <div className="space-y-2">
                <Label>Itens do Pedido</Label>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {viewingPedido.pedido_itens?.map((item: any) => {
                    const peca = pecas?.find(p => p.id === item.peca_id) || item.pecas;
                    const isCancelled = !!item.cancelled_at;
                    return (
                      <div
                        key={item.id}
                        className={cn("flex items-center gap-3 p-3 rounded-lg border bg-card", isCancelled && "opacity-50")}
                      >
                        {/* Imagem da peça */}
                        <div 
                          className={cn(
                            "w-14 h-14 rounded-lg border flex items-center justify-center bg-muted shrink-0",
                            peca?.imagem_url && "cursor-pointer hover:ring-2 ring-primary"
                          )}
                          onClick={() => {
                            if (peca?.imagem_url) {
                              setImagePreview({ url: peca.imagem_url, nome: peca.nome });
                            }
                          }}
                        >
                          {peca?.imagem_url ? (
                            <img
                              src={peca.imagem_url}
                              alt={peca?.nome}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("font-mono text-sm font-medium", isCancelled && "line-through")}>{peca?.codigo}</span>
                            {peca?.familia && (
                              <Badge variant="secondary" className="text-[10px] h-5">{peca.familia}</Badge>
                            )}
                            {isCancelled && (
                              <Badge variant="outline" className="text-[10px] h-5 text-destructive border-destructive/30">Cancelado</Badge>
                            )}
                          </div>
                          <p className={cn("text-sm text-muted-foreground break-words whitespace-normal", isCancelled && "line-through")}>{peca?.nome}</p>
                          {(() => {
                            const isEditable = ['solicitado', 'processamento'].includes(viewingPedido.status);
                            const isEditingThis = editingAssetItemId === item.id;
                            const linkedAssets = item.pedido_item_assets || [];
                            const hasLinkedAssets = linkedAssets.length > 0 || item.workshop_item?.unique_code;

                            // Build current asset IDs array from junction or legacy field
                            const currentAssetIds = linkedAssets.length > 0
                              ? linkedAssets.map((a: any) => a.workshop_item_id).filter(Boolean)
                              : item.workshop_item_id ? [item.workshop_item_id] : [];
                            
                            if (hasLinkedAssets) {
                              const assetCodes = linkedAssets.length > 0
                                ? linkedAssets.map((a: any) => a.workshop_items?.unique_code).filter(Boolean)
                                : [item.workshop_item?.unique_code].filter(Boolean);
                              return (
                                <div className="mt-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {assetCodes.map((code: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-[10px] h-5 font-mono border-primary/40 text-primary bg-primary/5">
                                        🏷️ {code}
                                      </Badge>
                                    ))}
                                    {isEditable && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => setEditingAssetItemId(isEditingThis ? null : item.id)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                  {isEditingThis && (
                                    <div className="mt-2">
                                      <MultiAssetField
                                        pecaId={item.peca_id}
                                        pecaNome={item.pecas?.nome || item.pecas?.codigo || ''}
                                        quantidade={item.quantidade}
                                        selectedAssets={currentAssetIds}
                                        onAssetsChange={(assets) => handleAssetsLinked(item.id, assets)}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            } else if (item.pecas?.is_asset) {
                              return (
                                <div className="mt-1">
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-[10px] h-5 font-mono border-destructive/40 text-destructive bg-destructive/5">
                                      ⚠️ Ativo não vinculado
                                    </Badge>
                                    {isEditable && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => setEditingAssetItemId(isEditingThis ? null : item.id)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                  {isEditingThis && (
                                    <div className="mt-2">
                                      <MultiAssetField
                                        pecaId={item.peca_id}
                                        pecaNome={item.pecas?.nome || item.pecas?.codigo || ''}
                                        quantidade={item.quantidade}
                                        selectedAssets={[]}
                                        onAssetsChange={(assets) => handleAssetsLinked(item.id, assets)}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-lg">x{item.quantidade}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Observações */}
              {viewingPedido.observacoes && (
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <p className="text-sm p-3 rounded-lg bg-muted/50 border">
                    {viewingPedido.observacoes}
                  </p>
                </div>
              )}

              {/* Total (excluding cancelled items) */}
              {(() => {
                const activeItems = viewingPedido.pedido_itens?.filter((i: any) => !i.cancelled_at) || [];
                const cancelledItems = viewingPedido.pedido_itens?.filter((i: any) => i.cancelled_at) || [];
                const totalPecas = activeItems.length;
                const totalUnidades = activeItems.reduce((sum: number, item: any) => sum + item.quantidade, 0);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="font-bold text-lg">
                        {totalPecas} {totalPecas === 1 ? 'peça' : 'peças'}, {totalUnidades} {totalUnidades === 1 ? 'unidade' : 'unidades'}
                      </span>
                    </div>
                    {cancelledItems.length > 0 && (
                      <p className="text-xs text-muted-foreground text-right">
                        + {cancelledItems.length} item(ns) cancelado(s)
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* NF Info if exists */}
              {viewingPedido.omie_nf_numero && (
                <>
                <div className="flex items-center gap-4 text-sm p-3 rounded-lg bg-success/10 border border-success/20">
                  <div>
                    <span className="text-muted-foreground">NF: </span>
                    <span className="font-medium">
                      {viewingPedido.omie_nf_numero}
                      {viewingPedido.omie_nf_numero_2 ? ` / ${viewingPedido.omie_nf_numero_2}` : ''}
                    </span>
                  </div>
                  {viewingPedido.omie_data_faturamento && (
                    <div>
                      <span className="text-muted-foreground">Faturado em: </span>
                      <span className="font-medium">
                        {format(new Date(viewingPedido.omie_data_faturamento), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-sm p-3 rounded-lg bg-muted/50 border">
                  <span className="text-muted-foreground">Código de Rastreio: </span>
                  {viewingPedido.tipo_envio === 'apenas_nf' || viewingPedido.tipo_envio === 'envio_pelo_tecnico' ? (
                    <span className="font-medium">N/A</span>
                  ) : viewingPedido.codigo_rastreio ? (
                    <span className="font-medium font-mono break-all">{viewingPedido.codigo_rastreio}</span>
                  ) : (
                    <span className="font-medium">
                      {viewingPedido.omie_data_faturamento &&
                      new Date(viewingPedido.omie_data_faturamento) >= new Date('2026-09-01T00:00:00')
                        ? 'Em separação'
                        : 'Não disponível'}
                    </span>
                  )}
                </div>
                </>
              )}

              {/* Coleta(s) reversa(s) vinculada(s) */}
              {(pedidoVinculos?.coletas?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <Label>Coleta(s) Reversa(s) vinculada(s)</Label>
                  <div className="space-y-2">
                    {pedidoVinculos!.coletas.map((coleta: any) => (
                      <button
                        key={coleta.id}
                        type="button"
                        onClick={() => pushPedido(coleta)}
                        className="w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50 border text-left hover:bg-muted transition-colors"
                      >
                        <span className="font-mono text-sm">{coleta.pedido_code || '—'}</span>
                        <Badge variant="outline" className={cn(statusColors[coleta.status], 'text-xs')}>
                          {statusLabels[coleta.status]}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Envio de origem */}
              {pedidoVinculos?.origem && (
                <div className="space-y-2">
                  <Label>Envio de origem</Label>
                  <button
                    type="button"
                    onClick={() => pushPedido(pedidoVinculos.origem)}
                    className="w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50 border text-left hover:bg-muted transition-colors"
                  >
                    <span className="font-mono text-sm">{pedidoVinculos.origem.pedido_code || '—'}</span>
                    <Badge variant="outline" className={cn(statusColors[pedidoVinculos.origem.status], 'text-xs')}>
                      {statusLabels[pedidoVinculos.origem.status]}
                    </Badge>
                  </button>
                </div>
              )}



              {/* Close button */}
              <Button variant="outline" className="w-full" onClick={() => setViewingPedido(null)}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!imagePreview} onOpenChange={(open) => !open && setImagePreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{imagePreview?.nome || 'Imagem da Peça'}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            {imagePreview?.url && (
              <img
                src={imagePreview.url}
                alt={imagePreview.nome}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete pedido (status solicitado) */}
      <AlertDialog open={!!pedidoToDelete} onOpenChange={(open) => !open && !isDeletingPedido && setPedidoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido <span className="font-mono font-semibold">{pedidoToDelete?.pedido_code || ''}</span> e todos os seus itens, vínculos e histórico serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPedido}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingPedido}
              onClick={(e) => { e.preventDefault(); handleDeletePedidoSolicitado(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingPedido ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aviso não bloqueante de possível duplicidade */}
      <AlertDialog open={!!duplicateWarning} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Possível duplicidade</AlertDialogTitle>
            <AlertDialogDescription>
              Estes itens já foram solicitados para este cliente nos últimos 7 dias:
              <span className="mt-2 block space-y-1">
                {(duplicateWarning || []).map((c) => (
                  <span key={c} className="block font-medium">• {c}</span>
                ))}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setDuplicateWarning(null);
                setShowConfirmation(true);
              }}
            >
              Continuar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProcessarPendenciaDialog
        open={!!pendenciaPedido}
        onOpenChange={(open) => !open && setPendenciaPedido(null)}
        pedido={pendenciaPedido || undefined}
        onConfirm={async (codigoRastreio, anexoFile) => {
          if (pendenciaPedido) {
            await handleProcessarPendencia(pendenciaPedido.id, codigoRastreio, anexoFile);
            setPendenciaPedido(null);
          }
        }}
      />
    </div>
  );
}
