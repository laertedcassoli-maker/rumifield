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
  link_maps?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  quantidade_pistolas?: number | null;
  tipo_painel?: string | null;
  modelo_contrato?: string | null;
  preventive_frequency_days?: number | null;
  created_at: string;
  updated_at: string;
}

// Chamados (technical tickets)
export interface OfflineChamado {
  id: string;
  ticket_code: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  client_id: string;
  assigned_technician_id?: string | null;
  created_at: string;
  resolved_at?: string | null;
  updated_at: string;
  // Nested data for display
  client_name?: string;
  client_fazenda?: string | null;
  technician_name?: string | null;
  visits_count?: number;
}

// Preventive maintenance records
export interface OfflinePreventiva {
  id: string;
  client_id: string;
  scheduled_date: string;
  completed_date?: string | null;
  status: string;
  notes?: string | null;
  internal_notes?: string | null;
  public_notes?: string | null;
  public_token?: string | null;
  route_id?: string | null;
  technician_user_id?: string | null;
  created_at: string;
  updated_at: string;
  // Nested data for display
  client_name?: string;
  client_fazenda?: string | null;
  technician_name?: string | null;
}

// Corrective visits (ticket_visits)
export interface OfflineCorretiva {
  id: string;
  visit_code: string;
  ticket_id: string;
  client_id: string;
  status: string;
  planned_start_date?: string | null;
  checkin_at?: string | null;
  checkin_lat?: number | null;
  checkin_lon?: number | null;
  checkout_at?: string | null;
  field_technician_user_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Nested data for display
  ticket_code?: string;
  ticket_title?: string;
  client_name?: string;
  client_fazenda?: string | null;
  technician_name?: string | null;
  public_token?: string | null;
}

// Preventive routes
export interface OfflineRota {
  id: string;
  route_code: string;
  start_date: string;
  end_date: string;
  status: string;
  checklist_template_id?: string | null;
  field_technician_user_id: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Nested data for display
  technician_name?: string | null;
  total_farms?: number;
  executed_farms?: number;
}

// Preventive route items
export interface OfflineRotaItem {
  id: string;
  route_id: string;
  client_id: string;
  order_index?: number | null;
  planned_date?: string | null;
  status: string;
  checkin_at?: string | null;
  checkin_lat?: number | null;
  checkin_lon?: number | null;
  suggested_reason?: string | null;
  created_at: string;
  updated_at: string;
  // Nested data for display
  client_name?: string;
  client_fazenda?: string | null;
  client_lat?: number | null;
  client_lon?: number | null;
}

export interface OfflinePeca {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  familia?: string | null;
  ativo?: boolean | null;
  omie_codigo?: string | null;
  imagem_url?: string | null;
  is_asset?: boolean;
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
  origem?: string | null;
  tipo_envio?: string | null;
  urgencia?: string;
  preventive_id?: string | null;
  created_at: string;
  updated_at: string;
  // Offline-specific fields
  _pendingSync?: boolean;
  // Nested data for display (not synced)
  clientes?: { nome: string; fazenda?: string | null; consultor_rplus_id?: string | null };
  pedido_itens?: OfflinePedidoItem[];
  solicitante?: { nome: string; email: string } | null;
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

export interface OfflineCrmVisitAudio {
  id: string;
  visit_id: string;
  product_code: string;
  audioData: Uint8Array;
  duration_seconds: number;
  file_size_bytes: number;
  mime_type?: string;
  status: string;
  created_at: string;
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
  chamados!: Table<OfflineChamado, string>;
  preventivas!: Table<OfflinePreventiva, string>;
  corretivas!: Table<OfflineCorretiva, string>;
  rotas!: Table<OfflineRota, string>;
  rota_items!: Table<OfflineRotaItem, string>;
  crm_visit_audios!: Table<OfflineCrmVisitAudio, string>;
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

    // Version 3: Add support for chamados, preventivas, corretivas, rotas
    this.version(3).stores({
      clientes: "id, nome, status, cidade, estado",
      pecas: "id, codigo, nome, ativo",
      produtos_quimicos: "id, nome, ativo",
      visitas: "id, tecnico_id, cliente_id, data_visita, _pendingSync",
      estoque: "id, cliente_id, produto_id, data_afericao, _pendingSync",
      pedidos: "id, solicitante_id, cliente_id, status, created_at, _pendingSync",
      pedido_itens: "id, pedido_id, peca_id, _pendingSync",
      chamados: "id, ticket_code, client_id, status, priority, created_at",
      preventivas: "id, client_id, scheduled_date, status, route_id, technician_user_id",
      corretivas: "id, visit_code, ticket_id, client_id, status, field_technician_user_id, created_at",
      rotas: "id, route_code, status, field_technician_user_id, start_date",
      rota_items: "id, route_id, client_id, status, order_index",
      syncQueue: "++id, table, operation, createdAt",
      syncMeta: "id, table, lastSync",
    });

    // Version 4: Add created_at index on corretivas
    this.version(4).stores({
      corretivas: "id, visit_code, ticket_id, client_id, status, field_technician_user_id, created_at",
    });

    // Version 5: Add crm_visit_audios for offline audio recording
    this.version(5).stores({
      crm_visit_audios: "id, visit_id, product_code, status",
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
    await this.chamados.clear();
    await this.preventivas.clear();
    await this.corretivas.clear();
    await this.rotas.clear();
    await this.rota_items.clear();
    await this.crm_visit_audios.clear();
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
