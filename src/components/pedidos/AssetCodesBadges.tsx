import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface AssetCodesBadgesProps {
  codes?: string[];
  isAsset: boolean;
  quantidade: number;
}

export default function AssetCodesBadges({
  codes = [],
  isAsset,
  quantidade,
}: AssetCodesBadgesProps) {
  if (!isAsset) return null;

  const filledCodes = codes.filter(c => c && c.trim() !== '');
  const pendingCount = quantidade - filledCodes.length;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground">Ativos:</div>
      <div className="flex flex-wrap gap-1">
        {filledCodes.length > 0 ? (
          filledCodes.map((code, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              className="text-[10px]"
            >
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
              {code}
            </Badge>
          ))
        ) : null}
        {pendingCount > 0 && (
          <Badge
            variant="outline"
            className="text-[10px]"
          >
            <AlertCircle className="h-2.5 w-2.5 mr-1" />
            {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    </div>
  );
}
