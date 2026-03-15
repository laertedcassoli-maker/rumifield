import Dexie, { Table } from "dexie";

// Types for offline checklist data
export interface OfflineChecklistItem {
  id: string;
  exec_block_id: string;
  template_item_id: string | null;
  item_name_snapshot: string;
  order_index: number;
  status: 'S' | 'N' | 'NA' | null;
  notes: string | null;
  answered_at: string | null;
  // Offline-specific
  _pendingSync?: boolean;
  _syncedAt?: string;
}

export interface OfflineChecklistAction {
  id: string;
  exec_item_id: string;
  template_action_id: string | null;
  action_label_snapshot: string;
  selected_at: string;
  // Offline-specific
  _pendingSync?: boolean;
  _operation?: 'insert' | 'delete';
}

export interface OfflineChecklistNonconformity {
  id: string;
  exec_item_id: string;
  template_nonconformity_id: string | null;
  nonconformity_label_snapshot: string;
  selected_at: string;
  // Offline-specific
  _pendingSync?: boolean;
  _operation?: 'insert' | 'delete';
}

export interface OfflineChecklistRecord {
  id: string;
  preventive_id: string;
  template_id: string;
  status: string;
  template_name: string;
}

export interface OfflineChecklistBlock {
  id: string;
  checklist_id: string;
  block_name_snapshot: string;
  order_index: number;
}

export interface OfflineTemplateAction {
  id: string;
  item_id: string;
  action_label: string;
  order_index: number;
  active: boolean;
}

export interface OfflineTemplateNonconformity {
  id: string;
  item_id: string;
  nonconformity_label: string;
  order_index: number;
  active: boolean;
}

export interface OfflineNonconformityPart {
  id: string;
  nonconformity_id: string;
  part_id: string;
  default_quantity: number;
  part_codigo: string;
  part_nome: string;
}

export interface OfflinePartConsumption {
  id: string;
  preventive_id: string;
  exec_item_id: string | null;
  exec_nonconformity_id: string | null;
  part_id: string;
  part_code_snapshot: string;
  part_name_snapshot: string;
  quantity: number;
  stock_source: string | null;
  is_manual?: boolean;
  notes?: string | null;
  asset_unique_code?: string | null;
  consumed_at?: string;
  _pendingSync?: boolean;
  _operation?: 'insert' | 'delete';
}

export interface ChecklistSyncQueueItem {
  id?: number;
  table: 'preventive_checklist_items' | 'preventive_checklist_item_actions' | 'preventive_checklist_item_nonconformities' | 'preventive_part_consumption';
  operation: 'update' | 'insert' | 'delete';
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

class OfflineChecklistDatabase extends Dexie {
  checklistItems!: Table<OfflineChecklistItem, string>;
  checklistActions!: Table<OfflineChecklistAction, string>;
  checklistNonconformities!: Table<OfflineChecklistNonconformity, string>;
  checklistSyncQueue!: Table<ChecklistSyncQueueItem, number>;
  checklists!: Table<OfflineChecklistRecord, string>;
  checklistBlocks!: Table<OfflineChecklistBlock, string>;
  templateActions!: Table<OfflineTemplateAction, string>;
  templateNonconformities!: Table<OfflineTemplateNonconformity, string>;
  nonconformityParts!: Table<OfflineNonconformityPart, string>;
  partConsumptions!: Table<OfflinePartConsumption, string>;

