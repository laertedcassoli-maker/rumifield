import { useState } from 'react';
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

interface ProcessarPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (tipoLogistica?: string) => Promise<void>;
}

export default function ProcessarPedidoDialog({ open, onOpenChange, onConfirm }: ProcessarPedidoDialogProps) {
  const [tipoLogistica, setTipoLogistica] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(tipoLogistica || undefined);
      setTipoLogistica('');
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
