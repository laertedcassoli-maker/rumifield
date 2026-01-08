import Dexie, { Table } from "dexie";

// Types for offline data
export interface OfflineCliente {
  id: string;
  nome: string;
  fazenda?: string | null;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  email?: string | null;
  status: string;
  ordenhas_dia?: number | null;
  data_ativacao_rumiflow?: string | null;
  cod_imilk?: string | null;
  omie_codigo?: string | null;
  observacoes?: string | null;
  endereco?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfflinePeca {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  ativo?: boolean | null;
  omie_codigo?: string | null;
  created_at: string;
}

export interface OfflineProdutoQuimico {
  id: string;
  nome: string;
  unidade: string;
  descricao?: string | null;
  ativo?: boolean | null;
  litros_por_vaca_mes?: number | null;
  litros_por_vaca_2x?: number | null;
  litros_por_vaca_3x?: number | null;
  created_at: string;
}

export interface OfflineVisita {
  id: string;
  tecnico_id: string;
  cliente_id: string;
  data_visita: string;
  descricao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sincronizado?: boolean | null;
  created_at: string;
  updated_at: string;
  // Offline-specific fields
  _pendingSync?: boolean;
  _localId?: string;
}

export interface OfflineEstoque {
  id: string;
  cliente_id: string;
  produto_id: string;
  quantidade: number;
  galoes_cheios: number;
  nivel_galao_parcial?: number | null;
  data_afericao: string;
  vacas_lactacao?: number | null;
  responsavel: string;
  observacoes?: string | null;
  atualizado_por?: string | null;
  data_atualizacao: string;
  // Offline-specific fields
  _pendingSync?: boolean;
  _localId?: string;
}

export interface OfflinePedido {
  id: string;
  solicitante_id: string;
  cliente_id: string;
  status: string;
  observacoes?: string | null;
  omie_pedido_id?: string | null;
  omie_nf_numero?: string | null;
  omie_data_faturamento?: string | null;
  created_at: string;
  updated_at: string;
  // Offline-specific fields
  _pendingSync?: boolean;
  // Nested data for display (not synced)
  clientes?: { nome: string; fazenda?: string | null };
  pedido_itens?: OfflinePedidoItem[];
}

export interface OfflinePedidoItem {
  id: string;
  pedido_id: string;
  peca_id: string;
  quantidade: number;
  created_at: string;
  // Offline-specific fields
  _pendingSync?: boolean;
  // Nested data for display
  pecas?: { nome: string; codigo: string };
}

export interface SyncQueueItem {
  id?: number;
  table: string;
  operation: "insert" | "update" | "delete";
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

export interface SyncMeta {
  id: string;
  table: string;
  lastSync: string;
}

class OfflineDatabase extends Dexie {
  clientes!: Table<OfflineCliente, string>;
  pecas!: Table<OfflinePeca, string>;
  produtos_quimicos!: Table<OfflineProdutoQuimico, string>;
  visitas!: Table<OfflineVisita, string>;
  estoque!: Table<OfflineEstoque, string>;
  pedidos!: Table<OfflinePedido, string>;
  pedido_itens!: Table<OfflinePedidoItem, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super("RumiFieldDB");

    this.version(2).stores({
      clientes: "id, nome, status, cidade, estado",
      pecas: "id, codigo, nome, ativo",
      produtos_quimicos: "id, nome, ativo",
      visitas: "id, tecnico_id, cliente_id, data_visita, _pendingSync",
      estoque: "id, cliente_id, produto_id, data_afericao, _pendingSync",
      pedidos: "id, solicitante_id, cliente_id, status, created_at, _pendingSync",
      pedido_itens: "id, pedido_id, peca_id, _pendingSync",
      syncQueue: "++id, table, operation, createdAt",
      syncMeta: "id, table, lastSync",
    });
  }

  // Clear all offline data
  async clearAll() {
    await this.clientes.clear();
    await this.pecas.clear();
    await this.produtos_quimicos.clear();
    await this.visitas.clear();
    await this.estoque.clear();
    await this.pedidos.clear();
    await this.pedido_itens.clear();
    await this.syncQueue.clear();
    await this.syncMeta.clear();
  }

  // Get last sync time for a table
  async getLastSync(table: string): Promise<Date | null> {
    const meta = await this.syncMeta.get(table);
    return meta ? new Date(meta.lastSync) : null;
  }

  // Update last sync time for a table
  async setLastSync(table: string): Promise<void> {
    await this.syncMeta.put({
      id: table,
      table,
      lastSync: new Date().toISOString(),
    });
  }

  // Add item to sync queue
  async addToSyncQueue(
    table: string,
    operation: "insert" | "update" | "delete",
    data: Record<string, unknown>
  ): Promise<void> {
    await this.syncQueue.add({
      table,
      operation,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
  }

  // Get pending sync items
  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    return this.syncQueue.toArray();
  }

  // Remove sync item after successful sync
  async removeSyncItem(id: number): Promise<void> {
    await this.syncQueue.delete(id);
  }

  // Increment retry count
  async incrementRetryCount(id: number): Promise<void> {
    const item = await this.syncQueue.get(id);
    if (item) {
      await this.syncQueue.update(id, { retryCount: item.retryCount + 1 });
    }
  }
}

export const offlineDb = new OfflineDatabase();