  constructor() {
    super("RumiFieldChecklistDB");

    this.version(1).stores({
      checklistItems: "id, exec_block_id, status, _pendingSync",
      checklistActions: "id, exec_item_id, template_action_id, _pendingSync",
      checklistNonconformities: "id, exec_item_id, template_nonconformity_id, _pendingSync",
      checklistSyncQueue: "++id, table, operation, createdAt",
    });

    this.version(2).stores({
      checklistItems: "id, exec_block_id, status, _pendingSync",
      checklistActions: "id, exec_item_id, template_action_id, _pendingSync",
      checklistNonconformities: "id, exec_item_id, template_nonconformity_id, _pendingSync",
      checklistSyncQueue: "++id, table, operation, createdAt",
      checklists: "id, preventive_id",
      checklistBlocks: "id, checklist_id, order_index",
    });

    this.version(3).stores({
      checklistItems: "id, exec_block_id, status, _pendingSync",
      checklistActions: "id, exec_item_id, template_action_id, _pendingSync",
      checklistNonconformities: "id, exec_item_id, template_nonconformity_id, _pendingSync",
      checklistSyncQueue: "++id, table, operation, createdAt",
      checklists: "id, preventive_id",
      checklistBlocks: "id, checklist_id, order_index",
      templateActions: "id, item_id",
      templateNonconformities: "id, item_id",
    });

    this.version(4).stores({
      checklistItems: "id, exec_block_id, status, _pendingSync",
      checklistActions: "id, exec_item_id, template_action_id, _pendingSync",
      checklistNonconformities: "id, exec_item_id, template_nonconformity_id, _pendingSync",
      checklistSyncQueue: "++id, table, operation, createdAt",
      checklists: "id, preventive_id",
      checklistBlocks: "id, checklist_id, order_index",
      templateActions: "id, item_id",
      templateNonconformities: "id, item_id",
      nonconformityParts: "id, nonconformity_id",
      partConsumptions: "id, exec_nonconformity_id, exec_item_id, _pendingSync",
    });
  }

