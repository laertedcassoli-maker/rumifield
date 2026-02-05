import { useLiveQuery } from "dexie-react-hooks";
import { useCallback } from "react";
import { offlineDb, OfflineRota, OfflineRotaItem } from "@/lib/offline-db";

// Hook for offline preventive routes
export function useOfflineRotas(technicianId?: string) {
  const rotas = useLiveQuery(() => {
    if (technicianId) {
      return offlineDb.rotas
        .filter((r) => r.field_technician_user_id === technicianId)
        .toArray();
    }
    return offlineDb.rotas.toArray();
  }, [technicianId]);

  const getRotaById = useCallback(async (id: string) => {
    return offlineDb.rotas.get(id);
  }, []);

  const getRotasByTechnician = useCallback(async (techId: string) => {
    return offlineDb.rotas
      .filter((r) => r.field_technician_user_id === techId)
      .toArray();
  }, []);

  const filterRotas = useCallback(
    async (filters: { status?: string; technicianId?: string }) => {
      return offlineDb.rotas
        .filter((r) => {
          if (filters.status && filters.status !== "all" && r.status !== filters.status)
            return false;
          if (filters.technicianId && filters.technicianId !== "all" && r.field_technician_user_id !== filters.technicianId)
            return false;
          return true;
        })
        .toArray();
    },
    []
  );

  return {
    rotas: rotas || [],
    getRotaById,
    getRotasByTechnician,
    filterRotas,
    isLoading: rotas === undefined,
  };
}

// Hook for offline route items
export function useOfflineRotaItems(routeId?: string) {
  const items = useLiveQuery(() => {
    if (routeId) {
      return offlineDb.rota_items
        .filter((i) => i.route_id === routeId)
        .sortBy("order_index");
    }
    return offlineDb.rota_items.toArray();
  }, [routeId]);

  const getItemsByRoute = useCallback(async (routeId: string) => {
    return offlineDb.rota_items
      .filter((i) => i.route_id === routeId)
      .sortBy("order_index");
  }, []);

  const getItemById = useCallback(async (id: string) => {
    return offlineDb.rota_items.get(id);
  }, []);

  return {
    items: items || [],
    getItemsByRoute,
    getItemById,
    isLoading: items === undefined,
  };
}
