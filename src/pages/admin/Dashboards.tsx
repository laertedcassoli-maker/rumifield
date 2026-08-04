import { Link } from 'react-router-dom';
import { BarChart2, CalendarCheck, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardItem {
  title: string;
  description: string;
  icon: React.ElementType;
  url: string;
  color: string;
  bgColor: string;
  permKey: string;
}

const dashboards: DashboardItem[] = [
  {
    title: 'Gestão de OS',
    description: 'Indicadores, tempos, retrabalho e saúde de ativos da oficina',
    icon: BarChart2,
    url: '/admin/dashboards/gestao-os',
    color: 'text-teal-600',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
    permKey: 'oficina_gestao_os',
  },
  {
    title: 'Gestão de Preventivas',
    description: 'Cobertura, atrasos e conclusão das manutenções preventivas',
    icon: CalendarCheck,
    url: '/admin/dashboards/gestao-preventivas',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    permKey: 'oficina_gestao_os',
  },
  {
    title: 'Preventiva · Visão Gerencial',
    description: 'Cobertura da carteira, aderência de rotas e produtividade dos técnicos',
    icon: Gauge,
    url: '/preventivas/visao-gerencial',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    permKey: 'oficina_gestao_os',
  },
  {
    title: 'Chamados & Corretivas · Visão Gerencial',
    description: 'Volume, tempo de atendimento, remoto vs. visita e produtividade',
    icon: PhoneCall,
    url: '/chamados/visao-gerencial',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    permKey: 'oficina_gestao_os',
  },
];



export default function Dashboards() {
  const { canAccess, isLoading } = useMenuPermissions();

  const items = dashboards.filter(item => canAccess(item.permKey));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboards</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Painéis analíticos consolidados
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum dashboard disponível para o seu perfil.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map(item => (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                'flex items-start gap-3 p-4 rounded-2xl border-2 border-transparent',
                'bg-card hover:border-primary/20 hover:shadow-lg transition-all duration-200 active:scale-[0.98]'
              )}
            >
              <div className={cn('w-11 h-11 shrink-0 rounded-xl flex items-center justify-center', item.bgColor)}>
                <item.icon className={cn('w-6 h-6', item.color)} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
