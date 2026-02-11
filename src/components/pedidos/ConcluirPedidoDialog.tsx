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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileText } from 'lucide-react';

interface ConcluirPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (nfNumero: string, dataFaturamento: string) => Promise<void>;
}

export default function ConcluirPedidoDialog({ open, onOpenChange, onConfirm }: ConcluirPedidoDialogProps) {
  const [nfNumero, setNfNumero] = useState('');
  const [dataFaturamento, setDataFaturamento] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!nfNumero.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm(nfNumero.trim(), dataFaturamento);
      setNfNumero('');
      setDataFaturamento(new Date().toISOString().split('T')[0]);
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
            Informe o número da NF para concluir este pedido.
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!nfNumero.trim() || isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
