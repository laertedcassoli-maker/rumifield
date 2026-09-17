import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Contagem de coletas reversas em status 'pendente' das quais o usuário logado
 * é o responsável (técnico, CSM, ou solicitante quando tipo_coleta = 'correios').
 * A key começa com ['pedidos'] para ser invalidada junto com a lista de pedidos.
 */
export function usePendenciasCount() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['pedidos', 'pendencias-count', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const uid = user!.id;
      const { count, error } = await supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')
        .or(`tecnico_responsavel_user_id.eq.${uid},csm_responsavel_user_id.eq.${uid},and(tipo_coleta.eq.correios,solicitante_id.eq.${uid})`);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return data ?? 0;
}
