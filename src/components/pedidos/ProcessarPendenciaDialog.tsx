import { useState, useRef } from 'react';
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
import { Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PedidoComItens } from '@/types/pedidos';

interface ProcessarPendenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido?: PedidoComItens;
  onConfirm: (codigoRastreio: string, anexoFile?: File) => Promise<void>;
}

export default function ProcessarPendenciaDialog({ open, onOpenChange, pedido, onConfirm }: ProcessarPendenciaDialogProps) {
  const { toast } = useToast();
  const [codigoRastreio, setCodigoRastreio] = useState('');
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleConfirm = async () => {
    if (submittingRef.current) return;
    if (!codigoRastreio.trim()) {
      toast({
        variant: 'destructive',
        title: 'Código de Rastreio obrigatório',
        description: 'Informe o Código de Rastreio para processar esta pendência.',
      });
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm(codigoRastreio.trim(), anexoFile || undefined);
      setCodigoRastreio('');
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
            Processar Pendência
          </DialogTitle>
          <DialogDescription>
            {pedido?.pedido_code ? `${pedido.pedido_code} — ` : ''}
            Informe o Código de Rastreio para seguir com esta coleta reversa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="codigo-rastreio">Código de Rastreio:</Label>
            <Input
              id="codigo-rastreio"
              value={codigoRastreio}
              onChange={(e) => setCodigoRastreio(e.target.value)}
              placeholder="Informe o código de rastreio"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="anexo-rastreio">Anexo (opcional)</Label>
            <Input
              id="anexo-rastreio"
              type="file"
              onChange={(e) => setAnexoFile(e.target.files?.[0] || null)}
            />
            {anexoFile && (
              <p className="text-xs text-muted-foreground">{anexoFile.name}</p>
            )}
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
