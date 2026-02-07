import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ProductCode = 'ideagri' | 'rumiflow' | 'onfarm' | 'rumiaction' | 'insights';
export type CrmStage = 'nao_qualificado' | 'qualificado' | 'proposta' | 'negociacao' | 'ganho' | 'perdido' | 'descartado';

export const PRODUCT_LABELS: Record<ProductCode, string> = {
  ideagri: 'Ideagri',
  rumiflow: 'RumiFlow',
  onfarm: 'OnFarm',
  rumiaction: 'RumiAction',
  insights: 'RumiProcare',
};

export const PRODUCT_ORDER: ProductCode[] = ['ideagri', 'rumiflow', 'onfarm', 'rumiaction', 'insights'];

export const STAGE_LABELS: Record<CrmStage, string> = {
  nao_qualificado: 'Não Qualificado',
  qualificado: 'Qualificado',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  ganho: 'Ganho',
  perdido: 'Perdido',
  descartado: 'Descartado',
};

export const STAGE_COLORS: Record<CrmStage, string> = {
  nao_qualificado: 'bg-muted text-muted-foreground',
  qualificado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  proposta: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  negociacao: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  ganho: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  perdido: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  descartado: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export const HEALTH_COLORS: Record<string, string> = {
  verde: 'text-green-600',
  amarelo: 'text-amber-500',
  vermelho: 'text-red-600',
};

export function useCarteiraData() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'coordenador_rplus';

  const { data: clientes, isLoading: loadingClientes } = useQuery({
    queryKey: ['crm-carteira-clientes', user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado, telefone, consultor_rplus_id')
        .eq('status', 'ativo')
        .order('nome');

      if (!isAdmin && user?.id) {
        query = query.eq('consultor_rplus_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // @ts-ignore
  const { data: clientProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ['crm-carteira-products', user?.id, isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_client_products')
        .select('id, client_id, product_code, stage, stage_updated_at, owner_user_id, value_estimated, probability, loss_reason_id, loss_notes');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // @ts-ignore
  const { data: snapshots, isLoading: loadingSnapshots } = useQuery({
    queryKey: ['crm-carteira-snapshots', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_client_product_snapshots')
        .select('*');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // @ts-ignore
  const { data: actions, isLoading: loadingActions } = useQuery({
    queryKey: ['crm-carteira-actions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_actions')
        .select('id, client_id, client_product_id, title, type, status, priority, due_at, owner_user_id');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return {
    clientes: clientes || [],
    clientProducts: clientProducts || [],
    snapshots: snapshots || [],
    actions: actions || [],
    isLoading: loadingClientes || loadingProducts || loadingSnapshots || loadingActions,
    isAdmin,
  };
}

export function useCliente360Data(clientId: string | undefined) {
  // @ts-ignore
  const { data: clientProducts, isLoading: loadingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['crm-360-products', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_client_products')
        .select('*')
        .eq('client_id', clientId);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // @ts-ignore
  const { data: snapshots } = useQuery({
    queryKey: ['crm-360-snapshots', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_client_product_snapshots')
        .select('*')
        .eq('client_id', clientId);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // @ts-ignore
  const { data: metricDefs } = useQuery({
    queryKey: ['crm-metric-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_metric_definitions')
        .select('*')
        .eq('is_active', true)
        .order('priority');
      if (error) throw error;
      return data;
    },
  });

  // @ts-ignore
  const { data: actions, refetch: refetchActions } = useQuery({
    queryKey: ['crm-360-actions', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_actions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // @ts-ignore
  const { data: proposals, refetch: refetchProposals } = useQuery({
    queryKey: ['crm-360-proposals', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_proposals')
        .select('*, crm_client_products!inner(product_code, client_id)')
        .eq('crm_client_products.client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // @ts-ignore
  const { data: lossReasons } = useQuery({
    queryKey: ['crm-loss-reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_loss_reasons')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  return {
    clientProducts: clientProducts || [],
    snapshots: snapshots || [],
    metricDefs: metricDefs || [],
    actions: actions || [],
    proposals: proposals || [],
    lossReasons: lossReasons || [],
    isLoading: loadingProducts,
    refetchProducts,
    refetchActions,
    refetchProposals,
  };
}

export function usePipelineData() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'coordenador_rplus';

  // @ts-ignore
  const { data: clientProducts, isLoading } = useQuery({
    queryKey: ['crm-pipeline', user?.id, isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_client_products')
        .select('*, clientes!inner(id, nome, fazenda, cidade, estado, consultor_rplus_id, status)');
      if (error) throw error;
      // Filter active clients
      return (data || []).filter((d: any) => d.clientes?.status === 'ativo');
    },
    enabled: !!user,
  });

  // @ts-ignore
  const { data: lossReasons } = useQuery({
    queryKey: ['crm-loss-reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_loss_reasons')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  // @ts-ignore
  const { data: consultores } = useQuery({
    queryKey: ['crm-consultores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const filteredProducts = isAdmin
    ? clientProducts || []
    : (clientProducts || []).filter((p: any) => p.clientes?.consultor_rplus_id === user?.id);

  return {
    clientProducts: filteredProducts,
    lossReasons: lossReasons || [],
    consultores: consultores || [],
    isLoading,
    isAdmin,
  };
}
