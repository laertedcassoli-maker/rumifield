import { createContext, useContext, useEffect, ReactNode } from "react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAuth } from "@/contexts/AuthContext";

interface OfflineContextType {
  isOnline: boolean;
  syncStatus: "idle" | "syncing" | "error" | "offline";
  pendingCount: number;
  lastSyncTime: Date | null;
  triggerSync: () => Promise<void>;
  pushChanges: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const offlineSync = useOfflineSync();

  // Initial sync when user logs in
  useEffect(() => {
    if (user && offlineSync.isOnline) {
      // Delay initial sync to let app load
      const timer = setTimeout(() => {
        offlineSync.syncAll();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Periodic sync every 5 minutes when online
  useEffect(() => {
    if (!user || !offlineSync.isOnline) return;

    const interval = setInterval(() => {
      offlineSync.syncAll();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, offlineSync.isOnline]);

  return (
    <OfflineContext.Provider value={{
      isOnline: offlineSync.isOnline,
      syncStatus: offlineSync.syncStatus,
      pendingCount: offlineSync.pendingCount,
      lastSyncTime: offlineSync.lastSyncTime,
      triggerSync: offlineSync.triggerSync,
      pushChanges: offlineSync.pushChanges,
    }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}
