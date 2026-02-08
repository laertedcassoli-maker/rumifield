import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, XCircle } from 'lucide-react';

interface CancelarVisitaCrmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  farmName?: string;
  onConfirm: (justification: string) => void;
  isLoading: boolean;
}

export function CancelarVisitaCrmDialog({
  open,
  onOpenChange,
  clientName,
  farmName,
  onConfirm,
  isLoading,
}: CancelarVisitaCrmDialogProps) {
  const [justification, setJustification] = useState('');

  const handleConfirm = () => {
    if (!justification.trim()) return;
    onConfirm(justification.trim());
  };

  const handleClose = () => {
    setJustification('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Cancelar Visita
          </AlertDialogTitle>
          <AlertDialogDescription>
            Você está cancelando a visita para{' '}
            <span className="font-medium text-foreground">
              {clientName}
              {farmName && ` - ${farmName}`}
            </span>
            . Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="crm-cancel-justification">Justificativa *</Label>
            <Textarea
              id="crm-cancel-justification"
              placeholder="Informe o motivo do cancelamento..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              autoFocus
            />
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!justification.trim() || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Cancelamento
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
