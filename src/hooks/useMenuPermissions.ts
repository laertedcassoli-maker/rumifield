import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MenuPermission {
  menu_key: string;
  menu_label: string;
  menu_group: string;
  can_access: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_edit_finalized: boolean;
}

export function useMenuPermissions() {
  const { role, user, loading: authLoading } = useAuth();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['user-menu-permissions', user?.id, role],
    queryFn: async () => {
      if (!role) return [];

      const { data, error } = await supabase
        .from('role_menu_permissions')
        .select('menu_key, menu_label, menu_group, can_access, can_edit, can_delete, can_edit_finalized')
        .eq('role', role);

      if (error) throw error;
      return data as MenuPermission[];
    },
    enabled: !!role && !!user && !authLoading,
    staleTime: 30000,
    gcTime: 60000,
  });

  const permissionsLoading = authLoading || isLoading || (!!user && !permissions);

  const canAccess = (menuKey: string): boolean => {
    if (permissionsLoading) return false; // Safe default: hide while loading
    if (!permissions) return false;
    const perm = permissions.find(p => p.menu_key === menuKey);
    if (!perm) return role === 'admin'; // Admin: true for unconfigured menus
    return perm.can_access;
  };

  const canAccessAny = (menuKeys: string[]): boolean => {
    return menuKeys.some(key => canAccess(key));
  };

  const canEdit = (menuKey: string): boolean => {
    if (!permissions) return false;
    const perm = permissions.find(p => p.menu_key === menuKey);
    if (!perm) return role === 'admin';
    return perm.can_edit;
  };

  const canDelete = (menuKey: string): boolean => {
    if (!permissions) return false;
    const perm = permissions.find(p => p.menu_key === menuKey);
    if (!perm) return role === 'admin';
    return perm.can_delete;
  };

  const canEditFinalized = (menuKey: string): boolean => {
    if (!permissions) return false;
    const perm = permissions.find(p => p.menu_key === menuKey);
    if (!perm) return role === 'admin';
    return perm.can_edit_finalized;
  };

  return {
    permissions,
    isLoading: permissionsLoading,
    canAccess,
    canAccessAny,
    canEdit,
    canDelete,
    canEditFinalized,
  };
}
