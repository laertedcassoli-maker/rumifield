import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { offlineDb, OfflinePedido, OfflinePedidoItem } from "@/lib/offline-db";
import { supabase } from "@/integrations/supabase/client";

// Generate UUID using native crypto API
function generateId(): string {
  return crypto.randomUUID();
}

export interface PedidoComItens extends OfflinePedido {
  pedido_itens: (OfflinePedidoItem & { pecas?: { nome: string; codigo: string } })[];
  clientes?: { nome: string; fazenda?: string | null };
  solicitante?: { nome: string; email: string } | null;
}

export function useOfflinePedidos(userId?: string, viewAll = false, isAdmin = false) {
  const [isLoading, setIsLoading] = useState(true);
  const [pedidos, setPedidos] = useState<PedidoComItens[]>([]);

  // Get all offline data needed
  const offlinePedidos = useLiveQuery(() => offlineDb.pedidos.toArray(), []);
  const offlineItens = useLiveQuery(() => offlineDb.pedido_itens.toArray(), []);
  const offlineClientes = useLiveQuery(() => offlineDb.clientes.toArray(), []);
  const offlinePecas = useLiveQuery(() => offlineDb.pecas.toArray(), []);

  // Build the complete pedidos list with nested data
  useEffect(() => {
    if (offlinePedidos === undefined || offlineItens === undefined || 
        offlineClientes === undefined || offlinePecas === undefined) {
      return;
    }

    // Filter pedidos based on user and viewAll
    let filteredPedidos = offlinePedidos;
    if (!isAdmin || !viewAll) {
      filteredPedidos = offlinePedidos.filter(p => p.solicitante_id === userId);
    }

    // Build complete pedidos with nested data
    const completePedidos: PedidoComItens[] = filteredPedidos.map(pedido => {
      const cliente = offlineClientes.find(c => c.id === pedido.cliente_id);
      const itens = offlineItens
        .filter(i => i.pedido_id === pedido.id)
        .map(item => {
          const peca = offlinePecas.find(p => p.id === item.peca_id);
          return {
            ...item,
            pecas: peca ? { nome: peca.nome, codigo: peca.codigo } : undefined,
          };
        });

      return {
        ...pedido,
        clientes: cliente ? { nome: cliente.nome, fazenda: cliente.fazenda } : undefined,
        pedido_itens: itens,
      };
    });

    // Sort by created_at descending
    completePedidos.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setPedidos(completePedidos);
    setIsLoading(false);
  }, [offlinePedidos, offlineItens, offlineClientes, offlinePecas, userId, viewAll, isAdmin]);

  const createPedido = useCallback(async (
    data: {
      solicitante_id: string;
      cliente_id: string;
      observacoes?: string;
      itens: { peca_id: string; quantidade: number }[];
    }
  ) => {
    const now = new Date().toISOString();
    const pedidoId = generateId();

    // Create pedido
    const pedido: OfflinePedido = {
      id: pedidoId,
      solicitante_id: data.solicitante_id,
      cliente_id: data.cliente_id,
      status: "solicitado",
      observacoes: data.observacoes || null,
      created_at: now,
      updated_at: now,
      _pendingSync: true,
    };

    await offlineDb.pedidos.add(pedido);

    // Create itens
    const itens: OfflinePedidoItem[] = data.itens.map(item => ({
      id: generateId(),
      pedido_id: pedidoId,
      peca_id: item.peca_id,
      quantidade: item.quantidade,
      created_at: now,
      _pendingSync: true,
    }));

    await offlineDb.pedido_itens.bulkAdd(itens);

    // Add to sync queue - pedido first, then itens
    await offlineDb.addToSyncQueue("pedidos", "insert", {
      id: pedido.id,
      solicitante_id: pedido.solicitante_id,
      cliente_id: pedido.cliente_id,
      status: pedido.status,
      observacoes: pedido.observacoes,
    } as unknown as Record<string, unknown>);

    for (const item of itens) {
      await offlineDb.addToSyncQueue("pedido_itens", "insert", {
        id: item.id,
        pedido_id: item.pedido_id,
        peca_id: item.peca_id,
        quantidade: item.quantidade,
      } as unknown as Record<string, unknown>);
    }

    return pedido;
  }, []);

  const updatePedido = useCallback(async (
    pedidoId: string,
    data: {
      cliente_id: string;
      observacoes?: string;
      itens: { peca_id: string; quantidade: number }[];
    }
  ) => {
    const now = new Date().toISOString();

    // Update pedido
    await offlineDb.pedidos.update(pedidoId, {
      cliente_id: data.cliente_id,
      observacoes: data.observacoes || null,
      updated_at: now,
      _pendingSync: true,
    });

    // Delete old itens
    const oldItens = await offlineDb.pedido_itens.filter(i => i.pedido_id === pedidoId).toArray();
    for (const item of oldItens) {
      await offlineDb.pedido_itens.delete(item.id);
      // Only add delete to sync queue if item was already synced
      if (!item._pendingSync) {
        await offlineDb.addToSyncQueue("pedido_itens", "delete", { id: item.id });
      }
    }

    // Create new itens
    const newItens: OfflinePedidoItem[] = data.itens.map(item => ({
      id: generateId(),
      pedido_id: pedidoId,
      peca_id: item.peca_id,
      quantidade: item.quantidade,
      created_at: now,
      _pendingSync: true,
    }));

    await offlineDb.pedido_itens.bulkAdd(newItens);

    // Add to sync queue
    await offlineDb.addToSyncQueue("pedidos", "update", {
      id: pedidoId,
      cliente_id: data.cliente_id,
      observacoes: data.observacoes || null,
    } as unknown as Record<string, unknown>);

    for (const item of newItens) {
      await offlineDb.addToSyncQueue("pedido_itens", "insert", {
        id: item.id,
        pedido_id: item.pedido_id,
        peca_id: item.peca_id,
        quantidade: item.quantidade,
      } as unknown as Record<string, unknown>);
    }

    return offlineDb.pedidos.get(pedidoId);
  }, []);

  return {
    pedidos,
    isLoading,
    createPedido,
    updatePedido,
  };
}

