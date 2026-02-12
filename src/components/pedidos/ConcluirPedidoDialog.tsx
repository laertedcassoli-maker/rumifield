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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, FileText, Truck, HandHelping } from 'lucide-react';
import AssetCodesInput from './AssetCodesInput';
import type { PedidoComItens } from '@/hooks/useOfflinePedidos';

interface ConcluirPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (nfNumero: string, dataFaturamento: string, tipoLogistica: string, assetCodes?: Record<string, string[]>) => Promise<void>;
  currentTipoLogistica?: string | null;
  pedido?: PedidoComItens;
}

export default function ConcluirPedidoDialog({ open, onOpenChange, onConfirm, currentTipoLogistica, pedido }: ConcluirPedidoDialogProps) {
  const [nfNumero, setNfNumero] = useState('');
  const [dataFaturamento, setDataFaturamento] = useState(new Date().toISOString().split('T')[0]);
  const [tipoLogistica, setTipoLogistica] = useState(currentTipoLogistica || '');
  const [assetCodes, setAssetCodes] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assetItems = useMemo(() => {
    return pedido?.pedido_itens?.filter(i => i.is_asset) || [];
  }, [pedido]);

  const hasEmptyAssets = useMemo(() => {
    return assetItems.some(item => {
      const codes = assetCodes[item.id] || item.asset_codes || [];
      return codes.filter(c => c.trim()).length < item.quantidade;
    });
  }, [assetItems, assetCodes]);

  const handleConfirm = async () => {
    if (!nfNumero.trim() || !tipoLogistica) return;
    setIsSubmitting(true);
    try {
      await onConfirm(nfNumero.trim(), dataFaturamento, tipoLogistica, assetCodes);
      setNfNumero('');
      setDataFaturamento(new Date().toISOString().split('T')[0]);
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

          {assetItems.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold">Códigos de Ativo</Label>
              {assetItems.map(item => (
                <AssetCodesInput
                  key={item.id}
                  itemId={item.peca_id}
                  pecaNome={item.pecas?.nome || 'Sem nome'}
                  quantidade={item.quantidade}
                  initialCodes={assetCodes[item.id] || item.asset_codes || []}
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
          <Button onClick={handleConfirm} disabled={!nfNumero.trim() || !tipoLogistica || isSubmitting || hasEmptyAssets}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
