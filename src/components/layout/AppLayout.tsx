import { ReactNode, useState } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { Loader2, Home, RefreshCw } from 'lucide-react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useOffline } from '@/contexts/OfflineContext';
import { Button } from '@/components/ui/button';

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
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const pageTitle = pageTitles[location.pathname] || 'RumiField';
  const isHomePage = location.pathname === '/';
  const showBanner = !isOnline || syncStatus === "syncing" || pendingCount > 0;

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // Force reload from server
      window.location.reload();
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
      
      {/* Floating Home Button - Mobile only, hidden on home page */}
      {!isHomePage && (
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
