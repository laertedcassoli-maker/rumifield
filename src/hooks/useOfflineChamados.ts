import { useLiveQuery } from "dexie-react-hooks";
import { useCallback } from "react";
import { offlineDb, OfflineChamado } from "@/lib/offline-db";

// Hook for offline chamados (technical tickets)
export function useOfflineChamados() {
  const chamados = useLiveQuery(
    () => offlineDb.chamados.orderBy("created_at").reverse().toArray(),
    []
  );

  const getChamadoById = useCallback(async (id: string) => {
    return offlineDb.chamados.get(id);
  }, []);

  const getChamadosByClient = useCallback(async (clientId: string) => {
    return offlineDb.chamados
      .filter((c) => c.client_id === clientId)
      .reverse()
      .sortBy("created_at");
  }, []);

  const searchChamados = useCallback(async (query: string) => {
    const lowerQuery = query.toLowerCase();
    return offlineDb.chamados
      .filter(
        (c) =>
          c.ticket_code.toLowerCase().includes(lowerQuery) ||
          c.title.toLowerCase().includes(lowerQuery) ||
          (c.client_name?.toLowerCase().includes(lowerQuery) ?? false) ||
          (c.client_fazenda?.toLowerCase().includes(lowerQuery) ?? false)
      )
      .toArray();
  }, []);

  const filterChamados = useCallback(
    async (filters: { status?: string; priority?: string }) => {
      return offlineDb.chamados
        .filter((c) => {
          if (filters.status && filters.status !== "all" && c.status !== filters.status)
            return false;
          if (filters.priority && filters.priority !== "all" && c.priority !== filters.priority)
            return false;
          return true;
        })
        .reverse()
        .sortBy("created_at");
    },
    []
  );

  return {
    chamados: chamados || [],
    getChamadoById,
    getChamadosByClient,
    searchChamados,
    filterChamados,
    isLoading: chamados === undefined,
  };
}
