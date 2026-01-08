import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineDb, SyncQueueItem } from "@/lib/offline-db";
import { syncPedidosFromServer } from "@/hooks/useOfflinePedidos";
import { toast } from "sonner";

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      syncAll();
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
    const items = await offlineDb.getPendingSyncItems();
    setPendingCount(items.length);
  }, []);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // Sync a single table from server to local
  const syncTableFromServer = useCallback(async (table: string) => {
    try {
      let data;
      
      switch (table) {
        case "clientes": {
          const result = await supabase.from("clientes").select("*");
          if (result.error) throw result.error;
          data = result.data;
          await offlineDb.clientes.clear();
          await offlineDb.clientes.bulkPut(data || []);
          break;
        }
        case "pecas": {
          const result = await supabase.from("pecas").select("*").eq("ativo", true);
          if (result.error) throw result.error;
          data = result.data;
          await offlineDb.pecas.clear();
          await offlineDb.pecas.bulkPut(data || []);
          break;
        }
        case "produtos_quimicos": {
          const result = await supabase.from("produtos_quimicos").select("*").eq("ativo", true);
          if (result.error) throw result.error;
          data = result.data;
          await offlineDb.produtos_quimicos.clear();
          await offlineDb.produtos_quimicos.bulkPut(data || []);
          break;
        }
        case "visitas": {
          const result = await supabase.from("visitas").select("*").order("data_visita", { ascending: false }).limit(500);
          if (result.error) throw result.error;
          data = result.data;
          // Only replace synced visitas, keep pending ones
          const pendingVisitas = await offlineDb.visitas.filter(v => v._pendingSync === true).toArray();
          await offlineDb.visitas.clear();
          await offlineDb.visitas.bulkPut([...(data || []), ...pendingVisitas]);
          break;
        }
        case "estoque": {
          const result = await supabase.from("estoque_cliente").select("*");
          if (result.error) throw result.error;
          data = result.data;
          // Only replace synced estoque, keep pending ones
          const pendingEstoque = await offlineDb.estoque.filter(e => e._pendingSync === true).toArray();
          await offlineDb.estoque.clear();
          await offlineDb.estoque.bulkPut([...(data || []), ...pendingEstoque]);
          break;
        }
        case "pedidos": {
          // Use dedicated sync function for pedidos
          return await syncPedidosFromServer();
        }
      }
      
      await offlineDb.setLastSync(table);
      return true;
    } catch (error) {
      console.error(`Error syncing ${table}:`, error);
      return false;
    }
  }, []);

  // Process pending sync queue
  const processSyncQueue = useCallback(async () => {
    const items = await offlineDb.getPendingSyncItems();
    
    for (const item of items) {
      try {
        await processSyncItem(item);
        await offlineDb.removeSyncItem(item.id!);
      } catch (error) {
        console.error("Error processing sync item:", error);
        await offlineDb.incrementRetryCount(item.id!);
        
        // Remove if too many retries
        if (item.retryCount >= 5) {
          await offlineDb.removeSyncItem(item.id!);
          toast.error("Falha ao sincronizar item após várias tentativas");
        }
      }
    }
    
    await updatePendingCount();
  }, [updatePendingCount]);

  // Process a single sync item
  const processSyncItem = async (item: SyncQueueItem) => {
    const { table, operation, data } = item;
    
    switch (operation) {
      case "insert": {
        const tableName = table === "estoque" ? "estoque_cliente" : table;
        // Remove offline-specific fields
        const cleanData = { ...data };
        delete cleanData._pendingSync;
        delete cleanData._localId;
        
        if (tableName === "visitas") {
          const result = await supabase.from("visitas").insert(cleanData as never);
          if (result.error) throw result.error;
        } else if (tableName === "estoque_cliente") {
          const result = await supabase.from("estoque_cliente").insert(cleanData as never);
          if (result.error) throw result.error;
        } else if (tableName === "pedidos") {
          const result = await supabase.from("pedidos").insert(cleanData as never);
          if (result.error) throw result.error;
        } else if (tableName === "pedido_itens") {
          const result = await supabase.from("pedido_itens").insert(cleanData as never);
          if (result.error) throw result.error;
        }
        
        // Update local record to mark as synced
        if (table === "visitas" && data.id) {
          await offlineDb.visitas.update(data.id as string, { _pendingSync: false, sincronizado: true });
        } else if (table === "estoque" && data.id) {
          await offlineDb.estoque.update(data.id as string, { _pendingSync: false });
        } else if (table === "pedidos" && data.id) {
          await offlineDb.pedidos.update(data.id as string, { _pendingSync: false });
        } else if (table === "pedido_itens" && data.id) {
          await offlineDb.pedido_itens.update(data.id as string, { _pendingSync: false });
        }
        break;
      }
      case "update": {
        const tableName = table === "estoque" ? "estoque_cliente" : table;
        const cleanData = { ...data };
        delete cleanData._pendingSync;
        delete cleanData._localId;
        const id = cleanData.id as string;
        delete cleanData.id;
        
        if (tableName === "visitas") {
          const result = await supabase.from("visitas").update(cleanData as never).eq("id", id);
          if (result.error) throw result.error;
        } else if (tableName === "estoque_cliente") {
          const result = await supabase.from("estoque_cliente").update(cleanData as never).eq("id", id);
          if (result.error) throw result.error;
        } else if (tableName === "pedidos") {
          const result = await supabase.from("pedidos").update(cleanData as never).eq("id", id);
          if (result.error) throw result.error;
        }
        break;
      }
      case "delete": {
        const tableName = table === "estoque" ? "estoque_cliente" : table;
        const id = data.id as string;
        if (tableName === "visitas") {
          const result = await supabase.from("visitas").delete().eq("id", id);
          if (result.error) throw result.error;
        } else if (tableName === "estoque_cliente") {
          const result = await supabase.from("estoque_cliente").delete().eq("id", id);
          if (result.error) throw result.error;
        } else if (tableName === "pedido_itens") {
          const result = await supabase.from("pedido_itens").delete().eq("id", id);
          if (result.error) throw result.error;
        }
        break;
      }
    }
  };

  // Sync all tables
  const syncAll = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return;
    }

    setSyncStatus("syncing");
    
    try {
      // First, push pending changes
      await processSyncQueue();
      
      // Then, pull latest data from server
      const tables = ["clientes", "pecas", "produtos_quimicos", "visitas", "estoque", "pedidos"];
      const results = await Promise.all(tables.map(syncTableFromServer));
      
      if (results.every(Boolean)) {
        setSyncStatus("idle");
        setLastSyncTime(new Date());
        toast.success("Dados sincronizados!");
      } else {
        setSyncStatus("error");
        toast.error("Erro ao sincronizar alguns dados");
      }
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus("error");
      toast.error("Erro na sincronização");
    }
  }, [processSyncQueue, syncTableFromServer]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (isOnline) {
      await syncAll();
    } else {
      toast.error("Sem conexão com a internet");
    }
  }, [isOnline, syncAll]);

  return {
    isOnline,
    syncStatus,
    pendingCount,
    lastSyncTime,
    syncAll,
    triggerSync,
    updatePendingCount,
  };
}
