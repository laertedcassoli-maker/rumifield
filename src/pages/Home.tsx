import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  ShoppingCart, 
  Building2, 
  Users, 
  Truck, 
  Settings,
  ClipboardCheck,
  TrendingDown,
  Package,
  History,
  MapPin,
  Shield,
  Wrench,
  FileText,
  ListChecks,
  Box
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';

interface MenuItem {
  title: string;
  icon: React.ElementType;
  url: string;
  color: string;
  bgColor: string;
  permKey: string;
}

export default function Home() {
  const { profile } = useAuth();
  const { canAccess } = useMenuPermissions();

  // All possible menu items with permission keys
  const allMainMenuItems: MenuItem[] = [
    {
      title: 'Visitas',
      icon: MapPin,
      url: '/visitas',
      color: 'text-rose-600',
      bgColor: 'bg-rose-100 dark:bg-rose-900/30',
      permKey: 'visitas',
    },
    {
      title: 'Solicitação Peças',
      icon: ShoppingCart,
      url: '/pedidos',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      permKey: 'pedidos',
    },
  ];

  const allEstoqueMenuItems: MenuItem[] = [
    {
      title: 'Aferição',
      icon: ClipboardCheck,
      url: '/estoque',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      permKey: 'estoque_afericao',
    },
    {
      title: 'Consumo',
      icon: TrendingDown,
      url: '/estoque/consumo',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      permKey: 'estoque_consumo',
    },
    {
      title: 'Previsão Envios',
      icon: Package,
      url: '/estoque/previsao',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      permKey: 'estoque_previsao',
    },
    {
      title: 'Histórico',
      icon: History,
      url: '/estoque/historico',
      color: 'text-slate-600',
      bgColor: 'bg-slate-100 dark:bg-slate-900/30',
      permKey: 'estoque_historico',
    },
  ];

  const allOficinaMenuItems: MenuItem[] = [
    {
      title: 'Ordens de Serviço',
      icon: FileText,
      url: '/oficina/os',
      color: 'text-teal-600',
      bgColor: 'bg-teal-100 dark:bg-teal-900/30',
      permKey: 'oficina_os',
    },
    {
      title: 'Atividades',
      icon: ListChecks,
      url: '/oficina/atividades',
      color: 'text-pink-600',
      bgColor: 'bg-pink-100 dark:bg-pink-900/30',
      permKey: 'oficina_atividades',
    },
    {
      title: 'Itens Oficina',
      icon: Box,
      url: '/oficina/itens',
      color: 'text-lime-600',
      bgColor: 'bg-lime-100 dark:bg-lime-900/30',
      permKey: 'oficina_itens',
    },
  ];

  const allAdminMenuItems: MenuItem[] = [
    {
      title: 'Clientes',
      icon: Building2,
      url: '/admin/clientes',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
      permKey: 'admin_clientes',
    },
    {
      title: 'Usuários',
      icon: Users,
      url: '/admin/usuarios',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      permKey: 'admin_usuarios',
    },
    {
      title: 'Envios',
      icon: Truck,
      url: '/admin/envios',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      permKey: 'admin_envios',
    },
    {
      title: 'Cadastros',
      icon: Settings,
      url: '/admin/config',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
      permKey: 'admin_cadastros',
    },
    {
      title: 'Permissões',
      icon: Shield,
      url: '/admin/permissoes',
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      permKey: 'admin_permissoes',
    },
  ];

  // Filter based on permissions
  const mainMenuItems = allMainMenuItems.filter(item => canAccess(item.permKey));
  const estoqueMenuItems = canAccess('estoque') 
    ? allEstoqueMenuItems.filter(item => canAccess(item.permKey))
    : [];
  const oficinaMenuItems = canAccess('oficina')
    ? allOficinaMenuItems.filter(item => canAccess(item.permKey))
    : [];
  const adminMenuItems = allAdminMenuItems.filter(item => canAccess(item.permKey));

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
        {(mainMenuItems.length > 0 || estoqueMenuItems.length > 0 || oficinaMenuItems.length > 0) && (
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
              {oficinaMenuItems.map((item) => (
                <MenuCard key={item.url} item={item} />
              ))}
            </div>
          </div>
        )}

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
