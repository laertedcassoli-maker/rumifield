import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GraduationCap } from 'lucide-react';
import TrainingChecklistExecution from './TrainingChecklistExecution';

interface CombinarTreinamentoSectionProps {
  clienteId: string;
  responsavelUserId: string;
  responsavelTipo?: 'tecnico' | 'csm';
}

/**
 * Toggle "Combinar com Treinamento" usado nas telas de execução (corretiva,
 * preventiva e etapa de instalação). Ao ativar, abre o checklist de treinamento.
 */
export default function CombinarTreinamentoSection({
  clienteId,
  responsavelUserId,
  responsavelTipo = 'tecnico',
}: CombinarTreinamentoSectionProps) {
  const [enabled, setEnabled] = useState(false);

  if (!clienteId || !responsavelUserId) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <Label htmlFor="combinar-treinamento" className="cursor-pointer">
                Combinar com Treinamento de Manutenção
              </Label>
              <p className="text-sm text-muted-foreground">
                Registre um Treinamento de Manutenção realizado neste mesmo atendimento.
              </p>
            </div>
          </div>
          <Switch id="combinar-treinamento" checked={enabled} onCheckedChange={setEnabled} />
        </CardContent>
      </Card>

      {enabled && (
        <TrainingChecklistExecution
          clienteId={clienteId}
          responsavelUserId={responsavelUserId}
          responsavelTipo={responsavelTipo}
        />
      )}
    </div>
  );
}
