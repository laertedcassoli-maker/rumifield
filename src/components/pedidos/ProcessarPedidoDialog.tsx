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
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, ArrowRight, Truck, HandHelping, Container } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MultiAssetField from './MultiAssetField';
import type { PedidoComItens } from '@/types/pedidos';

interface ProcessarPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido?: PedidoComItens;
  onConfirm: (tipoLogistica?: string, itemsWithAssets?: Record<string, string[]>, codigoPostagem?: string, anexoFile?: File) => Promise<void>;
}

export default function ProcessarPedidoDialog({ open, onOpenChange, pedido, onConfirm }: ProcessarPedidoDialogProps) {
  const { toast } = useToast();
  const [tipoLogistica, setTipoLogistica] = useState('');
  const [codigoPostagem, setCodigoPostagem] = useState('');
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isColetaReversa = pedido?.tipo_solicitacao === 'coleta_reversa';
  const needsLogistica = pedido?.tipo_solicitacao === 'coleta_reversa'
    ? pedido?.tipo_coleta !== 'apenas_nf'
    : pedido?.tipo_envio !== 'apenas_nf';
  const [itemsWithAssets, setItemsWithAssets] = useState<Record<string, string[]>>({});
  const submittingRef = useRef(false);

  const itemsNeedingAssets = useMemo(() => {
    // Coleta Reversa já teve o vínculo de ativos feito na criação — não pedir de novo
    if (!pedido?.pedido_itens || pedido?.tipo_solicitacao === 'coleta_reversa') return [];
    return pedido.pedido_itens.filter(item => 
      item.pecas?.is_asset && !item.cancelled_at
    );
  }, [pedido]);

  const handleConfirm = async () => {
    if (submittingRef.current) return;
    if (isColetaReversa && tipoLogistica === 'correios' && !codigoPostagem.trim()) {
      toast({
        variant: 'destructive',
        title: 'Código de Postagem obrigatório',
        description: 'Informe o Código de Postagem para processar a coleta reversa via Correios.',
      });
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm(
        tipoLogistica || undefined,
        itemsWithAssets,
        isColetaReversa ? (codigoPostagem.trim() || undefined) : undefined,
        isColetaReversa ? (anexoFile || undefined) : undefined,
      );
      setTipoLogistica('');
      setItemsWithAssets({});
      setCodigoPostagem('');
      setAnexoFile(null);
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
                <ToggleGroupItem value="transportadora" className="text-xs gap-1">
                  <Container className="h-3 w-3" />
                  Transportadora
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
