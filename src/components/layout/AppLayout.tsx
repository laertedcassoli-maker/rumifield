import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { Loader2, Home } from 'lucide-react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useOffline } from '@/contexts/OfflineContext';

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
  const pageTitle = pageTitles[location.pathname] || 'RumiField';
  const isHomePage = location.pathname === '/';

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

  const { isOnline, pendingCount, syncStatus } = useOffline();
  const showBanner = !isOnline || syncStatus === "syncing" || pendingCount > 0;

  return (
    <SidebarProvider>
      <OfflineBanner />
      <AppSidebar />
      <SidebarInset className={showBanner ? "pt-10" : ""}>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
          <SidebarTrigger className="h-9 w-9 md:h-7 md:w-7 [&>svg]:h-5 [&>svg]:w-5 md:[&>svg]:h-4 md:[&>svg]:w-4" />
          <span className="font-semibold md:hidden">{pageTitle}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
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
