import { useLiveQuery } from "dexie-react-hooks";
import { useCallback } from "react";
import { offlineDb, OfflineCorretiva } from "@/lib/offline-db";

// Hook for offline corrective visits
export function useOfflineCorretivas() {
  const corretivas = useLiveQuery(
    () => offlineDb.corretivas.orderBy("created_at").reverse().toArray(),
    []
  );

  const getCorretivaById = useCallback(async (id: string) => {
    return offlineDb.corretivas.get(id);
  }, []);

  const getCorretivasByClient = useCallback(async (clientId: string) => {
    return offlineDb.corretivas
      .filter((c) => c.client_id === clientId)
      .reverse()
      .sortBy("created_at");
  }, []);

  const getCorretivasByTicket = useCallback(async (ticketId: string) => {
    return offlineDb.corretivas
      .filter((c) => c.ticket_id === ticketId)
      .reverse()
      .sortBy("created_at");
  }, []);

  const getCorretivasByTechnician = useCallback(async (technicianId: string) => {
    return offlineDb.corretivas
      .filter((c) => c.field_technician_user_id === technicianId)
      .reverse()
      .sortBy("created_at");
  }, []);

  const filterCorretivas = useCallback(
    async (filters: { status?: string }) => {
      return offlineDb.corretivas
        .filter((c) => {
          if (filters.status && filters.status !== "all" && c.status !== filters.status)
            return false;
          return true;
        })
        .reverse()
        .sortBy("created_at");
    },
    []
  );

  return {
    corretivas: corretivas || [],
    getCorretivaById,
    getCorretivasByClient,
    getCorretivasByTicket,
    getCorretivasByTechnician,
    filterCorretivas,
    isLoading: corretivas === undefined,
  };
}
