import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface RankingItem {
  name: string;
  count: number | string;
  barColor?: string;
}

export interface RankingBarProps {
  items: RankingItem[];
  className?: string;
}

export function RankingBar({ items, className }: RankingBarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const max = Math.max(
    ...items.map(i => (typeof i.count === 'number' ? i.count : parseFloat(String(i.count)) || 0)),
    1
  );

  return (
    <div className={cn('space-y-2.5', className)}>
      {items.map((item, idx) => {
        const numeric = typeof item.count === 'number' ? item.count : parseFloat(String(item.count)) || 0;
        const pct = Math.max(0, Math.min(100, (numeric / max) * 100));
        return (
          <div key={`${item.name}-${idx}`} className="space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground truncate min-w-0" style={{ fontSize: '12.5px' }}>
                {item.name}
              </span>
              <span
                className="font-bold font-mono text-right shrink-0 text-foreground"
                style={{ fontSize: '12.5px' }}
              >
                {item.count}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out',
                  item.barColor || 'bg-blue-600'
                )}
                style={{ width: `${mounted ? pct : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default RankingBar;
