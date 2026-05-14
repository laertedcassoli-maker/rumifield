import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';

export const SOLENOIDE_TRIGGER_CODE = 'PRD00605';
export const SOLENOIDE_TARGET_CODE = 'PRD00639';
export const SOLENOIDE_TARGET_QTY = 3;

interface SolenoideModeloDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: string | null;
  onConfirm: (modelo: '2x' | '3x') => void;
  description?: string;
}

/**
 * Diálogo padrão para escolha do Modelo do Solenóide (2x ou 3x).
 * Usado sempre que a peça PRD00605 está presente em um pedido/visita.
 */
export default function SolenoideModeloDialog({
  open,
  onOpenChange,
  initialValue,
  onConfirm,
  description,
}: SolenoideModeloDialogProps) {
  const [modelo, setModelo] = useState<'2x' | '3x' | ''>(
    (initialValue === '2x' || initialValue === '3x') ? initialValue : ''
  );

  useEffect(() => {
    if (open) {
      setModelo((initialValue === '2x' || initialValue === '3x') ? initialValue : '');
    }
  }, [open, initialValue]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Modelo do Solenóide</AlertDialogTitle>
          <AlertDialogDescription>
            {description ||
              'A peça PRD00605 está presente. Selecione o modelo (2x ou 3x) para concluir.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-sm">Modelo</Label>
          <ToggleGroup
            type="single"
            value={modelo}
            onValueChange={(v) => v && setModelo(v as '2x' | '3x')}
            className="justify-start"
          >
            <ToggleGroupItem value="2x" className="font-mono">2x</ToggleGroupItem>
            <ToggleGroupItem value="3x" className="font-mono">3x</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!modelo}
            onClick={(e) => {
              if (!modelo) {
                e.preventDefault();
                return;
              }
              onConfirm(modelo);
            }}
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
