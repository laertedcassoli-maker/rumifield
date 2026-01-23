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

export interface ChecklistSyncQueueItem {
  id?: number;
  table: 'preventive_checklist_items' | 'preventive_checklist_item_actions' | 'preventive_checklist_item_nonconformities';
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

  constructor() {
    super("RumiFieldChecklistDB");

    this.version(1).stores({
      checklistItems: "id, exec_block_id, status, _pendingSync",
      checklistActions: "id, exec_item_id, template_action_id, _pendingSync",
      checklistNonconformities: "id, exec_item_id, template_nonconformity_id, _pendingSync",
      checklistSyncQueue: "++id, table, operation, createdAt",
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
      await this.checklistItems.update(itemId, {
        ...updates,
        _pendingSync: true
      });
      
      await this.addToSyncQueue('preventive_checklist_items', 'update', {
        id: itemId,
        ...updates
      });
    }
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
}

export const offlineChecklistDb = new OfflineChecklistDatabase();
