import { Check, Clock, AlertTriangle, CheckCircle, XCircle, User, Package, CalendarClock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketStatusStepperProps {
  currentStatus: string;
  substatus?: string | null;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string | null;
}

const phases = [
  { key: 'aberto', label: 'Aberto', icon: Clock },
  { key: 'em_atendimento', label: 'Em Atendimento', icon: AlertTriangle },
  { key: 'resolvido', label: 'Resolvido', icon: CheckCircle },
];

const substatusConfig = {
  aguardando_cliente: {
    label: 'Aguardando Cliente',
    icon: User,
    color: 'text-orange-600',
  },
  aguardando_peca: {
    label: 'Aguardando Peça',
    icon: Package,
    color: 'text-purple-600',
  },
  aguardando_visita: {
    label: 'Aguardando Visita',
    icon: CalendarClock,
    color: 'text-blue-600',
  },
  em_visita: {
    label: 'Em Visita',
    icon: MapPin,
    color: 'text-green-600',
  },
};

export default function TicketStatusStepper({ 
  currentStatus, 
  substatus,
  createdAt, 
  updatedAt,
  resolvedAt 
}: TicketStatusStepperProps) {
  const isCancelled = currentStatus === 'cancelado';
  
  const getStepStatus = (stepKey: string, index: number) => {
    if (isCancelled) {
      return 'cancelled';
    }
    
    const currentIndex = phases.findIndex(p => p.key === currentStatus);
    
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  const getStepDate = (stepKey: string, status: string) => {
    if (status === 'pending' || status === 'cancelled') return null;
    
    switch (stepKey) {
      case 'aberto':
        return createdAt;
      case 'em_atendimento':
        return currentStatus === 'aberto' ? null : updatedAt;
      case 'resolvido':
        return resolvedAt;
      default:
        return null;
    }
  };

  const substatusInfo = substatus ? substatusConfig[substatus as keyof typeof substatusConfig] : null;

  if (isCancelled) {
    return (
      <div className="flex items-center justify-center gap-3 py-4 px-6 bg-muted/50 rounded-lg border border-dashed">
        <XCircle className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Chamado Cancelado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-4 px-6 bg-muted/30 rounded-lg">
      {phases.map((phase, index) => {
        const status = getStepStatus(phase.key, index);
        const Icon = phase.icon;
        const isLast = index === phases.length - 1;
        const stepDate = getStepDate(phase.key, status);
        const isEmAtendimento = phase.key === 'em_atendimento';
        const showSubstatus = isEmAtendimento && status === 'current' && substatusInfo;

        return (
          <div key={phase.key} className="flex items-center flex-1">
            {/* Step */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all border-2',
                  status === 'completed' && 'bg-primary border-primary text-primary-foreground',
                  status === 'current' && 'bg-primary/10 border-primary text-primary',
                  status === 'pending' && 'bg-muted border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {status === 'completed' ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium text-center',
                  status === 'completed' && 'text-primary',
                  status === 'current' && 'text-primary font-semibold',
                  status === 'pending' && 'text-muted-foreground'
                )}
              >
                {phase.label}
              </span>
              {stepDate && (
                <span className="text-[10px] text-muted-foreground/70">
                  {format(new Date(stepDate), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              )}
              {/* Substatus tag below Em Atendimento */}
              {showSubstatus && (
                <div className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-muted/60">
                  <substatusInfo.icon className={cn('h-3 w-3', substatusInfo.color)} />
                  <span className={cn('text-[10px] font-medium', substatusInfo.color)}>
                    {substatusInfo.label}
                  </span>
                </div>
              )}
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-3',
                  showSubstatus ? 'mt-[-60px]' : 'mt-[-36px]',
                  status === 'completed' ? 'bg-primary' : 'bg-muted-foreground/20'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
