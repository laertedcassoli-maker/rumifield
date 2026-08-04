import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export type KPIIconType = 'success' | 'warning' | 'critical' | 'info' | 'purple';

const ICON_STYLES: Record<KPIIconType, { icon: React.ElementType; badge: string }> = {
  success: { icon: CheckCircle2, badge: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  warning: { icon: AlertTriangle, badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  critical: { icon: XCircle, badge: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  info: { icon: Info, badge: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  purple: { icon: Sparkles, badge: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
};

export interface KPICardProps {
  label: string;
  value: string;
  subtext?: string;
  iconType: KPIIconType;
  delta?: { direction: 'up' | 'down'; text: string };
  className?: string;
}

export function KPICard({ label, value, subtext, iconType, delta, className }: KPICardProps) {
  const { icon: Icon, badge } = ICON_STYLES[iconType];
  const DeltaIcon = delta?.direction === 'down' ? TrendingDown : TrendingUp;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground min-w-0 truncate">{label}</span>
          <div className={cn('w-8 h-8 shrink-0 rounded-lg flex items-center justify-center', badge)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <span className="font-bold text-foreground leading-tight" style={{ fontSize: '26px' }}>
          {value}
        </span>
        {subtext && (
          <span className="text-muted-foreground" style={{ fontSize: '11.5px' }}>
            {subtext}
          </span>
        )}
        {delta && (
          <span
            className={cn(
              'flex items-center gap-1',
              delta.direction === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}
            style={{ fontSize: '11px' }}
          >
            <DeltaIcon className="w-3 h-3 shrink-0" />
            {delta.text}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

export default KPICard;
