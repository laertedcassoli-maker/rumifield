import { WifiOff, CloudOff, RefreshCw } from "lucide-react";
import { useOffline } from "@/contexts/OfflineContext";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const { isOnline, syncStatus, pendingCount } = useOffline();

  if (isOnline && syncStatus !== "syncing" && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-300",
        !isOnline && "bg-amber-500 text-amber-950",
        isOnline && syncStatus === "syncing" && "bg-primary text-primary-foreground",
        isOnline && pendingCount > 0 && syncStatus !== "syncing" && "bg-amber-500 text-amber-950"
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>
            Você está offline. 
            {pendingCount > 0 
              ? ` ${pendingCount} ${pendingCount === 1 ? 'alteração será sincronizada' : 'alterações serão sincronizadas'} quando a conexão voltar.`
              : ' Os dados salvos localmente estão disponíveis.'}
          </span>
          <CloudOff className="h-4 w-4 ml-1" />
        </>
      ) : syncStatus === "syncing" ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Sincronizando dados...</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <CloudOff className="h-4 w-4" />
          <span>
            {pendingCount} {pendingCount === 1 ? 'alteração pendente' : 'alterações pendentes'} para sincronizar
          </span>
        </>
      ) : null}
    </div>
  );
}
