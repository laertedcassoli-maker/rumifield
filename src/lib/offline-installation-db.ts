import Dexie, { Table } from "dexie";

// Offline-first execution storage for INSTALLATION checklists.
// Mirrors the preventive engine (offline-checklist-db.ts) but points to the
// installation_* tables — never to preventive_* tables.
// Reference/template caches (templateActions, templateNonconformities,
// nonconformityParts) are shared and stay in offlineChecklistDb.

export interface OfflineInstallationChecklistItem {
  id: string;
  exec_block_id: string;
  template_item_id: string | null;
  item_name_snapshot: string;
  order_index: number;
  status: 'S' | 'N' | 'NA' | null;
  notes: string | null;
  answered_at: string | null;
  _pendingSync?: boolean;
  _syncedAt?: string;
}

export interface OfflineInstallationChecklistAction {
  id: string;
  exec_item_id: string;
  template_action_id: string | null;
  action_label_snapshot: string;
  selected_at: string;
  _pendingSync?: boolean;
  _operation?: 'insert' | 'delete';
}

export interface OfflineInstallationChecklistNonconformity {
  id: string;
  exec_item_id: string;
  template_nonconformity_id: string | null;
  nonconformity_label_snapshot: string;
  selected_at: string;
  _pendingSync?: boolean;
  _operation?: 'insert' | 'delete';
}

export interface OfflineInstallationChecklistRecord {
  id: string;
  installation_stage_id: string;
  template_id: string;
  status: string;
  template_name: string;
}

export interface OfflineInstallationChecklistBlock {
  id: string;
  checklist_id: string;
  block_name_snapshot: string;
  order_index: number;
}

export interface OfflineInstallationPartConsumption {
  id: string;
  installation_stage_id: string;
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

export interface InstallationSyncQueueItem {
  id?: number;
  table:
    | 'installation_checklist_items'
    | 'installation_checklist_item_actions'
    | 'installation_checklist_item_nonconformities'
    | 'installation_part_consumption';
  operation: 'update' | 'insert' | 'delete';
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

export interface InstallationDeadLetterItem {
  id?: number;
  table: InstallationSyncQueueItem['table'];
  operation: InstallationSyncQueueItem['operation'];
  data: Record<string, unknown>;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
}

class OfflineInstallationChecklistDatabase extends Dexie {
  checklistItems!: Table<OfflineInstallationChecklistItem, string>;
  checklistActions!: Table<OfflineInstallationChecklistAction, string>;
  checklistNonconformities!: Table<OfflineInstallationChecklistNonconformity, string>;
  partConsumptions!: Table<OfflineInstallationPartConsumption, string>;
  checklists!: Table<OfflineInstallationChecklistRecord, string>;
  checklistBlocks!: Table<OfflineInstallationChecklistBlock, string>;
  syncQueue!: Table<InstallationSyncQueueItem, number>;
  deadLetter!: Table<InstallationDeadLetterItem, number>;

  constructor() {
    super("RumiFieldInstallationChecklistDB");

    this.version(1).stores({
      checklistItems: "id, exec_block_id, status, _pendingSync",
      checklistActions: "id, exec_item_id, template_action_id, _pendingSync",
      checklistNonconformities: "id, exec_item_id, template_nonconformity_id, _pendingSync",
      partConsumptions: "id, installation_stage_id, exec_nonconformity_id, exec_item_id, _pendingSync",
      checklists: "id, installation_stage_id",
      checklistBlocks: "id, checklist_id, order_index",
      syncQueue: "++id, table, operation, createdAt",
      deadLetter: "++id, table, operation, createdAt",
    });
  }

