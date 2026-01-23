import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";

interface ChecklistFloatingProgressProps {
  answered: number;
  total: number;
  onComplete: () => void;
  disabled: boolean;
  hasWarnings?: boolean;
}

export default function ChecklistFloatingProgress({
  answered,
  total,
  onComplete,
  disabled,
  hasWarnings
}: ChecklistFloatingProgressProps) {
  const progress = total > 0 ? (answered / total) * 100 : 0;
  const isAllAnswered = answered === total && total > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-lg z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {answered} de {total} itens
              </span>
              <span className="text-muted-foreground">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          <Button
            onClick={onComplete}
            disabled={disabled || !isAllAnswered}
            className="shrink-0"
            size="lg"
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Concluir
          </Button>
        </div>
        {hasWarnings && isAllAnswered && (
          <p className="text-xs text-amber-600 text-center">
            ⚠️ Existem falhas sem ações corretivas
          </p>
        )}
        {!isAllAnswered && (
          <p className="text-xs text-muted-foreground text-center">
            Responda todos os itens para concluir
          </p>
        )}
      </div>
    </div>
  );
}
