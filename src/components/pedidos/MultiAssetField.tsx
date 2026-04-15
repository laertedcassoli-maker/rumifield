import AssetSearchField from './AssetSearchField';
import { Label } from '@/components/ui/label';

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
  const handleAssetSelected = (index: number, workshopItemId: string | null) => {
    const updated = [...selectedAssets];
    // Ensure array is at least `index + 1` long
    while (updated.length <= index) updated.push('');
    updated[index] = workshopItemId || '';
    onAssetsChange(updated);
  };

  return (
    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
      <Label className="text-xs font-medium">
        {pecaNome} <span className="text-muted-foreground">(Qtd: {quantidade})</span>
      </Label>
      <div className="space-y-2">
        {Array.from({ length: quantidade }).map((_, idx) => (
          <div key={idx}>
            {quantidade > 1 && (
              <span className="text-xs text-muted-foreground mb-1 block">
                Ativo {idx + 1} de {quantidade}
              </span>
            )}
            <AssetSearchField
              pecaId={pecaId}
              currentAssetId={selectedAssets[idx] || null}
              onAssetSelected={(wsId) => handleAssetSelected(idx, wsId)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
