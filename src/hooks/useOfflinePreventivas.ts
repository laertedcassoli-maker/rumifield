import { useLiveQuery } from "dexie-react-hooks";
import { useCallback } from "react";
import { offlineDb, OfflinePreventiva } from "@/lib/offline-db";

// Hook for offline preventive maintenance
export function useOfflinePreventivas() {
  const preventivas = useLiveQuery(
    () => offlineDb.preventivas.orderBy("scheduled_date").reverse().toArray(),
    []
  );

  const getPreventivaById = useCallback(async (id: string) => {
    return offlineDb.preventivas.get(id);
  }, []);

  const getPreventivasByClient = useCallback(async (clientId: string) => {
    return offlineDb.preventivas
      .filter((p) => p.client_id === clientId)
      .reverse()
      .sortBy("scheduled_date");
  }, []);

  const getPreventivasByTechnician = useCallback(async (technicianId: string) => {
    return offlineDb.preventivas
      .filter((p) => p.technician_user_id === technicianId)
      .reverse()
      .sortBy("scheduled_date");
  }, []);

  const filterPreventivas = useCallback(
    async (filters: { status?: string; routeId?: string }) => {
      return offlineDb.preventivas
        .filter((p) => {
          if (filters.status && filters.status !== "all" && p.status !== filters.status)
            return false;
          if (filters.routeId && p.route_id !== filters.routeId)
            return false;
          return true;
        })
        .reverse()
        .sortBy("scheduled_date");
    },
    []
  );

  return {
    preventivas: preventivas || [],
    getPreventivaById,
    getPreventivasByClient,
    getPreventivasByTechnician,
    filterPreventivas,
    isLoading: preventivas === undefined,
  };
}
