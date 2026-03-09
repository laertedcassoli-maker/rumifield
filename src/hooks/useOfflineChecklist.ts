import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineChecklistDb, ChecklistSyncQueueItem } from "@/lib/offline-checklist-db";
import { toast } from "sonner";

export type ChecklistSyncStatus = "idle" | "syncing" | "error" | "offline" | "pending";

export function useOfflineChecklist() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<ChecklistSyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncInProgressRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isOnlineRef = useRef(isOnline);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      isOnlineRef.current = true;
      // Auto-sync when coming back online
      syncPendingChanges();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const count = await offlineChecklistDb.getPendingCount();
    setPendingCount(count);
    if (count > 0 && isOnline && syncStatus === "idle") {
      setSyncStatus("pending");
    }
  }, [isOnline, syncStatus]);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // Process a single sync item
  const processSyncItem = async (item: ChecklistSyncQueueItem): Promise<boolean> => {
    const { table, operation, data } = item;

    try {
      switch (operation) {
        case "update": {
          const id = data.id as string;
          const cleanData = { ...data };
          delete cleanData.id;
          delete cleanData._pendingSync;
          delete cleanData._syncedAt;

          const { error } = await supabase
            .from(table)
            .update(cleanData as never)
            .eq("id", id);

          if (error) throw error;
          
          // Update local cache to mark as synced
          if (table === "preventive_checklist_items") {
            await offlineChecklistDb.checklistItems.update(id, { _pendingSync: false });
          }
          break;
        }

        case "insert": {
          if (table === "preventive_checklist_item_actions") {
            const { error } = await supabase
              .from("preventive_checklist_item_actions")
              .insert({
                exec_item_id: data.exec_item_id,
                template_action_id: data.template_action_id,
                action_label_snapshot: data.action_label_snapshot
              } as never);

            // Treat duplicate key as success (already synced)
            if (error && error.code !== '23505') throw error;
          } else if (table === "preventive_checklist_item_nonconformities") {
            const { error } = await supabase
              .from("preventive_checklist_item_nonconformities")
              .insert({
                exec_item_id: data.exec_item_id,
                template_nonconformity_id: data.template_nonconformity_id,
                nonconformity_label_snapshot: data.nonconformity_label_snapshot
              } as never);

            // Treat duplicate key as success (already synced)
            if (error && error.code !== '23505') throw error;
          }
          break;
        }

        case "delete": {
          if (table === "preventive_checklist_item_actions") {
            const { error } = await supabase
              .from("preventive_checklist_item_actions")
              .delete()
              .eq("exec_item_id", data.exec_item_id as string)
              .eq("template_action_id", data.template_action_id as string);

            if (error) throw error;
          } else if (table === "preventive_checklist_item_nonconformities") {
            const { error } = await supabase
              .from("preventive_checklist_item_nonconformities")
              .delete()
              .eq("exec_item_id", data.exec_item_id as string)
              .eq("template_nonconformity_id", data.template_nonconformity_id as string);

            if (error) throw error;
          }
          break;
        }
      }

      return true;
    } catch (error) {
      console.error(`Error processing sync item for ${table}:`, error);
      return false;
    }
  };

  // Sync pending changes to server
  const syncPendingChanges = useCallback(async () => {
    if (!isOnline || syncInProgressRef.current) {
      return;
    }

    syncInProgressRef.current = true;
    setSyncStatus("syncing");

    try {
      const items = await offlineChecklistDb.getPendingSyncItems();
      
      if (items.length === 0) {
        setSyncStatus("idle");
        syncInProgressRef.current = false;
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const item of items) {
        const success = await processSyncItem(item);
        
        if (success) {
          await offlineChecklistDb.removeSyncItem(item.id!);
          successCount++;
        } else {
          await offlineChecklistDb.incrementRetryCount(item.id!);
          
          // Remove if too many retries
          if (item.retryCount >= 5) {
            await offlineChecklistDb.removeSyncItem(item.id!);
            failCount++;
          }
        }
      }

      await updatePendingCount();
      setLastSyncTime(new Date());

      if (failCount > 0) {
        setSyncStatus("error");
        toast.error(`${failCount} alterações não puderam ser sincronizadas`);
      } else if (successCount > 0) {
        setSyncStatus("idle");
        toast.success(`${successCount} alterações sincronizadas!`);
      } else {
        setSyncStatus("idle");
      }
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus("error");
    } finally {
      syncInProgressRef.current = false;
    }
  }, [updatePendingCount]);

  // Debounced sync trigger
  const debouncedSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    syncTimeoutRef.current = setTimeout(() => {
      if (isOnline) {
        syncPendingChanges();
      }
    }, 2000); // Wait 2 seconds before syncing
  }, [syncPendingChanges]);

  // Update checklist item with offline support
  const updateItem = useCallback(async (
    itemId: string,
    updates: { status?: 'S' | 'N' | 'NA' | null; notes?: string }
  ): Promise<boolean> => {
    const answeredAt = new Date().toISOString();
    const fullUpdates = { ...updates, answered_at: answeredAt };

    // Always save locally first
    await offlineChecklistDb.updateItemLocally(itemId, fullUpdates);
    await updatePendingCount();

    if (isOnline) {
      // Try to sync immediately
      debouncedSync();
      return true;
    } else {
      setSyncStatus("offline");
      return true; // Saved locally
    }
  }, [debouncedSync, updatePendingCount]);

  // Toggle action with offline support
  const toggleAction = useCallback(async (
    itemId: string,
    actionId: string,
    actionLabel: string,
    isCurrentlySelected: boolean
  ): Promise<boolean> => {
    if (isCurrentlySelected) {
      await offlineChecklistDb.removeActionLocally(itemId, actionId);
    } else {
      await offlineChecklistDb.addActionLocally({
        id: crypto.randomUUID(),
        exec_item_id: itemId,
        template_action_id: actionId,
        action_label_snapshot: actionLabel,
        selected_at: new Date().toISOString()
      });
    }
    
    await updatePendingCount();

    if (isOnline) {
      debouncedSync();
    } else {
      setSyncStatus("offline");
    }

    return true;
  }, [isOnline, debouncedSync, updatePendingCount]);

  // Toggle nonconformity with offline support
  const toggleNonconformity = useCallback(async (
    itemId: string,
    ncId: string,
    ncLabel: string,
    isCurrentlySelected: boolean
  ): Promise<boolean> => {
    if (isCurrentlySelected) {
      await offlineChecklistDb.removeNonconformityLocally(itemId, ncId);
    } else {
      await offlineChecklistDb.addNonconformityLocally({
        id: crypto.randomUUID(),
        exec_item_id: itemId,
        template_nonconformity_id: ncId,
        nonconformity_label_snapshot: ncLabel,
        selected_at: new Date().toISOString()
      });
    }
    
    await updatePendingCount();

    if (isOnline) {
      debouncedSync();
    } else {
      setSyncStatus("offline");
    }

    return true;
  }, [isOnline, debouncedSync, updatePendingCount]);

  // Cache checklist data locally
  const cacheChecklistData = useCallback(async (blocks: any[]) => {
    const items: any[] = [];
    blocks?.forEach(block => {
      block.items?.forEach((item: any) => {
        items.push({
          id: item.id,
          exec_block_id: block.id,
          template_item_id: item.template_item_id,
          item_name_snapshot: item.item_name_snapshot,
          order_index: item.order_index,
          status: item.status,
          notes: item.notes,
          answered_at: item.answered_at
        });
      });
    });
    
    await offlineChecklistDb.cacheChecklistItems(items);
  }, []);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (isOnline) {
      await syncPendingChanges();
    } else {
      toast.error("Sem conexão com a internet");
    }
  }, [isOnline, syncPendingChanges]);

  // Cleanup
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
    updateItem,
    toggleAction,
    toggleNonconformity,
    cacheChecklistData,
    triggerSync,
    syncPendingChanges
  };
}
