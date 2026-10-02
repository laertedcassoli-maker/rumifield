import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VerMaisProps {
  mostrados: number;
  total: number;
  temMais: boolean;
  onVerMais: () => void;
  className?: string;
}

/** Botão "Ver mais" para listas limitadas por useVerMais (só aparece quando há mais itens). */
export function VerMais({ mostrados, total, temMais, onVerMais, className }: VerMaisProps) {
  if (!temMais) return null;
  return (
    <div className={cn('flex w-full flex-col items-center gap-1 py-2', className)}>
      <span className="text-xs text-muted-foreground">
        Mostrando {mostrados} de {total}
      </span>
      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onVerMais}>
        <ChevronDown className="mr-1 h-4 w-4" />
        Ver mais
      </Button>
    </div>
  );
}
