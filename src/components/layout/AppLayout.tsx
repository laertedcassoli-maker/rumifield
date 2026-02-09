import { ReactNode, useState } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { Loader2, Home, RefreshCw } from 'lucide-react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useOffline } from '@/contexts/OfflineContext';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

interface AppLayoutProps {
  children: ReactNode;
}

const pageTitles: Record<string, string> = {
  '/': 'Início',
  '/pedidos': 'Solicitação de Peças',
  '/estoque': 'Aferição de Estoque',
  '/estoque/consumo': 'Consumo',
  '/admin/clientes': 'Clientes',
  '/admin/usuarios': 'Usuários',
  '/admin/envios': 'Envios',
  '/admin/config': 'Cadastros',
};

export function AppLayout({ children }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { isOnline, pendingCount, syncStatus } = useOffline();
  const queryClient = useQueryClient();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const pageTitle = pageTitles[location.pathname] || 'RumiField';
  const isHomePage = location.pathname === '/';
  const isChecklistExecution = location.pathname.includes('/preventivas/execucao') && location.pathname.includes('/atendimento');
  const showBanner = !isOnline || syncStatus === "syncing" || pendingCount > 0;
  const showFloatingHomeButton = !isHomePage && !isChecklistExecution;

  const forceServiceWorkerUpdateAndReload = async () => {
    if (!('serviceWorker' in navigator)) return;

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(async (reg) => {
        try {
          // Ask the browser to check for a newer SW
          await reg.update();

          // If an update is already waiting, activate it immediately
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          // Some browsers keep the new SW in "installing" state briefly
          if (reg.installing) {
            const installing = reg.installing;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        } catch (e) {
          console.warn('[PWA] Falha ao atualizar service worker:', e);
        }
      })
    );

    // When the new SW takes control, reload to pick up the new build assets
    await new Promise<void>((resolve) => {
      const onControllerChange = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        resolve();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      // Fallback: if nothing changes quickly, continue anyway
      window.setTimeout(() => resolve(), 1500);
    });
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all React Query cache to force fresh data fetch
      queryClient.clear();

      // Only clear data caches, NOT the PWA workbox caches (preserves offline functionality)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        // Only delete supabase/data caches, keep workbox-precache for offline
        const dataCaches = cacheNames.filter(name => 
          name.includes('supabase') || 
          name.includes('api') || 
          name.includes('runtime')
        );
        await Promise.all(dataCaches.map(name => caches.delete(name)));
      }

      // Also force a SW update so the UI isn't stuck on an old precached build
      await forceServiceWorkerUpdateAndReload();

      // Force reload (soft reload - keeps SW active)
      // Add a cache-buster to avoid stubborn HTTP cache layers.
      const url = new URL(window.location.href);
      url.searchParams.set('r', String(Date.now()));
      window.location.replace(url.toString());
    } catch (error) {
      console.error('Error refreshing:', error);
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <OfflineBanner />
      <AppSidebar />
      <SidebarInset className={showBanner ? "pt-10" : ""}>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
          <SidebarTrigger className="h-9 w-9 md:h-7 md:w-7 [&>svg]:h-5 [&>svg]:w-5 md:[&>svg]:h-4 md:[&>svg]:w-4" />
          <span className="font-semibold md:hidden flex-1">{pageTitle}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForceRefresh}
            disabled={isRefreshing}
            className="ml-auto"
            title="Forçar atualização"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 max-w-full">
          <div className="w-full max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>
      </SidebarInset>
      
      {/* Floating Home Button - Mobile only, hidden on home page and checklist execution */}
      {showFloatingHomeButton && (
        <Link
          to="/"
          className="fixed bottom-6 left-6 md:hidden z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
          aria-label="Voltar ao Início"
        >
          <Home className="h-6 w-6" />
        </Link>
      )}
    </SidebarProvider>
  );
}
