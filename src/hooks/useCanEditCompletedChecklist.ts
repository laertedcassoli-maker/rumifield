import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns true when the current user is allowed to edit a preventive
 * checklist that is already marked as 'concluido'.
 * Backed by SQL function public.can_edit_completed_checklist().
 */
export function useCanEditCompletedChecklist() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['can-edit-completed-checklist', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_edit_completed_checklist', {
        _user_id: user!.id,
      });
      if (error) throw error;
      return Boolean(data);
    },
  });

  return Boolean(data);
}
