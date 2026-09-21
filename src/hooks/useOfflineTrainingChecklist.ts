import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  offlineChecklistDb,
  TrainingSyncQueueItem,
  OfflineTrainingVisit,
  OfflineTrainingChecklistResponse,
  OfflineTrainingTemplate,
  OfflineTrainingAttendee,
} from "@/lib/offline-checklist-db";
import { reportDeadLetter } from "@/lib/reportDeadLetter";
import { toast } from "sonner";

export type TrainingSyncStatus = "idle" | "syncing" | "error" | "offline" | "pending";

export interface NewTrainingVisitInput {
  clienteId: string;
  checklistTemplateId: string | null;
  technicianUserId: string | null;
  csmUserId: string | null;
  createdByUserId: string;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  plannedDate?: string | null;
}

/**
 * Hook offline-first do treinamento combinado: grava sempre no dispositivo primeiro
 * (_pendingSync) e envia quando há conexão. Usa fila própria (trainingSyncQueue) para
 * não colidir com o dispatch do checklist de preventiva.
 */
export function useOfflineTrainingChecklist() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<TrainingSyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const syncInProgressRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isOnlineRef = useRef(isOnline);

  const updatePendingCount = useCallback(async () => {
    const count = await offlineChecklistDb.getTrainingPendingCount();
    setPendingCount(count);
  }, []);

  // Envia um item da fila. Duplicidade (23505) é tratada como sucesso (idempotência).
  const processSyncItem = async (
    item: TrainingSyncQueueItem
  ): Promise<{ ok: boolean; errorMessage?: string }> => {
    const { table, operation, data } = item;

    try {
      const cleanData = { ...data };
      delete cleanData._pendingSync;
      delete cleanData._localId;

      if (table === "training_visits") {
        if (operation === "insert") {
          const { error } = await supabase
            .from("training_visits")
            .upsert(cleanData as never, { onConflict: "id" });
          if (error && error.code !== "23505") throw error;
          await offlineChecklistDb.trainingVisits.update(data.id as string, { _pendingSync: false });
        } else {
          const id = cleanData.id as string;
          delete cleanData.id;
          const { error } = await supabase
            .from("training_visits")
            .update(cleanData as never)
            .eq("id", id);
          if (error) throw error;
          await offlineChecklistDb.trainingVisits.update(id, { _pendingSync: false });
        }
      } else if (table === "training_checklist_responses") {
        // insert e update usam o mesmo caminho: upsert pelo par visita/item
        const id = cleanData.id as string;
        const { error } = await supabase
          .from("training_checklist_responses")
          .upsert(cleanData as never, {
            onConflict: "training_visit_id,checklist_template_item_id",
          });
        if (error && error.code !== "23505") throw error;
        await offlineChecklistDb.trainingChecklistResponses.update(id, { _pendingSync: false });
      } else if (table === "training_visit_attendees") {
        const id = cleanData.id as string;
        if (operation === "delete") {
          const { error } = await supabase.from("training_visit_attendees").delete().eq("id", id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("training_visit_attendees")
            .upsert(cleanData as never, { onConflict: "id" });
          if (error && error.code !== "23505") throw error;
          await offlineChecklistDb.trainingAttendees.update(id, { _pendingSync: false });
        }
      } else {
        throw new Error(`Tabela sem handler no treinamento: ${table}`);
      }

      return { ok: true };
    } catch (error) {
      console.error(`Erro ao sincronizar treinamento (${table}):`, error);
      const errorMessage = (error as { message?: string })?.message ?? String(error);
      return { ok: false, errorMessage };
    }
  };

  const syncPendingChanges = useCallback(async () => {
    if (!isOnlineRef.current || syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    setSyncStatus("syncing");

    try {
      const items = await offlineChecklistDb.getPendingTrainingSyncItems();

      if (items.length === 0) {
        setSyncStatus("idle");
        return;
      }

      let failCount = 0;

      // Ordem importa: a visita precisa existir antes das respostas
      const ordered = [...items].sort((a, b) => {
        if (a.table === b.table) return (a.id ?? 0) - (b.id ?? 0);
        return a.table === "training_visits" ? -1 : 1;
      });

      for (const item of ordered) {
        const result = await processSyncItem(item);

        if (result.ok) {
          await offlineChecklistDb.removeTrainingSyncItem(item.id!);
        } else {
          await offlineChecklistDb.incrementTrainingRetryCount(item.id!);

          // Nunca descarta silenciosamente: após 5 tentativas vai para dead-letter
          if (item.retryCount >= 5) {
            const errorMessage = result.errorMessage ?? null;
            try {
              await offlineChecklistDb.moveTrainingToDeadLetter(
                { ...item, retryCount: item.retryCount + 1 },
                errorMessage
              );
              await reportDeadLetter({
                table: item.table,
                operation: item.operation,
                retryCount: item.retryCount + 1,
                errorMessage,
                data: item.data,
              });
            } catch (dlErr) {
              console.error("Falha ao mover item de treinamento para dead-letter", dlErr);
            }
            failCount++;
          }
        }
      }

      await updatePendingCount();

      if (failCount > 0) {
        setSyncStatus("error");
        toast.error(`${failCount} registro(s) de treinamento não puderam ser sincronizados`);
      } else {
        setSyncStatus("idle");
      }
    } catch (error) {
      console.error("Erro na sincronização do treinamento:", error);
      setSyncStatus("error");
    } finally {
      syncInProgressRef.current = false;
    }
  }, [updatePendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      isOnlineRef.current = true;
      syncPendingChanges();
    };
    const handleOffline = () => {
      setIsOnline(false);
      isOnlineRef.current = false;
      setSyncStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncPendingChanges]);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  const debouncedSync = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      if (isOnlineRef.current) syncPendingChanges();
    }, 2000);
  }, [syncPendingChanges]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  const afterLocalWrite = useCallback(async () => {
    await updatePendingCount();
    if (isOnlineRef.current) {
      debouncedSync();
    } else {
      setSyncStatus("offline");
    }
  }, [debouncedSync, updatePendingCount]);

  /** Cria a visita de treinamento localmente e devolve o id (gerado no cliente) */
  const createTrainingVisit = useCallback(
    async (input: NewTrainingVisitInput): Promise<string> => {
      const id = crypto.randomUUID();
      const visit: OfflineTrainingVisit = {
        id,
        cliente_id: input.clienteId,
        checklist_template_id: input.checklistTemplateId,
        technician_user_id: input.technicianUserId,
        csm_user_id: input.csmUserId,
        created_by_user_id: input.createdByUserId,
        planned_date: input.plannedDate ?? null,
        completed_date: null,
        status: "pendente",
        contact_name: input.contactName ?? null,
        contact_phone: input.contactPhone ?? null,
        notes: input.notes ?? null,
      };
      await offlineChecklistDb.createTrainingVisitLocally(visit);
      await afterLocalWrite();
      return id;
    },
    [afterLocalWrite]
  );

  const updateTrainingVisit = useCallback(
    async (
      id: string,
      updates: Partial<Pick<OfflineTrainingVisit, "status" | "completed_date" | "contact_name" | "contact_phone" | "notes" | "checklist_template_id">>
    ) => {
      await offlineChecklistDb.updateTrainingVisitLocally(id, updates);
      await afterLocalWrite();
    },
    [afterLocalWrite]
  );

  /** Marca/desmarca um item do checklist de treinamento */
  const setResponse = useCallback(
    async (
      visitId: string,
      checklistTemplateItemId: string,
      updates: { checked?: boolean; notes?: string | null }
    ) => {
      const existing = (await offlineChecklistDb.getTrainingResponses(visitId)).find(
        r => r.checklist_template_item_id === checklistTemplateItemId
      );

      const record: OfflineTrainingChecklistResponse = {
        id: existing?.id ?? crypto.randomUUID(),
        training_visit_id: visitId,
        checklist_template_item_id: checklistTemplateItemId,
        checked: updates.checked ?? existing?.checked ?? false,
        notes: updates.notes !== undefined ? updates.notes : existing?.notes ?? null,
      };

      await offlineChecklistDb.setTrainingResponseLocally(record);
      await afterLocalWrite();
      return record;
    },
    [afterLocalWrite]
  );

  const completeTraining = useCallback(
    async (visitId: string, contact: { contactName: string; contactPhone: string }) => {
      const today = new Date().toISOString().slice(0, 10);
      await offlineChecklistDb.updateTrainingVisitLocally(visitId, {
        status: "concluida",
        completed_date: today,
        contact_name: contact.contactName,
        contact_phone: contact.contactPhone,
      });
      await afterLocalWrite();
    },
    [afterLocalWrite]
  );

  const getResponses = useCallback(async (visitId: string) => {
    return offlineChecklistDb.getTrainingResponses(visitId);
  }, []);

  /** Adiciona uma pessoa treinada (offline-first) e devolve o registro local */
  const addAttendee = useCallback(
    async (visitId: string, nome: string, telefone: string | null) => {
      const record: OfflineTrainingAttendee = {
        id: crypto.randomUUID(),
        training_visit_id: visitId,
        nome,
        telefone: telefone || null,
      };
      await offlineChecklistDb.addTrainingAttendeeLocally(record);
      await afterLocalWrite();
      return record;
    },
    [afterLocalWrite]
  );

  const removeAttendee = useCallback(
    async (attendeeId: string) => {
      await offlineChecklistDb.removeTrainingAttendeeLocally(attendeeId);
      await afterLocalWrite();
    },
    [afterLocalWrite]
  );

  const getAttendees = useCallback(async (visitId: string) => {
    return offlineChecklistDb.getTrainingAttendees(visitId);
  }, []);

  /**
   * Carrega uma visita já existente (fluxo avulso). Online: busca no servidor,
   * cacheia localmente e traz também as respostas já salvas. Offline: lê o cache.
   */
  const getTrainingVisit = useCallback(
    async (visitId: string): Promise<OfflineTrainingVisit> => {
      if (isOnlineRef.current) {
        const { data, error } = await supabase
          .from("training_visits")
          .select(
            "id, cliente_id, checklist_template_id, technician_user_id, csm_user_id, created_by_user_id, planned_date, completed_date, status, contact_name, contact_phone, notes"
          )
          .eq("id", visitId)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Visita de treinamento não encontrada.");
        const visit = data as OfflineTrainingVisit;
        await offlineChecklistDb.cacheTrainingVisit(visit);

        const { data: resp, error: respError } = await supabase
          .from("training_checklist_responses")
          .select("id, training_visit_id, checklist_template_item_id, checked, notes")
          .eq("training_visit_id", visitId);
        if (respError) throw respError;
        await offlineChecklistDb.cacheTrainingResponses(
          (resp ?? []) as OfflineTrainingChecklistResponse[]
        );
        return visit;
      }

      const local = await offlineChecklistDb.getTrainingVisit(visitId);
      if (!local) {
        throw new Error("Visita não disponível offline. Conecte-se uma vez para baixá-la.");
      }
      return local;
    },
    []
  );

  const cacheTemplates = useCallback(
    async (templates: Omit<OfflineTrainingTemplate, "_cachedAt">[]) => {
      await offlineChecklistDb.cacheTrainingTemplates(templates);
    },
    []
  );

  const getCachedTemplates = useCallback(async () => {
    return offlineChecklistDb.getCachedTrainingTemplates();
  }, []);

  const triggerSync = useCallback(async () => {
    if (isOnlineRef.current) {
      await syncPendingChanges();
    } else {
      toast.error("Sem conexão com a internet");
    }
  }, [syncPendingChanges]);

  return {
    isOnline,
    syncStatus,
    pendingCount,
    createTrainingVisit,
    updateTrainingVisit,
    setResponse,
    getResponses,
    getTrainingVisit,
    completeTraining,
    cacheTemplates,
    getCachedTemplates,
    triggerSync,
    syncPendingChanges,
  };
}
