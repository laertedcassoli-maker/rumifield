import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, FileText, Truck, HandHelping } from 'lucide-react';
import AssetSearchField from './AssetSearchField';
import type { PedidoComItens } from '@/types/pedidos';

interface ConcluirPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido?: PedidoComItens;
  onConfirm: (nfNumero: string, dataFaturamento: string, tipoLogistica: string, itemsWithAssets?: Record<string, string>) => Promise<void>;
  currentTipoLogistica?: string | null;
}

export default function ConcluirPedidoDialog({ open, onOpenChange, pedido, onConfirm, currentTipoLogistica }: ConcluirPedidoDialogProps) {
  const [nfNumero, setNfNumero] = useState('');
  const [dataFaturamento, setDataFaturamento] = useState(new Date().toISOString().split('T')[0]);
  const [tipoLogistica, setTipoLogistica] = useState(currentTipoLogistica || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const needsLogistica = pedido?.tipo_envio !== 'apenas_nf';
  const [itemsWithAssets, setItemsWithAssets] = useState<Record<string, string>>({});
  const submittingRef = useRef(false);

  const itemsNeedingAssets = (() => {
    if (!pedido?.pedido_itens) return [];
    return pedido.pedido_itens.filter(item =>
      item.pecas?.is_asset && !item.workshop_item
    );
  })();

  const handleConfirm = async () => {
    if (submittingRef.current) return;
    if (!nfNumero.trim() || (needsLogistica && !tipoLogistica)) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm(nfNumero.trim(), dataFaturamento, needsLogistica ? tipoLogistica : 'nao_aplicavel', itemsWithAssets);
      setNfNumero('');
      setDataFaturamento(new Date().toISOString().split('T')[0]);
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
            <FileText className="h-5 w-5" />
            Registrar Nota Fiscal
          </DialogTitle>
          <DialogDescription>
            Informe o número da NF e o tipo de logística para concluir este pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nf-numero">Número da NF *</Label>
            <Input
              id="nf-numero"
              placeholder="Ex: 12345"
              value={nfNumero}
              onChange={(e) => setNfNumero(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="data-faturamento">Data de Faturamento</Label>
            <Input
              id="data-faturamento"
              type="date"
              value={dataFaturamento}
              onChange={(e) => setDataFaturamento(e.target.value)}
            />
          </div>
          {needsLogistica && (
            <div className="space-y-2">
              <Label>Tipo de Logística *</Label>
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
                <AssetSearchField
                  key={item.id}
                  pecaId={item.peca_id}
                  onAssetSelected={(workshopItemId) => {
                    setItemsWithAssets(prev => ({
                      ...prev,
                      [item.id]: workshopItemId || '',
                    }));
                  }}
                  currentAssetId={itemsWithAssets[item.id] || null}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!nfNumero.trim() || (needsLogistica && !tipoLogistica) || isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
