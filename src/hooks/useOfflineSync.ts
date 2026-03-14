import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineDb, SyncQueueItem } from "@/lib/offline-db";
import { offlineChecklistDb } from "@/lib/offline-checklist-db";
import { syncPedidosFromServer } from "@/hooks/useOfflinePedidos";
import { toast } from "sonner";

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Ref to hold the latest syncAll function
  const syncAllRef = useRef<() => Promise<void>>();
  const isOnlineRef = useRef(isOnline);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      isOnlineRef.current = true;
      // Auto-sync when coming back online
      if (syncAllRef.current) {
        syncAllRef.current();
      }
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
          if (data?.length) {
            await offlineDb.clientes.bulkPut(data);
          }
          break;
        }
        case "pecas": {
          const result = await supabase.from("pecas").select("*").eq("ativo", true);
          if (result.error) throw result.error;
          data = result.data;
          if (data?.length) {
            await offlineDb.pecas.bulkPut(data);
          }
          break;
        }
        case "produtos_quimicos": {
          const result = await supabase.from("produtos_quimicos").select("*").eq("ativo", true);
          if (result.error) throw result.error;
          data = result.data;
          if (data?.length) {
            await offlineDb.produtos_quimicos.bulkPut(data);
          }
          break;
        }
        case "visitas": {
          const result = await supabase.from("visitas").select("*").order("data_visita", { ascending: false }).limit(500);
          if (result.error) throw result.error;
          data = result.data;
          // Only replace synced visitas, keep pending ones
          if (data?.length) {
            await offlineDb.visitas.bulkPut(data);
          }
          break;
        }
        case "estoque": {
          const result = await supabase.from("estoque_cliente").select("*");
          if (result.error) throw result.error;
          data = result.data;
          // Only replace synced estoque, keep pending ones
          if (data?.length) {
            await offlineDb.estoque.bulkPut(data);
          }
          break;
        }
        case "pedidos": {
          // Use dedicated sync function for pedidos
          return await syncPedidosFromServer();
        }
        case "chamados": {
          // Fetch chamados with client/technician info
          const result = await supabase
            .from("technical_tickets")
            .select("id, ticket_code, title, description, priority, status, client_id, assigned_technician_id, created_at, resolved_at, updated_at")
            .order("created_at", { ascending: false })
            .limit(200);
          if (result.error) throw result.error;
          
          if (result.data?.length) {
            const clientIds = [...new Set(result.data.map(t => t.client_id))];
            const techIds = [...new Set(result.data.map(t => t.assigned_technician_id).filter(Boolean))] as string[];
            
            const [clientsRes, profilesRes] = await Promise.all([
              supabase.from("clientes").select("id, nome, fazenda").in("id", clientIds),
              techIds.length > 0 ? supabase.from("profiles").select("id, nome").in("id", techIds) : Promise.resolve({ data: [] as { id: string; nome: string }[] })
            ]);
            
            const clientsMap = new Map<string, { id: string; nome: string; fazenda: string | null }>(
              (clientsRes.data || []).map(c => [c.id, c])
            );
            const profilesMap = new Map<string, string>(
              (profilesRes.data || []).map(p => [p.id, p.nome])
            );
            
            const enriched = result.data.map(ticket => ({
              ...ticket,
              client_name: clientsMap.get(ticket.client_id)?.nome || "Cliente não encontrado",
              client_fazenda: clientsMap.get(ticket.client_id)?.fazenda || null,
              technician_name: ticket.assigned_technician_id ? (profilesMap.get(ticket.assigned_technician_id) || null) : null,
            }));
            
            await offlineDb.chamados.bulkPut(enriched as any);
          }
          break;
        }
        case "preventivas": {
          const result = await supabase
            .from("preventive_maintenance")
            .select("id, client_id, scheduled_date, completed_date, status, notes, internal_notes, public_notes, public_token, route_id, technician_user_id, created_at, updated_at")
            .order("scheduled_date", { ascending: false })
            .limit(300);
          if (result.error) throw result.error;
          
          if (result.data?.length) {
            const clientIds = [...new Set(result.data.map(p => p.client_id))];
            const techIds = [...new Set(result.data.map(p => p.technician_user_id).filter(Boolean))] as string[];
            
            const [clientsRes, profilesRes] = await Promise.all([
              supabase.from("clientes").select("id, nome, fazenda").in("id", clientIds),
              techIds.length > 0 ? supabase.from("profiles").select("id, nome").in("id", techIds) : Promise.resolve({ data: [] as { id: string; nome: string }[] })
            ]);
            
            const clientsMap = new Map<string, { id: string; nome: string; fazenda: string | null }>(
              (clientsRes.data || []).map(c => [c.id, c])
            );
            const profilesMap = new Map<string, string>(
              (profilesRes.data || []).map(p => [p.id, p.nome])
            );
            
            const enriched = result.data.map(p => ({
              ...p,
              client_name: clientsMap.get(p.client_id)?.nome || "Cliente não encontrado",
              client_fazenda: clientsMap.get(p.client_id)?.fazenda || null,
              technician_name: p.technician_user_id ? (profilesMap.get(p.technician_user_id) || null) : null,
            }));
            
            await offlineDb.preventivas.bulkPut(enriched as any);
          }
          break;
        }
        case "checklists": {
          let preventiveIds: string[] = [];
          
          // Try local cache first
          const cachedPreventivas = await offlineDb.preventivas.toArray();
          
          if (cachedPreventivas.length > 0) {
            preventiveIds = cachedPreventivas.map(p => p.id);
          } else {
            // Fallback: fetch IDs from server if cache is still empty
            const { data: serverPreventivas } = await supabase
              .from('preventive_maintenance')
              .select('id')
              .limit(200);
            preventiveIds = (serverPreventivas || []).map(p => p.id);
          }
          
          if (preventiveIds.length === 0) break;

          const batchSize = 50;
          for (let i = 0; i < preventiveIds.length; i += batchSize) {
            const batch = preventiveIds.slice(i, i + batchSize);
            
            const { data, error } = await supabase
              .from('preventive_checklists')
              .select(`
                *,
                template:checklist_templates(name),
                blocks:preventive_checklist_blocks(
                  id, block_name_snapshot, order_index,
                  items:preventive_checklist_items(
                    id, item_name_snapshot, order_index, status, notes, answered_at, template_item_id,
                    selected_actions:preventive_checklist_item_actions(id, template_action_id, action_label_snapshot),
                    selected_nonconformities:preventive_checklist_item_nonconformities(id, template_nonconformity_id, nonconformity_label_snapshot)
                  )
                )
              `)
              .in('preventive_id', batch);
            
            if (error) throw error;
            
            for (const checklist of data || []) {
              await offlineChecklistDb.cacheFullChecklist(checklist);
            }
          }
          break;
        }
        case "corretivas": {
          const result = await supabase
            .from("ticket_visits")
            .select(`
              id, visit_code, ticket_id, client_id, status, planned_start_date, 
              checkin_at, checkin_lat, checkin_lon, checkout_at, 
              field_technician_user_id, created_at, updated_at,
              corrective_maintenance(public_token)
            `)
            .order("created_at", { ascending: false })
            .limit(200);
          if (result.error) throw result.error;
          
          if (result.data?.length) {
            const ticketIds = [...new Set(result.data.map(v => v.ticket_id))];
            const clientIds = [...new Set(result.data.map(v => v.client_id).filter(Boolean))] as string[];
            const techIds = [...new Set(result.data.map(v => v.field_technician_user_id).filter(Boolean))] as string[];
            
            const [ticketsRes, clientsRes, profilesRes] = await Promise.all([
              supabase.from("technical_tickets").select("id, ticket_code, title").in("id", ticketIds),
              clientIds.length > 0 ? supabase.from("clientes").select("id, nome, fazenda").in("id", clientIds) : Promise.resolve({ data: [] as { id: string; nome: string; fazenda: string | null }[] }),
              techIds.length > 0 ? supabase.from("profiles").select("id, nome").in("id", techIds) : Promise.resolve({ data: [] as { id: string; nome: string }[] })
            ]);
            
            const ticketsMap = new Map<string, { id: string; ticket_code: string; title: string }>(
              (ticketsRes.data || []).map(t => [t.id, t])
            );
            const clientsMap = new Map<string, { id: string; nome: string; fazenda: string | null }>(
              (clientsRes.data || []).map(c => [c.id, c])
            );
            const profilesMap = new Map<string, string>(
              (profilesRes.data || []).map(p => [p.id, p.nome])
            );
            
            const enriched = result.data.map(v => {
              const cmData = v.corrective_maintenance as { public_token: string | null } | null;
              return {
                id: v.id,
                visit_code: v.visit_code,
                ticket_id: v.ticket_id,
                client_id: v.client_id || "",
                status: v.status,
                planned_start_date: v.planned_start_date,
                checkin_at: v.checkin_at,
                checkin_lat: v.checkin_lat,
                checkin_lon: v.checkin_lon,
                checkout_at: v.checkout_at,
                field_technician_user_id: v.field_technician_user_id,
                notes: null,
                created_at: v.created_at,
                updated_at: v.updated_at,
                ticket_code: ticketsMap.get(v.ticket_id)?.ticket_code || "",
                ticket_title: ticketsMap.get(v.ticket_id)?.title || "",
                client_name: v.client_id ? (clientsMap.get(v.client_id)?.nome || "Cliente não encontrado") : "",
                client_fazenda: v.client_id ? (clientsMap.get(v.client_id)?.fazenda || null) : null,
                technician_name: v.field_technician_user_id ? (profilesMap.get(v.field_technician_user_id) || null) : null,
                public_token: cmData?.public_token || null,
              };
            });
            
            await offlineDb.corretivas.bulkPut(enriched as any);
          }
          break;
        }
        case "rotas": {
          const result = await supabase
            .from("preventive_routes")
            .select("id, route_code, start_date, end_date, status, checklist_template_id, field_technician_user_id, notes, created_at, updated_at")
            .in("status", ["planejada", "em_execucao", "finalizada"])
            .order("start_date", { ascending: false })
            .limit(100);
          if (result.error) throw result.error;
          
          if (result.data?.length) {
            const routeIds = result.data.map(r => r.id);
            const techIds = [...new Set(result.data.map(r => r.field_technician_user_id).filter(Boolean))] as string[];
            
            const [itemsRes, profilesRes] = await Promise.all([
              supabase.from("preventive_route_items").select("route_id, status").in("route_id", routeIds),
              techIds.length > 0 ? supabase.from("profiles").select("id, nome").in("id", techIds) : Promise.resolve({ data: [] as { id: string; nome: string }[] })
            ]);
            
            const profilesMap = new Map<string, string>(
              (profilesRes.data || []).map(p => [p.id, p.nome])
            );
            
            // Count farms per route
            const countsMap = new Map<string, { total: number; executed: number }>();
            routeIds.forEach(id => countsMap.set(id, { total: 0, executed: 0 }));
            if (!itemsRes.error) {
              itemsRes.data?.forEach(item => {
                const counts = countsMap.get(item.route_id);
                if (counts) {
                  counts.total += 1;
                  if (item.status === "executado") counts.executed += 1;
                }
              });
            }
            
            const enriched = result.data.map(r => ({
              ...r,
              technician_name: profilesMap.get(r.field_technician_user_id) || null,
              total_farms: countsMap.get(r.id)?.total || 0,
              executed_farms: countsMap.get(r.id)?.executed || 0,
            }));
            
            await offlineDb.rotas.bulkPut(enriched as any);
          }
          break;
        }
        case "rota_items": {
          const result = await supabase
            .from("preventive_route_items")
            .select("id, route_id, client_id, order_index, planned_date, status, checkin_at, checkin_lat, checkin_lon, suggested_reason, created_at, updated_at")
            .order("order_index");
          if (result.error) throw result.error;
          
          if (result.data?.length) {
            const clientIds = [...new Set(result.data.map(i => i.client_id))];
            
            const clientsRes = await supabase.from("clientes").select("id, nome, fazenda, latitude, longitude, cidade, estado, link_maps").in("id", clientIds);
            const clientsMap = new Map<string, { id: string; nome: string; fazenda: string | null; latitude: number | null; longitude: number | null; cidade: string | null; estado: string | null; link_maps: string | null }>(
              (clientsRes.data || []).map(c => [c.id, c])
            );
            
            const enriched = result.data.map(i => ({
              ...i,
              client_name: clientsMap.get(i.client_id)?.nome || "Cliente não encontrado",
              client_fazenda: clientsMap.get(i.client_id)?.fazenda || null,
              client_lat: clientsMap.get(i.client_id)?.latitude || null,
              client_lon: clientsMap.get(i.client_id)?.longitude || null,
              client_cidade: clientsMap.get(i.client_id)?.cidade || null,
              client_estado: clientsMap.get(i.client_id)?.estado || null,
              client_link_maps: clientsMap.get(i.client_id)?.link_maps || null,
            }));
            
            await offlineDb.rota_items.bulkPut(enriched as any);
          }
          break;
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
        } else if (tableName === "preventive_route_items") {
          const result = await supabase.from("preventive_route_items").update(cleanData as never).eq("id", id);
          if (result.error) {
            // Treat duplicate key as success
            if ((result.error as any).code !== '23505') throw result.error;
          }
        } else if (tableName === "preventive_routes") {
          const result = await supabase.from("preventive_routes").update(cleanData as never).eq("id", id);
          if (result.error) {
            if ((result.error as any).code !== '23505') throw result.error;
          }
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

    // Handle special composite operations
    if (table === "preventive_maintenance_cancel" && operation === "insert") {
      const { client_id, route_id, scheduled_date, status, notes, technician_user_id } = data;
      
      const { data: existingMaint } = await supabase
        .from("preventive_maintenance")
        .select("id")
        .eq("client_id", client_id as string)
        .eq("route_id", route_id as string)
        .maybeSingle();

      if (existingMaint) {
        await supabase
          .from("preventive_maintenance")
          .update({ status: status as "cancelada" | "concluida" | "planejada", notes: notes as string, updated_at: new Date().toISOString() })
          .eq("id", existingMaint.id);
      } else {
        const insertResult = await supabase
          .from("preventive_maintenance")
          .insert({
            client_id,
            route_id,
            scheduled_date,
            status,
            notes,
            technician_user_id,
          } as never);
        if (insertResult.error && (insertResult.error as any).code !== '23505') {
          throw insertResult.error;
        }
      }
    }
  };

  // Sync all tables
  const syncAll = useCallback(async () => {
    if (!isOnlineRef.current) {
      setSyncStatus("offline");
      return;
    }

    setSyncStatus("syncing");
    
    try {
      // First, push pending changes
      await processSyncQueue();
      
      // Then, pull latest data from server
      const tables = [
        "clientes", 
        "pecas", 
        "produtos_quimicos", 
        "visitas", 
        "estoque", 
        "pedidos",
        "chamados",
        "preventivas",
        "checklists",
        "corretivas",
        "rotas",
        "rota_items"
      ];
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

  // Keep ref updated with latest syncAll
  useEffect(() => {
    syncAllRef.current = syncAll;
  }, [syncAll]);

  // Process pending sync queue on mount (handles items from previous sessions)
  useEffect(() => {
    const processPendingOnMount = async () => {
      if (navigator.onLine) {
        const pendingChecklist = await offlineChecklistDb.getPendingSyncItems();
        const pendingMain = await offlineDb.getPendingSyncItems();
        
        if (pendingChecklist.length > 0 || pendingMain.length > 0) {
          console.log(`[Sync] Processando ${pendingChecklist.length + pendingMain.length} itens pendentes de sessão anterior`);
          await processSyncQueue();
        }
      }
    };
    
    const timer = setTimeout(processPendingOnMount, 1000);
    return () => clearTimeout(timer);
  }, []); // Run only on mount

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
