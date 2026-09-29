import AssetSearchField from './AssetSearchField';
import { Label } from '@/components/ui/label';
import { isManualDD, fromManualDD, toManualDD } from '@/lib/asset-slots';

interface MultiAssetFieldProps {
  pecaId: string;
  pecaNome: string;
  quantidade: number;
  selectedAssets: string[];
  onAssetsChange: (assets: string[]) => void;
  disabled?: boolean;
}

export default function MultiAssetField({
  pecaId,
  pecaNome,
  quantidade,
  selectedAssets,
  onAssetsChange,
  disabled = false,
}: MultiAssetFieldProps) {
  const setSlot = (index: number, value: string) => {
    const updated = [...selectedAssets];
    while (updated.length <= index) updated.push('');
    updated[index] = value;
    onAssetsChange(updated);
  };

  return (
    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
      <Label className="text-xs font-medium">
        {pecaNome} <span className="text-muted-foreground">(Qtd: {quantidade})</span>
      </Label>
      <div className="space-y-2">
        {Array.from({ length: quantidade }).map((_, idx) => {
          const slot = selectedAssets[idx] || '';
          const manual = isManualDD(slot);
          return (
            <div key={idx}>
              {quantidade > 1 && (
                <span className="text-xs text-muted-foreground mb-1 block">
                  Ativo {idx + 1} de {quantidade}
                </span>
              )}
              <AssetSearchField
                pecaId={pecaId}
                currentAssetId={manual ? null : slot || null}
                manualCode={manual ? fromManualDD(slot) : null}
                onAssetSelected={(wsId) => setSlot(idx, wsId || '')}
                onManualCodeChange={(v) => setSlot(idx, v === null ? '' : toManualDD(v))}
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
