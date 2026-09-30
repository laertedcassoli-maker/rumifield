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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeCode?: string | null;
  onConfirm: (justification: string) => void;
  isLoading: boolean;
}

export function CancelarRotaDialog({ open, onOpenChange, routeCode, onConfirm, isLoading }: Props) {
  const [justification, setJustification] = useState('');
  const close = () => { setJustification(''); onOpenChange(false); };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && !isLoading) close(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Cancelar rota {routeCode || ''}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            A rota fica como "Cancelada" e as visitas ainda não executadas também são canceladas.
            Visitas já executadas não mudam.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="justificativa-rota">Justificativa *</Label>
          <Textarea
            id="justificativa-rota"
            value={justification}
            maxLength={500}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Explique por que a rota está sendo cancelada"
          />
        </div>
        <AlertDialogFooter>
          <Button variant="outline" onClick={close} disabled={isLoading}>Voltar</Button>
          <Button
            variant="destructive"
            disabled={isLoading || !justification.trim()}
            onClick={() => onConfirm(justification.trim())}
          >
            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelando...</> : 'Cancelar rota'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
