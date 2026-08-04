import { cn } from '@/lib/utils';

export interface FunnelStep {
  label: string;
  count: number;
  color: string;
}

export interface FunnelChartProps {
  steps: FunnelStep[];
  className?: string;
}

export function FunnelChart({ steps, className }: FunnelChartProps) {
  return (
    <div className={cn('grid grid-cols-2 min-[760px]:grid-cols-4 gap-3', className)}>
      {steps.map(step => (
        <div
          key={step.label}
          className="border border-border bg-muted/40 p-3 flex flex-col gap-0.5 min-w-0"
          style={{ borderRadius: '9px' }}
        >
          <span className={cn('font-bold leading-tight', step.color)} style={{ fontSize: '22px' }}>
            {step.count}
          </span>
          <span className="text-muted-foreground truncate" style={{ fontSize: '11.5px' }}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default FunnelChart;
