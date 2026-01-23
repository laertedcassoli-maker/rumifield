import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, Cloud, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChecklistSyncStatus } from "@/hooks/useOfflineChecklist";

interface ChecklistFloatingProgressProps {
  answered: number;
  total: number;
  onComplete: () => void;
  disabled: boolean;
  hasWarnings?: boolean;
  isSaving?: boolean;
  lastSavedAt?: Date | null;
  // Offline sync props
  isOnline?: boolean;
  syncStatus?: ChecklistSyncStatus;
  pendingCount?: number;
  onRetrySync?: () => void;
}

export default function ChecklistFloatingProgress({
  answered,
  total,
  onComplete,
  disabled,
  hasWarnings,
  isSaving,
  lastSavedAt,
  isOnline = true,
  syncStatus = "idle",
  pendingCount = 0,
  onRetrySync
}: ChecklistFloatingProgressProps) {
  const progress = total > 0 ? (answered / total) * 100 : 0;
  const isAllAnswered = answered === total && total > 0;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getSyncStatusDisplay = () => {
    // Offline mode with pending changes
    if (!isOnline && pendingCount > 0) {
      return (
        <div className="flex items-center gap-1.5 text-amber-600">
          <WifiOff className="h-3 w-3" />
          <span>{pendingCount} alteração{pendingCount > 1 ? 'ões' : ''} pendente{pendingCount > 1 ? 's' : ''}</span>
        </div>
      );
    }

    // Offline mode without pending changes
    if (!isOnline) {
      return (
        <div className="flex items-center gap-1.5 text-amber-600">
          <WifiOff className="h-3 w-3" />
          <span>Modo offline</span>
        </div>
      );
    }

    // Online - actively saving
    if (isSaving || syncStatus === "syncing") {
      return (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Salvando...</span>
        </div>
      );
    }

    // Online - pending items to sync
    if (syncStatus === "pending" && pendingCount > 0) {
      return (
        <button 
          onClick={onRetrySync}
          className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Sincronizar {pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
        </button>
      );
    }

    // Online - sync error
    if (syncStatus === "error") {
      return (
        <button 
          onClick={onRetrySync}
          className="flex items-center gap-1.5 text-destructive hover:text-destructive/80 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Erro - tentar novamente</span>
        </button>
      );
    }

    // Online - last saved time
    if (lastSavedAt) {
      return (
        <div className="flex items-center gap-1.5 text-success">
          <Cloud className="h-3 w-3" />
          <span>Salvo às {formatTime(lastSavedAt)}</span>
        </div>
      );
    }

    // Default - synced
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Cloud className="h-3 w-3" />
        <span>Dados sincronizados</span>
      </div>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-lg z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
        {/* Sync status indicator */}
        <div className="flex items-center justify-center text-xs">
          {getSyncStatusDisplay()}
        </div>

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
            disabled={disabled || !isAllAnswered || !isOnline}
            className="shrink-0"
            size="lg"
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Concluir
          </Button>
        </div>
        {!isOnline && isAllAnswered && (
          <p className="text-xs text-amber-600 text-center">
            ⚠️ Reconecte para concluir o checklist
          </p>
        )}
        {hasWarnings && isAllAnswered && isOnline && (
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
