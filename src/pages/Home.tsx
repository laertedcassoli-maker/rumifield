import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { 
  ShoppingCart, 
  Beaker, 
  Building2, 
  Users, 
  Truck, 
  Settings,
  ClipboardCheck,
  TrendingDown,
  Package,
  History,
  FlaskConical,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  title: string;
  description: string;
  icon: React.ElementType;
  url: string;
  color: string;
  bgColor: string;
}

export default function Home() {
  const { profile, role } = useAuth();

  // Load menu visibility config
  const { data: menuConfigs } = useQuery({
    queryKey: ['menu-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['estoque_menu_enabled', 'inicio_menu_enabled', 'visitas_menu_enabled']);
      if (error) throw error;
      return data;
    },
    staleTime: 5000,
  });

  const showEstoqueMenu = menuConfigs?.find(c => c.chave === 'estoque_menu_enabled')?.valor !== 'false';
  const showVisitasMenu = menuConfigs?.find(c => c.chave === 'visitas_menu_enabled')?.valor === 'true';
  const isAdmin = role === 'admin' || role === 'gestor';

  // Main menu items
  const mainMenuItems: MenuItem[] = [
    ...(showVisitasMenu ? [{
      title: 'Visitas',
      description: 'Registrar visitas técnicas',
      icon: MapPin,
      url: '/visitas',
      color: 'text-rose-600',
      bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    }] : []),
    {
      title: 'Solicitação Peças',
      description: 'Solicitar peças para clientes',
      icon: ShoppingCart,
      url: '/pedidos',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
  ];

  // Estoque menu items (conditional)
  const estoqueMenuItems: MenuItem[] = showEstoqueMenu ? [
    {
      title: 'Aferição',
      description: 'Registrar medições de estoque',
      icon: ClipboardCheck,
      url: '/estoque',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      title: 'Consumo',
      description: 'Análise de consumo por fazenda',
      icon: TrendingDown,
      url: '/estoque/consumo',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      title: 'Previsão Envios',
      description: 'Previsão de reabastecimento',
      icon: Package,
      url: '/estoque/previsao',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      title: 'Histórico',
      description: 'Histórico de aferições',
      icon: History,
      url: '/estoque/historico',
      color: 'text-slate-600',
      bgColor: 'bg-slate-100 dark:bg-slate-900/30',
    },
  ] : [];

  // Admin menu items (conditional)
  const adminMenuItems: MenuItem[] = isAdmin ? [
    {
      title: 'Clientes',
      description: 'Gerenciar clientes e fazendas',
      icon: Building2,
      url: '/admin/clientes',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    },
    {
      title: 'Usuários',
      description: 'Gerenciar usuários do sistema',
      icon: Users,
      url: '/admin/usuarios',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    },
    ...(role === 'admin' ? [{
      title: 'Envios',
      description: 'Registro de envios de produtos',
      icon: Truck,
      url: '/admin/envios',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    }] : []),
    {
      title: 'Cadastros',
      description: 'Configurações e cadastros',
      icon: Settings,
      url: '/admin/config',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    },
  ] : [];

  const MenuCard = ({ item }: { item: MenuItem }) => (
    <Link
      to={item.url}
      className={cn(
        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-transparent",
        "bg-card hover:border-primary/20 hover:shadow-lg transition-all duration-200",
        "active:scale-95 group"
      )}
    >
      <div className={cn(
        "w-14 h-14 rounded-2xl flex items-center justify-center mb-2 transition-transform group-hover:scale-110",
        item.bgColor
      )}>
        <item.icon className={cn("w-7 h-7", item.color)} />
      </div>
      <h3 className="font-semibold text-center text-sm">{item.title}</h3>
    </Link>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      {/* Header */}
      <div className="text-center pt-4">
        <h1 className="text-2xl font-bold">
          Olá, {profile?.nome?.split(' ')[0] || 'Usuário'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          O que você deseja fazer?
        </p>
      </div>

      {/* Main Actions */}
      <div className="space-y-6">
        {/* Principal */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {mainMenuItems.map((item) => (
              <MenuCard key={item.url} item={item} />
            ))}
            {estoqueMenuItems.map((item) => (
              <MenuCard key={item.url} item={item} />
            ))}
          </div>
        </div>

        {/* Administração */}
        {adminMenuItems.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">
              Administração
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {adminMenuItems.map((item) => (
                <MenuCard key={item.url} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