  async addToSyncQueue(
    table: InstallationSyncQueueItem['table'],
    operation: InstallationSyncQueueItem['operation'],
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

  async getPendingSyncItems(): Promise<InstallationSyncQueueItem[]> {
    return this.syncQueue.toArray();
  }

  async removeSyncItem(id: number): Promise<void> {
    await this.syncQueue.delete(id);
  }

  async incrementRetryCount(id: number): Promise<void> {
    const item = await this.syncQueue.get(id);
    if (item) {
      await this.syncQueue.update(id, { retryCount: item.retryCount + 1 });
    }
  }

  async moveToDeadLetter(item: InstallationSyncQueueItem, errorMessage: string | null): Promise<void> {
    await this.transaction("rw", this.syncQueue, this.deadLetter, async () => {
      await this.deadLetter.add({
        table: item.table,
        operation: item.operation,
        data: item.data,
        retryCount: item.retryCount,
        errorMessage,
        createdAt: new Date().toISOString(),
      });
      if (item.id != null) {
        await this.syncQueue.delete(item.id);
      }
    });
  }

  async countDeadLetter(): Promise<number> {
    return this.deadLetter.count();
  }

  async getPendingCount(): Promise<number> {
    return this.syncQueue.count();
  }

  async clearAll(): Promise<void> {
    await this.checklistItems.clear();
    await this.checklistActions.clear();
    await this.checklistNonconformities.clear();
    await this.partConsumptions.clear();
    await this.checklists.clear();
    await this.checklistBlocks.clear();
    await this.syncQueue.clear();
    await this.deadLetter.clear();
  }

  // Cache full checklist structure fetched from the server
  async cacheFullChecklist(checklist: any): Promise<void> {
    if (!checklist) return;

    await this.checklists.put({
      id: checklist.id,
      installation_stage_id: checklist.installation_stage_id,
      template_id: checklist.template_id,
      status: checklist.status,
      template_name: checklist.template?.name || '',
    });

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

  // Rebuild full checklist from local cache (offline fallback)
  async getCachedChecklist(stageId: string): Promise<any | null> {
    const checklist = await this.checklists
      .where('installation_stage_id')
      .equals(stageId)
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
      installation_stage_id: checklist.installation_stage_id,
      template_id: checklist.template_id,
      status: checklist.status,
      template: { name: checklist.template_name },
      blocks: fullBlocks,
    };
  }

  // Update item locally (write-local-first)
  async updateItemLocally(
    itemId: string,
    updates: Partial<Pick<OfflineInstallationChecklistItem, 'status' | 'notes' | 'answered_at'>>
  ): Promise<void> {
    const existing = await this.checklistItems.get(itemId);

    if (existing) {
      await this.checklistItems.update(itemId, {
        ...updates,
        _pendingSync: true,
      });
    } else {
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
      });
    }

    await this.addToSyncQueue('installation_checklist_items', 'update', {
      id: itemId,
      ...updates,
    });
  }

  async addActionLocally(action: Omit<OfflineInstallationChecklistAction, '_pendingSync' | '_operation'>): Promise<void> {
    await this.checklistActions.put({
      ...action,
      _pendingSync: true,
      _operation: 'insert',
    });

    await this.addToSyncQueue('installation_checklist_item_actions', 'insert', {
      exec_item_id: action.exec_item_id,
      template_action_id: action.template_action_id,
      action_label_snapshot: action.action_label_snapshot,
    });
  }

  async removeActionLocally(execItemId: string, templateActionId: string): Promise<void> {
    const action = await this.checklistActions
      .filter(a => a.exec_item_id === execItemId && a.template_action_id === templateActionId)
      .first();

    if (action) {
      await this.checklistActions.delete(action.id);
      await this.addToSyncQueue('installation_checklist_item_actions', 'delete', {
        exec_item_id: execItemId,
        template_action_id: templateActionId,
      });
    }
  }

