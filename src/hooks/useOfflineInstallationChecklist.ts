import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineInstallationDb, InstallationSyncQueueItem } from "@/lib/offline-installation-db";
import { reportDeadLetter } from "@/lib/reportDeadLetter";
import { toast } from "sonner";

export type InstallationSyncStatus = "idle" | "syncing" | "error" | "offline" | "pending";

// Offline-first sync engine for INSTALLATION checklist execution.
// Mirrors useOfflineChecklist (preventive) but targets installation_* tables only.
export function useOfflineInstallationChecklist() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<InstallationSyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncInProgressRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isOnlineRef = useRef(isOnline);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      isOnlineRef.current = true;
      syncPendingChanges();
    };

    const handleOffline = () => {
      setIsOnline(false);
      isOnlineRef.current = false;
      setSyncStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePendingCount = useCallback(async () => {
    const count = await offlineInstallationDb.getPendingCount();
    setPendingCount(count);
    if (count > 0 && isOnline && syncStatus === "idle") {
      setSyncStatus("pending");
    }
  }, [isOnline, syncStatus]);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  const processSyncItem = async (item: InstallationSyncQueueItem): Promise<{ ok: boolean; errorMessage?: string }> => {
    const { table, operation, data } = item;

    try {
      switch (operation) {
        case "update": {
          const id = data.id as string;
          const cleanData = { ...data };
          delete cleanData.id;
          delete cleanData._pendingSync;
          delete cleanData._syncedAt;

          if (table === "installation_checklist_items") {
            const { error } = await (supabase as any)
              .from("installation_checklist_items")
              .update(cleanData)
              .eq("id", id);
            if (error) throw error;
            await offlineInstallationDb.checklistItems.update(id, { _pendingSync: false });
          } else if (table === "installation_part_consumption") {
            delete cleanData._operation;
            const { error } = await (supabase as any)
              .from("installation_part_consumption")
              .update(cleanData)
              .eq("id", id);
            if (error) throw error;
            await offlineInstallationDb.partConsumptions.update(id, { _pendingSync: false });
          }
          break;
        }

        case "insert": {
          if (table === "installation_checklist_item_actions") {
            const { error } = await (supabase as any)
              .from("installation_checklist_item_actions")
              .insert({
                exec_item_id: data.exec_item_id,
                template_action_id: data.template_action_id,
                action_label_snapshot: data.action_label_snapshot,
              });
            // Duplicate key = already synced
            if (error && error.code !== '23505') throw error;
          } else if (table === "installation_checklist_item_nonconformities") {
            const { error } = await (supabase as any)
              .from("installation_checklist_item_nonconformities")
              .insert({
                exec_item_id: data.exec_item_id,
                template_nonconformity_id: data.template_nonconformity_id,
                nonconformity_label_snapshot: data.nonconformity_label_snapshot,
              });
            if (error && error.code !== '23505') throw error;
          } else if (table === "installation_part_consumption") {
            const cleanData = { ...data };
            delete cleanData._pendingSync;
            delete cleanData._operation;

            const { error } = await (supabase as any)
              .from("installation_part_consumption")
              .upsert(cleanData, {
                onConflict: 'id',
                ignoreDuplicates: true,
              });

            if (error && error.code !== '23505') throw error;

            if (data.id) {
              await offlineInstallationDb.partConsumptions.update(data.id as string, { _pendingSync: false });
            }
          }
          break;
        }

        case "delete": {
          if (table === "installation_checklist_item_actions") {
            const { error } = await (supabase as any)
              .from("installation_checklist_item_actions")
              .delete()
              .eq("exec_item_id", data.exec_item_id as string)
              .eq("template_action_id", data.template_action_id as string);
            if (error) throw error;
          } else if (table === "installation_checklist_item_nonconformities") {
            const { error } = await (supabase as any)
              .from("installation_checklist_item_nonconformities")
              .delete()
              .eq("exec_item_id", data.exec_item_id as string)
              .eq("template_nonconformity_id", data.template_nonconformity_id as string);
            if (error) throw error;
          } else if (table === "installation_part_consumption") {
            if (data.id) {
              const { error } = await (supabase as any)
                .from("installation_part_consumption")
                .delete()
                .eq("id", data.id as string);
              if (error) throw error;
            } else if (data.exec_nonconformity_id) {
              const { error } = await (supabase as any)
                .from("installation_part_consumption")
                .delete()
                .eq("exec_nonconformity_id", data.exec_nonconformity_id as string);
              if (error) throw error;
            }
          }
          break;
        }
      }

      return { ok: true };
    } catch (error) {
      console.error(`Error processing installation sync item for ${table}:`, error);
      const errorMessage = (error as { message?: string })?.message ?? String(error);
      return { ok: false, errorMessage };
    }
  };

  const syncPendingChanges = useCallback(async () => {
    if (!isOnlineRef.current || syncInProgressRef.current) {
      return;
    }

    syncInProgressRef.current = true;
    setSyncStatus("syncing");

    try {
      const items = await offlineInstallationDb.getPendingSyncItems();

      if (items.length === 0) {
        setSyncStatus("idle");
        syncInProgressRef.current = false;
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const item of items) {
        const result = await processSyncItem(item);

        if (result.ok) {
          await offlineInstallationDb.removeSyncItem(item.id!);
          successCount++;
        } else {
          await offlineInstallationDb.incrementRetryCount(item.id!);

          // Dead-letter after 5 retries (never discard silently)
          if (item.retryCount >= 5) {
            const errorMessage = result.errorMessage ?? null;
            try {
              await offlineInstallationDb.moveToDeadLetter(
                { ...item, retryCount: item.retryCount + 1 },
                errorMessage,
              );
              await reportDeadLetter({
                table: item.table,
                operation: item.operation,
                retryCount: item.retryCount + 1,
                errorMessage,
                data: item.data,
              });
            } catch (dlErr) {
              console.error("Failed to move installation sync item to dead-letter", dlErr);
            }
            failCount++;
          }
        }
      }

      await updatePendingCount();
      setLastSyncTime(new Date());

      if (failCount > 0) {
        setSyncStatus("error");
        toast.error(`${failCount} alterações não puderam ser sincronizadas`);
      } else {
        setSyncStatus("idle");
      }
    } catch (error) {
      console.error("Installation sync error:", error);
      setSyncStatus("error");
    } finally {
      syncInProgressRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatePendingCount]);

  const debouncedSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      if (isOnlineRef.current) {
        syncPendingChanges();
      }
    }, 2000);
  }, [syncPendingChanges]);

  const triggerSync = useCallback(async () => {
    if (isOnline) {
      await syncPendingChanges();
    } else {
      toast.error("Sem conexão com a internet");
    }
  }, [isOnline, syncPendingChanges]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    isOnline,
    syncStatus,
    pendingCount,
    lastSyncTime,
    debouncedSync,
    triggerSync,
    syncPendingChanges,
    updatePendingCount,
  };
}
