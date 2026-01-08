import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Dashboard from '@/pages/Dashboard';

export function HomeRedirect() {
  const navigate = useNavigate();

  const { data: menuConfig, isLoading } = useQuery({
    queryKey: ['menu-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['estoque_menu_enabled', 'inicio_menu_enabled']);
      if (error) throw error;
      return data;
    },
    staleTime: 5000,
  });

  const showInicioMenu = menuConfig?.find(c => c.chave === 'inicio_menu_enabled')?.valor !== 'false';

  useEffect(() => {
    if (!isLoading && !showInicioMenu) {
      navigate('/pedidos', { replace: true });
    }
  }, [isLoading, showInicioMenu, navigate]);

  // Show loading or Dashboard based on config
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!showInicioMenu) {
    return null; // Will redirect
  }

  return <Dashboard />;
}
