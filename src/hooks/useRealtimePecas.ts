import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscreve a mudanças em tempo real na tabela `pecas` e invalida
 * as queryKeys informadas para refletir cadastros/edições/desativações
 * sem necessidade de refresh manual.
 */
export function useRealtimePecas(queryKeys: unknown[][]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`pecas-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pecas' },
        () => {
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, JSON.stringify(queryKeys)]);
}