// Sync pedidos from server
export async function syncPedidosFromServer(userId?: string, isAdmin = false): Promise<boolean> {
  try {
    // Fetch pedidos
    let query = supabase
      .from("pedidos")
      .select("*, clientes(nome, fazenda), pedido_itens(*, pecas(nome, codigo))")
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    // Keep pending pedidos
    const pendingPedidos = await offlineDb.pedidos.filter(p => p._pendingSync === true).toArray();
    const pendingPedidoIds = new Set(pendingPedidos.map(p => p.id));

    // Keep pending itens
    const pendingItens = await offlineDb.pedido_itens.filter(i => i._pendingSync === true).toArray();

    // Clear and repopulate
    await offlineDb.pedidos.clear();
    await offlineDb.pedido_itens.clear();

    // Add server data
    if (data) {
      for (const pedido of data) {
        // Skip if we have a pending version
        if (pendingPedidoIds.has(pedido.id)) continue;

        await offlineDb.pedidos.put({
          id: pedido.id,
          solicitante_id: pedido.solicitante_id,
          cliente_id: pedido.cliente_id,
          status: pedido.status,
          observacoes: pedido.observacoes,
          omie_pedido_id: pedido.omie_pedido_id,
          omie_nf_numero: pedido.omie_nf_numero,
          omie_data_faturamento: pedido.omie_data_faturamento,
          created_at: pedido.created_at,
          updated_at: pedido.updated_at,
          clientes: pedido.clientes,
        });

        if (pedido.pedido_itens) {
          for (const item of pedido.pedido_itens) {
            await offlineDb.pedido_itens.put({
              id: item.id,
              pedido_id: item.pedido_id,
              peca_id: item.peca_id,
              quantidade: item.quantidade,
              created_at: item.created_at,
              pecas: item.pecas,
            });
          }
        }
      }
    }

    // Re-add pending items
    await offlineDb.pedidos.bulkPut(pendingPedidos);
    await offlineDb.pedido_itens.bulkPut(pendingItens);

    await offlineDb.setLastSync("pedidos");
    return true;
  } catch (error) {
    console.error("Error syncing pedidos:", error);
    return false;
  }
}