  // Add item to sync queue
  async addToSyncQueue(
    table: ChecklistSyncQueueItem['table'],
    operation: ChecklistSyncQueueItem['operation'],
    data: Record<string, unknown>
  ): Promise<void> {
    await this.checklistSyncQueue.add({
      table,
      operation,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
  }

  // Get pending sync items
  async getPendingSyncItems(): Promise<ChecklistSyncQueueItem[]> {
    return this.checklistSyncQueue.toArray();
  }

  // Remove sync item after successful sync
  async removeSyncItem(id: number): Promise<void> {
    await this.checklistSyncQueue.delete(id);
  }

  // Increment retry count
  async incrementRetryCount(id: number): Promise<void> {
    const item = await this.checklistSyncQueue.get(id);
    if (item) {
      await this.checklistSyncQueue.update(id, { retryCount: item.retryCount + 1 });
    }
  }

  // Clear all checklist offline data
  async clearAll(): Promise<void> {
    await this.checklistItems.clear();
    await this.checklistActions.clear();
    await this.checklistNonconformities.clear();
    await this.checklistSyncQueue.clear();
    await this.checklists.clear();
    await this.checklistBlocks.clear();
    await this.templateActions.clear();
    await this.templateNonconformities.clear();
    await this.nonconformityParts.clear();
    await this.partConsumptions.clear();
  }

  // Cache checklist items for a specific checklist
  async cacheChecklistItems(items: OfflineChecklistItem[]): Promise<void> {
    for (const item of items) {
      const existing = await this.checklistItems.get(item.id);
      // Only update if not pending sync or if newer data
      if (!existing?._pendingSync) {
        await this.checklistItems.put({
          ...item,
          _pendingSync: false,
          _syncedAt: new Date().toISOString()
        });
      }
    }
  }

  // Get cached item
  async getCachedItem(itemId: string): Promise<OfflineChecklistItem | undefined> {
    return this.checklistItems.get(itemId);
  }

  // Update item locally (for offline support)
  async updateItemLocally(
    itemId: string, 
    updates: Partial<Pick<OfflineChecklistItem, 'status' | 'notes' | 'answered_at'>>
  ): Promise<void> {
    const existing = await this.checklistItems.get(itemId);

    if (existing) {
      // Item exists: update preserving all fields
      await this.checklistItems.update(itemId, {
        ...updates,
        _pendingSync: true,
      });
    } else {
      // Item NOT in cache yet: create a minimal record so data is never lost
      await this.checklistItems.put({
        id: itemId,
        exec_block_id: '',
        template_item_id: null,
        item_name_snapshot: '',
        order_index: 0,
        status: updates.status ?? null,
        notes: updates.notes ?? null,
        answered_at: updates.answered_at ?? null,
        _pendingSync: true,
        _syncedAt: undefined,
      });
    }

    // Always add to sync queue regardless of whether item existed
    await this.addToSyncQueue('preventive_checklist_items', 'update', {
      id: itemId,
      ...updates,
    });
  }

  // Add action locally
  async addActionLocally(action: Omit<OfflineChecklistAction, '_pendingSync' | '_operation'>): Promise<void> {
    await this.checklistActions.put({
      ...action,
      _pendingSync: true,
      _operation: 'insert'
    });
    
    await this.addToSyncQueue('preventive_checklist_item_actions', 'insert', {
      exec_item_id: action.exec_item_id,
      template_action_id: action.template_action_id,
      action_label_snapshot: action.action_label_snapshot
    });
  }

  // Remove action locally
  async removeActionLocally(execItemId: string, templateActionId: string): Promise<void> {
    const action = await this.checklistActions
      .filter(a => a.exec_item_id === execItemId && a.template_action_id === templateActionId)
      .first();
    
    if (action) {
      await this.checklistActions.delete(action.id);
      await this.addToSyncQueue('preventive_checklist_item_actions', 'delete', {
        exec_item_id: execItemId,
        template_action_id: templateActionId
      });
    }
  }

  // Add nonconformity locally
  async addNonconformityLocally(nc: Omit<OfflineChecklistNonconformity, '_pendingSync' | '_operation'>): Promise<void> {
    await this.checklistNonconformities.put({
      ...nc,
      _pendingSync: true,
      _operation: 'insert'
    });
    
    await this.addToSyncQueue('preventive_checklist_item_nonconformities', 'insert', {
      exec_item_id: nc.exec_item_id,
      template_nonconformity_id: nc.template_nonconformity_id,
      nonconformity_label_snapshot: nc.nonconformity_label_snapshot
    });
  }

  // Remove nonconformity locally
  async removeNonconformityLocally(execItemId: string, templateNcId: string): Promise<void> {
    const nc = await this.checklistNonconformities
      .filter(n => n.exec_item_id === execItemId && n.template_nonconformity_id === templateNcId)
      .first();
    
    if (nc) {
      await this.checklistNonconformities.delete(nc.id);
      await this.addToSyncQueue('preventive_checklist_item_nonconformities', 'delete', {
        exec_item_id: execItemId,
        template_nonconformity_id: templateNcId
      });
    }
  }

  // Get pending items count
  async getPendingCount(): Promise<number> {
    return this.checklistSyncQueue.count();
  }

  // Cache full checklist structure (checklist + blocks + items + actions + nonconformities)
  async cacheFullChecklist(checklist: any): Promise<void> {
    if (!checklist) return;

    // Save checklist record
    await this.checklists.put({
      id: checklist.id,
      preventive_id: checklist.preventive_id,
      template_id: checklist.template_id,
      status: checklist.status,
      template_name: checklist.template?.name || '',
    });

    // Save blocks, items, actions, nonconformities
    for (const block of checklist.blocks || []) {
      await this.checklistBlocks.put({
        id: block.id,
        checklist_id: checklist.id,
        block_name_snapshot: block.block_name_snapshot,
        order_index: block.order_index,
      });

      for (const item of block.items || []) {
        const existing = await this.checklistItems.get(item.id);
        if (!existing?._pendingSync) {
          await this.checklistItems.put({
            id: item.id,
            exec_block_id: block.id,
            template_item_id: item.template_item_id,
            item_name_snapshot: item.item_name_snapshot,
            order_index: item.order_index,
            status: item.status,
            notes: item.notes,
            answered_at: item.answered_at,
            _pendingSync: false,
            _syncedAt: new Date().toISOString(),
          });
        }

        // Cache selected actions
        for (const action of item.selected_actions || []) {
          await this.checklistActions.put({
            id: action.id,
            exec_item_id: item.id,
            template_action_id: action.template_action_id,
            action_label_snapshot: action.action_label_snapshot,
            selected_at: action.selected_at || new Date().toISOString(),
            _pendingSync: false,
          });
        }

        // Cache selected nonconformities
        for (const nc of item.selected_nonconformities || []) {
          await this.checklistNonconformities.put({
            id: nc.id,
            exec_item_id: item.id,
            template_nonconformity_id: nc.template_nonconformity_id,
            nonconformity_label_snapshot: nc.nonconformity_label_snapshot,
            selected_at: nc.selected_at || new Date().toISOString(),
            _pendingSync: false,
          });
        }
      }
    }
  }

  // Get cached checklist by preventive_id, rebuilding full structure
  async getCachedChecklist(preventiveId: string): Promise<any | null> {
    const checklist = await this.checklists
      .where('preventive_id')
      .equals(preventiveId)
      .first();

    if (!checklist) return null;

    const blocks = await this.checklistBlocks
      .where('checklist_id')
      .equals(checklist.id)
      .sortBy('order_index');

    const fullBlocks = await Promise.all(
      blocks.map(async (block) => {
        const items = await this.checklistItems
          .where('exec_block_id')
          .equals(block.id)
          .sortBy('order_index');

        const fullItems = await Promise.all(
          items.map(async (item) => {
            const selectedActions = await this.checklistActions
              .where('exec_item_id')
              .equals(item.id)
              .toArray();

            const selectedNonconformities = await this.checklistNonconformities
              .where('exec_item_id')
              .equals(item.id)
              .toArray();

            return {
              ...item,
              selected_actions: selectedActions.map(a => ({
                id: a.id,
                template_action_id: a.template_action_id,
                action_label_snapshot: a.action_label_snapshot,
              })),
              selected_nonconformities: selectedNonconformities.map(nc => ({
                id: nc.id,
                template_nonconformity_id: nc.template_nonconformity_id,
                nonconformity_label_snapshot: nc.nonconformity_label_snapshot,
              })),
            };
          })
        );

        return {
          ...block,
          items: fullItems,
        };
      })
    );

    return {
      id: checklist.id,
      preventive_id: checklist.preventive_id,
      template_id: checklist.template_id,
      status: checklist.status,
      template: { name: checklist.template_name },
      blocks: fullBlocks,
    };
  }

  // Cache template actions (reference data from checklist_item_corrective_actions)
  async cacheTemplateActions(actions: OfflineTemplateAction[]): Promise<void> {
    if (actions.length === 0) return;
    await this.templateActions.bulkPut(actions);
  }

  // Cache template nonconformities (reference data from checklist_item_nonconformities)
  async cacheTemplateNonconformities(ncs: OfflineTemplateNonconformity[]): Promise<void> {
    if (ncs.length === 0) return;
    await this.templateNonconformities.bulkPut(ncs);
  }

  // Get cached template actions grouped by item_id
  async getCachedTemplateActions(templateItemIds: string[]): Promise<Record<string, OfflineTemplateAction[]>> {
    if (templateItemIds.length === 0) return {};
    const all = await this.templateActions
      .where('item_id')
      .anyOf(templateItemIds)
      .toArray();
    const grouped: Record<string, OfflineTemplateAction[]> = {};
    all.forEach(a => {
      if (!grouped[a.item_id]) grouped[a.item_id] = [];
      grouped[a.item_id].push(a);
    });
    // Sort each group by order_index
    Object.values(grouped).forEach(arr => arr.sort((a, b) => a.order_index - b.order_index));
    return grouped;
  }

  // Get cached template nonconformities grouped by item_id
  async getCachedTemplateNonconformities(templateItemIds: string[]): Promise<Record<string, OfflineTemplateNonconformity[]>> {
    if (templateItemIds.length === 0) return {};
    const all = await this.templateNonconformities
      .where('item_id')
      .anyOf(templateItemIds)
      .toArray();
    const grouped: Record<string, OfflineTemplateNonconformity[]> = {};
    all.forEach(nc => {
      if (!grouped[nc.item_id]) grouped[nc.item_id] = [];
      grouped[nc.item_id].push(nc);
    });
    Object.values(grouped).forEach(arr => arr.sort((a, b) => a.order_index - b.order_index));
    return grouped;
  }

  // Cache nonconformity parts (reference data from checklist_nonconformity_parts)
  async cacheNonconformityParts(parts: OfflineNonconformityPart[]): Promise<void> {
    await this.nonconformityParts.bulkPut(parts);
  }

  // Get nonconformity parts by nonconformity_id
  async getNonconformityParts(nonconformityId: string): Promise<OfflineNonconformityPart[]> {
    return this.nonconformityParts
      .where('nonconformity_id')
      .equals(nonconformityId)
      .toArray();
  }

  // Add part consumption locally with sync queue
  async addPartConsumptionLocally(
    consumption: Omit<OfflinePartConsumption, '_pendingSync' | '_operation'>
  ): Promise<void> {
    const record = {
      ...consumption,
      consumed_at: consumption.consumed_at || new Date().toISOString(),
      _pendingSync: true,
      _operation: 'insert' as const,
    };
    await this.partConsumptions.put(record);
    await this.addToSyncQueue('preventive_part_consumption', 'insert', {
      id: consumption.id,
      preventive_id: consumption.preventive_id,
      exec_item_id: consumption.exec_item_id || null,
      exec_nonconformity_id: consumption.exec_nonconformity_id || null,
      part_id: consumption.part_id,
      part_code_snapshot: consumption.part_code_snapshot,
      part_name_snapshot: consumption.part_name_snapshot,
      quantity: consumption.quantity,
      stock_source: consumption.stock_source,
      is_manual: consumption.is_manual || false,
      notes: consumption.notes || null,
      asset_unique_code: consumption.asset_unique_code || null,
    });
  }

  // Delete part consumption by exec nonconformity id
  async deletePartConsumptionByNcId(execNonconformityId: string): Promise<void> {
    const records = await this.partConsumptions
      .where('exec_nonconformity_id')
      .equals(execNonconformityId)
      .toArray();
    for (const record of records) {
      await this.partConsumptions.delete(record.id);
      await this.addToSyncQueue('preventive_part_consumption', 'delete', {
        id: record.id,
        exec_nonconformity_id: execNonconformityId,
      });
    }
  }

  // Get part consumptions by preventive_id
  async getPartConsumptionsByPreventiveId(preventiveId: string): Promise<OfflinePartConsumption[]> {
    return this.partConsumptions
      .filter(pc => pc.preventive_id === preventiveId)
      .toArray();
  }

  // Delete part consumption by exec item id
  async deletePartConsumptionByItemId(execItemId: string): Promise<void> {
    const records = await this.partConsumptions
      .where('exec_item_id')
      .equals(execItemId)
      .toArray();
    for (const record of records) {
      await this.partConsumptions.delete(record.id);
      await this.addToSyncQueue('preventive_part_consumption', 'delete', {
        id: record.id,
        exec_nonconformity_id: record.exec_nonconformity_id,
      });
    }
  }

  // Update part consumption field locally and queue sync
  async updatePartConsumptionLocally(
    id: string,
    updates: Partial<Pick<OfflinePartConsumption, 'stock_source' | 'notes' | 'asset_unique_code'>>
  ): Promise<void> {
    await this.partConsumptions.update(id, { ...updates, _pendingSync: true });
    await this.addToSyncQueue('preventive_part_consumption', 'update', { id, ...updates });
  }
}

export const offlineChecklistDb = new OfflineChecklistDatabase();