  async addNonconformityLocally(nc: Omit<OfflineInstallationChecklistNonconformity, '_pendingSync' | '_operation'>): Promise<void> {
    await this.checklistNonconformities.put({
      ...nc,
      _pendingSync: true,
      _operation: 'insert',
    });

    await this.addToSyncQueue('installation_checklist_item_nonconformities', 'insert', {
      exec_item_id: nc.exec_item_id,
      template_nonconformity_id: nc.template_nonconformity_id,
      nonconformity_label_snapshot: nc.nonconformity_label_snapshot,
    });
  }

  async removeNonconformityLocally(execItemId: string, templateNcId: string): Promise<void> {
    const nc = await this.checklistNonconformities
      .filter(n => n.exec_item_id === execItemId && n.template_nonconformity_id === templateNcId)
      .first();

    if (nc) {
      await this.checklistNonconformities.delete(nc.id);
      await this.addToSyncQueue('installation_checklist_item_nonconformities', 'delete', {
        exec_item_id: execItemId,
        template_nonconformity_id: templateNcId,
      });
    }
  }

  // Clear all actions + nonconformities of an item (status changed away from 'N')
  async clearItemSelectionsLocally(execItemId: string): Promise<void> {
    const actions = await this.checklistActions
      .where('exec_item_id')
      .equals(execItemId)
      .toArray();
    for (const action of actions) {
      await this.checklistActions.delete(action.id);
      await this.addToSyncQueue('installation_checklist_item_actions', 'delete', {
        exec_item_id: execItemId,
        template_action_id: action.template_action_id,
      });
    }

    const ncs = await this.checklistNonconformities
      .where('exec_item_id')
      .equals(execItemId)
      .toArray();
    for (const nc of ncs) {
      await this.checklistNonconformities.delete(nc.id);
      await this.addToSyncQueue('installation_checklist_item_nonconformities', 'delete', {
        exec_item_id: execItemId,
        template_nonconformity_id: nc.template_nonconformity_id,
      });
    }
  }

  async addPartConsumptionLocally(
    consumption: Omit<OfflineInstallationPartConsumption, '_pendingSync' | '_operation'>
  ): Promise<void> {
    const record = {
      ...consumption,
      consumed_at: consumption.consumed_at || new Date().toISOString(),
      _pendingSync: true,
      _operation: 'insert' as const,
    };
    await this.partConsumptions.put(record);
    await this.addToSyncQueue('installation_part_consumption', 'insert', {
      id: consumption.id,
      installation_stage_id: consumption.installation_stage_id,
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

  async deletePartConsumptionByNcId(execNonconformityId: string): Promise<void> {
    const records = await this.partConsumptions
      .where('exec_nonconformity_id')
      .equals(execNonconformityId)
      .toArray();
    for (const record of records) {
      await this.partConsumptions.delete(record.id);
      await this.addToSyncQueue('installation_part_consumption', 'delete', {
        id: record.id,
        exec_nonconformity_id: execNonconformityId,
      });
    }
  }

  async deletePartConsumptionByItemId(execItemId: string): Promise<void> {
    const records = await this.partConsumptions
      .where('exec_item_id')
      .equals(execItemId)
      .toArray();
    for (const record of records) {
      await this.partConsumptions.delete(record.id);
      await this.addToSyncQueue('installation_part_consumption', 'delete', {
        id: record.id,
        exec_nonconformity_id: record.exec_nonconformity_id,
      });
    }
  }

  async getPartConsumptionsByStageId(stageId: string): Promise<OfflineInstallationPartConsumption[]> {
    return this.partConsumptions
      .filter(pc => pc.installation_stage_id === stageId)
      .toArray();
  }

  async updatePartConsumptionLocally(
    id: string,
    updates: Partial<Pick<OfflineInstallationPartConsumption, 'stock_source' | 'notes' | 'asset_unique_code'>>
  ): Promise<void> {
    await this.partConsumptions.update(id, { ...updates, _pendingSync: true });
    await this.addToSyncQueue('installation_part_consumption', 'update', { id, ...updates });
  }
}

export const offlineInstallationDb = new OfflineInstallationChecklistDatabase();
