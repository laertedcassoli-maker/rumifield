import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, ArrowRight, Truck, HandHelping } from 'lucide-react';
import AssetCodesInput from './AssetCodesInput';
import type { PedidoComItens } from '@/hooks/useOfflinePedidos';

interface ProcessarPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (tipoLogistica?: string, assetCodes?: Record<string, string[]>) => Promise<void>;
  pedido?: PedidoComItens;
}

export default function ProcessarPedidoDialog({ open, onOpenChange, onConfirm, pedido }: ProcessarPedidoDialogProps) {
  const [tipoLogistica, setTipoLogistica] = useState('');
  const [assetCodes, setAssetCodes] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assetItems = useMemo(() => {
    return pedido?.pedido_itens?.filter(i => i.is_asset) || [];
  }, [pedido]);

  const hasEmptyAssets = useMemo(() => {
    return assetItems.some(item => {
      const codes = assetCodes[item.id] || [];
      return codes.filter(c => c.trim()).length < item.quantidade;
    });
  }, [assetItems, assetCodes]);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(tipoLogistica || undefined, assetCodes);
      setTipoLogistica('');
      setAssetCodes({});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Processar Pedido
          </DialogTitle>
          <DialogDescription>
            Opcionalmente, defina o tipo de logística agora. Caso contrário, será obrigatório ao concluir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Logística (opcional)</Label>
            <ToggleGroup 
              type="single" 
              value={tipoLogistica} 
              onValueChange={(v) => setTipoLogistica(v || '')}
              className="justify-start"
            >
              <ToggleGroupItem value="correios" className="text-xs gap-1">
                <Truck className="h-3 w-3" />
                Correios
              </ToggleGroupItem>
              <ToggleGroupItem value="entrega_propria" className="text-xs gap-1">
                <HandHelping className="h-3 w-3" />
                Entrega Própria
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {assetItems.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold">Códigos de Ativo</Label>
              {assetItems.map(item => (
                <AssetCodesInput
                  key={item.id}
                  itemId={item.peca_id}
                  pecaNome={item.pecas?.nome || 'Sem nome'}
                  quantidade={item.quantidade}
                  initialCodes={item.asset_codes || []}
                  isAsset={true}
                  onCodesChange={(codes) => {
                    setAssetCodes(prev => ({
                      ...prev,
                      [item.id]: codes,
                    }));
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting || hasEmptyAssets}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Processar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
