import { Check, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TicketStatusStepperProps {
  currentStatus: string;
}

const phases = [
  { key: 'aberto', label: 'Aberto', icon: Clock },
  { key: 'em_atendimento', label: 'Em Atendimento', icon: AlertTriangle },
  { key: 'resolvido', label: 'Resolvido', icon: CheckCircle },
];

export default function TicketStatusStepper({ currentStatus }: TicketStatusStepperProps) {
  const isCancelled = currentStatus === 'cancelado';
  
  const getStepStatus = (stepKey: string, index: number) => {
    if (isCancelled) {
      // If cancelled, show all steps as cancelled
      return 'cancelled';
    }
    
    const currentIndex = phases.findIndex(p => p.key === currentStatus);
    
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

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

        return (
          <div key={phase.key} className="flex items-center flex-1">
            {/* Step */}
            <div className="flex flex-col items-center gap-2">
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
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-3 mt-[-24px]',
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
