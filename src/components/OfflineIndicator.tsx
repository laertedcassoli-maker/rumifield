import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOfflineSync, SyncStatus } from "@/hooks/useOfflineSync";
import { cn } from "@/lib/utils";

interface OfflineIndicatorProps {
  compact?: boolean;
}

export function OfflineIndicator({ compact = false }: OfflineIndicatorProps) {
  const { isOnline, syncStatus, pendingCount, lastSyncTime, triggerSync } = useOfflineSync();
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Show success indicator briefly after sync
  useEffect(() => {
    if (syncStatus === "idle" && lastSyncTime) {
      setShowSyncSuccess(true);
      const timer = setTimeout(() => setShowSyncSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus, lastSyncTime]);

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="h-4 w-4" />;
    }
    if (syncStatus === "syncing") {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    if (showSyncSuccess) {
      return <Check className="h-4 w-4" />;
    }
    if (pendingCount > 0) {
      return <CloudOff className="h-4 w-4" />;
    }
    return <Cloud className="h-4 w-4" />;
  };

  const getStatusColor = (): string => {
    if (!isOnline) return "text-orange-500";
    if (syncStatus === "syncing") return "text-blue-500";
    if (showSyncSuccess) return "text-green-500";
    if (syncStatus === "error") return "text-red-500";
    if (pendingCount > 0) return "text-yellow-500";
    return "text-green-500";
  };

  const getStatusText = () => {
    if (!isOnline) return "Offline";
    if (syncStatus === "syncing") return "Sincronizando...";
    if (showSyncSuccess) return "Sincronizado!";
    if (syncStatus === "error") return "Erro na sync";
    if (pendingCount > 0) return `${pendingCount} pendente${pendingCount > 1 ? "s" : ""}`;
    return "Online";
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return "Nunca sincronizado";
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "Agora";
    if (minutes < 60) return `${minutes}min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return lastSyncTime.toLocaleDateString("pt-BR");
  };

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative h-8 w-8", getStatusColor())}
            onClick={triggerSync}
            disabled={syncStatus === "syncing" || !isOnline}
          >
            {getStatusIcon()}
            {pendingCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {pendingCount > 9 ? "9+" : pendingCount}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-medium">{getStatusText()}</p>
            <p className="text-xs text-muted-foreground">{formatLastSync()}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className={cn("flex items-center gap-1.5", getStatusColor())}>
        {isOnline ? (
          <Wifi className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>
      
      {pendingCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
        </Badge>
      )}
      
      <Button
        variant="ghost"
        size="sm"
        onClick={triggerSync}
        disabled={syncStatus === "syncing" || !isOnline}
        className="h-7 px-2"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", syncStatus === "syncing" && "animate-spin")} />
      </Button>
    </div>
  );
}
