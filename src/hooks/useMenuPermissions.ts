import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MenuPermission {
  menu_key: string;
  menu_label: string;
  menu_group: string;
  can_access: boolean;
}

export function useMenuPermissions() {
  const { role, user } = useAuth();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['user-menu-permissions', role],
    queryFn: async () => {
      if (!role) return [];
      
      // @ts-ignore - Table not yet in types
      const { data, error } = await supabase
        .from('role_menu_permissions')
        .select('menu_key, menu_label, menu_group, can_access')
        .eq('role', role);
      
      if (error) throw error;
      return data as MenuPermission[];
    },
    enabled: !!role && !!user,
    staleTime: 30000,
    gcTime: 60000,
  });

  const canAccess = (menuKey: string): boolean => {
    if (!permissions) return true; // Default to true while loading
    const perm = permissions.find(p => p.menu_key === menuKey);
    if (!perm) return role === 'admin'; // Admin: true for unconfigured menus
    return perm.can_access;
  };

  const canAccessAny = (menuKeys: string[]): boolean => {
    return menuKeys.some(key => canAccess(key));
  };

  return {
    permissions,
    isLoading,
    canAccess,
    canAccessAny,
  };
}
