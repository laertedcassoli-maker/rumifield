import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PRODUCT_LABELS, type ProductCode } from '@/hooks/useCrmData';

export type ActionStatus = 'aberta' | 'em_execucao' | 'concluida';
export type ActionType = 'tarefa' | 'pendencia' | 'oportunidade';
export type ProposalStatus = 'ativa' | 'aceita' | 'recusada' | 'expirada';

export interface UnifiedAction {
  id: string;
  title: string;
  type: ActionType;
  status: ActionStatus;
  due_at: string | null;
  priority: number;
  description: string | null;
  owner_user_id: string;
  owner_name: string | null;
  clientes: { id: string; nome: string } | null;
  _source: 'action' | 'proposal';
  proposed_value?: number | null;
  proposal_status?: ProposalStatus;
}

const PROPOSAL_STATUS_MAP: Record<string, ActionStatus> = {
  ativa: 'aberta',
  aceita: 'concluida',
  recusada: 'concluida',
  expirada: 'concluida',
};

export function useCrmAcoesData() {
  const { user, role } = useAuth();
  const isAdminOrCoord = role === 'admin' || role === 'coordenador_rplus' || role === 'coordenador_servicos';

  const { data: actions, isLoading: loadingActions } = useQuery({
    queryKey: ['crm-actions-flat', user?.id, isAdminOrCoord],
    queryFn: async () => {
      let query = supabase
        .from('crm_actions')
        .select('*, clientes!inner(id, nome)')
        .order('due_at', { ascending: true, nullsFirst: false });

      if (!isAdminOrCoord && user?.id) {
        query = query.eq('owner_user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      let ownerMap = new Map<string, string>();
      if (isAdminOrCoord && data && data.length > 0) {
        const ownerIds = [...new Set(data.map((a: any) => a.owner_user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', ownerIds);
        ownerMap = new Map((profiles || []).map((p: any) => [p.id, p.nome]));
      }

      return (data || []).map((a: any): UnifiedAction => ({
        id: a.id,
        title: a.title,
        type: a.type,
        status: a.status,
        due_at: a.due_at,
        priority: a.priority,
        description: a.description,
        owner_user_id: a.owner_user_id,
        owner_name: ownerMap.get(a.owner_user_id) || null,
        clientes: a.clientes,
        _source: 'action',
      }));
    },
    enabled: !!user?.id,
  });

  const { data: proposals, isLoading: loadingProposals } = useQuery({
    queryKey: ['crm-proposals-flat', user?.id, isAdminOrCoord],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_proposals')
        .select('*, crm_client_products!inner(id, product_code, client_id, owner_user_id, clientes!inner(id, nome))');
      if (error) throw error;

      let filtered = data || [];
      if (!isAdminOrCoord && user?.id) {
        filtered = filtered.filter((p: any) => p.crm_client_products.owner_user_id === user.id);
      }

      let ownerMap = new Map<string, string>();
      if (isAdminOrCoord && filtered.length > 0) {
        const ownerIds = [...new Set(filtered.map((p: any) => p.crm_client_products.owner_user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', ownerIds);
        ownerMap = new Map((profiles || []).map((p: any) => [p.id, p.nome]));
      }

      return filtered.map((p: any): UnifiedAction => {
        const cp = p.crm_client_products;
        const productLabel = PRODUCT_LABELS[cp.product_code as ProductCode] || cp.product_code;
        return {
          id: p.id,
          title: `Proposta ${productLabel}`,
          type: 'oportunidade',
          status: PROPOSAL_STATUS_MAP[p.status] || 'aberta',
          due_at: p.valid_until,
          priority: 2,
          description: p.notes,
          owner_user_id: cp.owner_user_id,
          owner_name: ownerMap.get(cp.owner_user_id) || null,
          clientes: cp.clientes,
          _source: 'proposal',
          proposed_value: p.proposed_value,
          proposal_status: p.status as ProposalStatus,
        };
      });
    },
    enabled: !!user?.id,
  });

  return {
    actions: actions || [],
    proposals: proposals || [],
    isLoading: loadingActions || loadingProposals,
    isAdminOrCoord,
  };
}
