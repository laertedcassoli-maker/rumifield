import { useLiveQuery } from "dexie-react-hooks";
import { useCallback } from "react";
import { offlineDb, OfflineVisita, OfflineEstoque } from "@/lib/offline-db";

// Generate UUID using native crypto API
function generateId(): string {
  return crypto.randomUUID();
}

// Hook for offline clientes
export function useOfflineClientes() {
  const clientes = useLiveQuery(() => offlineDb.clientes.toArray(), []);
  
  const getClienteById = useCallback(async (id: string) => {
    return offlineDb.clientes.get(id);
  }, []);
  
  const searchClientes = useCallback(async (query: string) => {
    const lowerQuery = query.toLowerCase();
    return offlineDb.clientes
      .filter(c => 
        c.nome.toLowerCase().includes(lowerQuery) ||
        (c.fazenda?.toLowerCase().includes(lowerQuery) ?? false) ||
        (c.cidade?.toLowerCase().includes(lowerQuery) ?? false)
      )
      .toArray();
  }, []);
  
  return {
    clientes: clientes || [],
    getClienteById,
    searchClientes,
    isLoading: clientes === undefined,
  };
}

// Hook for offline peças
export function useOfflinePecas() {
  const pecas = useLiveQuery(() => 
    offlineDb.pecas.filter(p => p.ativo !== false).toArray(), 
    []
  );
  
  const getPecaById = useCallback(async (id: string) => {
    return offlineDb.pecas.get(id);
  }, []);
  
  const searchPecas = useCallback(async (query: string) => {
    const lowerQuery = query.toLowerCase();
    return offlineDb.pecas
      .filter(p => 
        p.ativo !== false && (
          p.nome.toLowerCase().includes(lowerQuery) ||
          p.codigo.toLowerCase().includes(lowerQuery)
        )
      )
      .toArray();
  }, []);
  
  return {
    pecas: pecas || [],
    getPecaById,
    searchPecas,
    isLoading: pecas === undefined,
  };
}

// Hook for offline produtos químicos
export function useOfflineProdutosQuimicos() {
  const produtos = useLiveQuery(() => 
    offlineDb.produtos_quimicos.filter(p => p.ativo !== false).toArray(), 
    []
  );
  
  return {
    produtos: produtos || [],
    isLoading: produtos === undefined,
  };
}

// Hook for offline visitas with write capability
export function useOfflineVisitas(tecnicoId?: string) {
  const visitas = useLiveQuery(() => {
    if (tecnicoId) {
      return offlineDb.visitas
        .filter(v => v.tecnico_id === tecnicoId)
        .reverse()
        .sortBy("data_visita");
    }
    return offlineDb.visitas.reverse().sortBy("data_visita");
  }, [tecnicoId]);
  
  const getVisitaById = useCallback(async (id: string) => {
    return offlineDb.visitas.get(id);
  }, []);
  
  const getVisitasByCliente = useCallback(async (clienteId: string) => {
    return offlineDb.visitas
      .filter(v => v.cliente_id === clienteId)
      .reverse()
      .sortBy("data_visita");
  }, []);
  
  const createVisita = useCallback(async (
    data: Omit<OfflineVisita, "id" | "created_at" | "updated_at" | "_pendingSync">
  ) => {
    const now = new Date().toISOString();
    const visita: OfflineVisita = {
      ...data,
      id: generateId(),
      created_at: now,
      updated_at: now,
      sincronizado: false,
      _pendingSync: true,
    };
    
    await offlineDb.visitas.add(visita);
    
    // Add to sync queue
    await offlineDb.addToSyncQueue("visitas", "insert", { ...visita } as unknown as Record<string, unknown>);
    
    return visita;
  }, []);
  
  const updateVisita = useCallback(async (id: string, data: Partial<OfflineVisita>) => {
    const updated = {
      ...data,
      updated_at: new Date().toISOString(),
      _pendingSync: true,
    };
    
    await offlineDb.visitas.update(id, updated);
    
    // Add to sync queue
    await offlineDb.addToSyncQueue("visitas", "update", { id, ...data });
    
    return offlineDb.visitas.get(id);
  }, []);
  
  const deleteVisita = useCallback(async (id: string) => {
    const visita = await offlineDb.visitas.get(id);
    
    if (visita) {
      await offlineDb.visitas.delete(id);
      
      // Only add to sync queue if it was already synced
      if (!visita._pendingSync) {
        await offlineDb.addToSyncQueue("visitas", "delete", { id });
      }
    }
  }, []);
  
  return {
    visitas: visitas || [],
    getVisitaById,
    getVisitasByCliente,
    createVisita,
    updateVisita,
    deleteVisita,
    isLoading: visitas === undefined,
  };
}

// Hook for offline estoque with write capability
export function useOfflineEstoque(clienteId?: string) {
  const estoque = useLiveQuery(() => {
    if (clienteId) {
      return offlineDb.estoque
        .filter(e => e.cliente_id === clienteId)
        .toArray();
    }
    return offlineDb.estoque.toArray();
  }, [clienteId]);
  
  const getEstoqueByClienteAndProduto = useCallback(async (clienteId: string, produtoId: string) => {
    return offlineDb.estoque
      .filter(e => e.cliente_id === clienteId && e.produto_id === produtoId)
      .first();
  }, []);
  
  const createEstoque = useCallback(async (
    data: Omit<OfflineEstoque, "id" | "data_atualizacao" | "_pendingSync">
  ) => {
    const now = new Date().toISOString();
    const estoque: OfflineEstoque = {
      ...data,
      id: generateId(),
      data_atualizacao: now,
      _pendingSync: true,
    };
    
    await offlineDb.estoque.add(estoque);
    
    // Add to sync queue
    await offlineDb.addToSyncQueue("estoque", "insert", { ...estoque } as unknown as Record<string, unknown>);
    
    return estoque;
  }, []);
  
  const updateEstoque = useCallback(async (id: string, data: Partial<OfflineEstoque>) => {
    const updated = {
      ...data,
      data_atualizacao: new Date().toISOString(),
      _pendingSync: true,
    };
    
    await offlineDb.estoque.update(id, updated);
    
    // Add to sync queue
    await offlineDb.addToSyncQueue("estoque", "update", { id, ...data });
    
    return offlineDb.estoque.get(id);
  }, []);
  
  return {
    estoque: estoque || [],
    getEstoqueByClienteAndProduto,
    createEstoque,
    updateEstoque,
    isLoading: estoque === undefined,
  };
}

// Hook for pending sync items count
export function usePendingSyncCount() {
  const count = useLiveQuery(async () => {
    const items = await offlineDb.getPendingSyncItems();
    return items.length;
  }, []);
  
  return count || 0;
}
