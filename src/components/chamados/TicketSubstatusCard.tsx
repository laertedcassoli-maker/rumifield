import { Clock, Package, CalendarClock, MapPin, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketSubstatusCardProps {
  substatus: string | null;
  updatedAt?: string;
}

const substatusConfig = {
  aguardando_cliente: {
    label: 'Aguardando Cliente',
    description: 'O chamado está em espera por uma ação ou resposta do cliente.',
    icon: User,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  aguardando_peca: {
    label: 'Aguardando Peça',
    description: 'Foi solicitada uma peça para resolver o problema. Aguardando chegada.',
    icon: Package,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  aguardando_visita: {
    label: 'Aguardando Visita',
    description: 'Uma visita técnica foi agendada. Aguardando a data marcada.',
    icon: CalendarClock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  em_visita: {
    label: 'Em Visita',
    description: 'O técnico está atualmente realizando a visita no local.',
    icon: MapPin,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
  },
};

export default function TicketSubstatusCard({ substatus, updatedAt }: TicketSubstatusCardProps) {
  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (!substatus) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Em andamento</p>
            <p className="text-xs text-muted-foreground/70">
              O chamado está sendo trabalhado ativamente.
            </p>
          </div>
          {updatedAt && (
            <span className="text-[10px] text-muted-foreground/60">
              desde {formatDate(updatedAt)}
            </span>
          )}
        </CardContent>
      </Card>
    );
  }

  const config = substatusConfig[substatus as keyof typeof substatusConfig];
  
  if (!config) {
    return null;
  }

  const Icon = config.icon;

  return (
    <Card className={cn('border', config.borderColor, config.bgColor)}>
      <CardContent className="py-4 flex items-center gap-3">
        <div className={cn('p-2 rounded-full', config.bgColor)}>
          <Icon className={cn('h-5 w-5', config.color)} />
        </div>
        <div className="flex-1">
          <p className={cn('text-sm font-semibold', config.color)}>{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
        {updatedAt && (
          <span className="text-[10px] text-muted-foreground/60">
            desde {formatDate(updatedAt)}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
