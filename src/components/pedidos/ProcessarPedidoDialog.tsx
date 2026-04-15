import { useState, useMemo, useRef } from 'react';
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
import MultiAssetField from './MultiAssetField';
import type { PedidoComItens } from '@/types/pedidos';

interface ProcessarPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido?: PedidoComItens;
  onConfirm: (tipoLogistica?: string, itemsWithAssets?: Record<string, string[]>) => Promise<void>;
}

export default function ProcessarPedidoDialog({ open, onOpenChange, pedido, onConfirm }: ProcessarPedidoDialogProps) {
  const [tipoLogistica, setTipoLogistica] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const needsLogistica = pedido?.tipo_envio !== 'apenas_nf';
  const [itemsWithAssets, setItemsWithAssets] = useState<Record<string, string[]>>({});
  const submittingRef = useRef(false);

  const itemsNeedingAssets = useMemo(() => {
    if (!pedido?.pedido_itens) return [];
    return pedido.pedido_itens.filter(item => 
      item.pecas?.is_asset && !item.cancelled_at
    );
  }, [pedido]);

  const handleConfirm = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm(tipoLogistica || undefined, itemsWithAssets);
      setTipoLogistica('');
      setItemsWithAssets({});
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
          {needsLogistica && (
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
          )}

          {itemsNeedingAssets.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-semibold">Vincular Ativos (Peças Controladas)</Label>
              {itemsNeedingAssets.map(item => (
                <MultiAssetField
                  key={item.id}
                  pecaId={item.peca_id}
                  pecaNome={item.pecas?.nome || item.pecas?.codigo || ''}
                  quantidade={item.quantidade}
                  selectedAssets={itemsWithAssets[item.id] || []}
                  onAssetsChange={(assets) => {
                    setItemsWithAssets(prev => ({
                      ...prev,
                      [item.id]: assets,
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
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Processar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
