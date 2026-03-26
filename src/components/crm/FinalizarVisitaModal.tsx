import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { offlineDb } from '@/lib/offline-db';
import { withTimeout } from '@/lib/supabase-helpers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle, Clock, LogOut, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInMinutes } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string;
  clientId: string;
  onFinalized: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`;
  return `${m}min`;
}

export function FinalizarVisitaModal({ open, onOpenChange, visitId, clientId, onFinalized }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const geo = useGeolocation();
  const queryClient = useQueryClient();

  const now = new Date();

  const { data: visit } = useQuery({
    queryKey: ['crm-visit-checkin', visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_visits')
        .select('checkin_at')
        .eq('id', visitId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const pendingAudios = useLiveQuery(
    () => offlineDb.crm_visit_audios.where('visit_id').equals(visitId).count(),
    [visitId],
    0
  );

  const durationMinutes = visit?.checkin_at
    ? differenceInMinutes(now, new Date(visit.checkin_at))
    : null;

  // @ts-ignore
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      let lat: number | null = null;
      let lon: number | null = null;
      try {
        await geo.getLocation();
        lat = geo.latitude;
        lon = geo.longitude;
      } catch { /* proceed */ }

      const { error } = await withTimeout(
        supabase
          .from('crm_visits')
          .update({
            status: 'concluida',
            checkout_at: new Date().toISOString(),
            checkout_lat: lat,
            checkout_lon: lon,
          })
          .eq('id', visitId)
      );
      if (error) throw error;

      // Snapshot product states
      const { data: products, error: productsError } = await withTimeout(
        supabase
          .from('crm_client_products')
          .select('id, product_code, stage, value_estimated, probability, loss_reason_id, loss_notes')
          .eq('client_id', clientId)
      );
      if (productsError) throw productsError;

      if (products && products.length > 0) {
        const snapshotInserts = products.map((p: any) => ({
          visit_id: visitId,
          client_product_id: p.id,
          product_code: p.product_code,
          stage: p.stage,
          value_estimated: p.value_estimated,
          probability: p.probability,
          loss_reason_id: p.loss_reason_id,
          loss_notes: p.loss_notes,
        }));
        const { error: snapError } = await withTimeout(
          supabase
            .from('crm_visit_product_snapshots')
            .upsert(snapshotInserts, { onConflict: 'visit_id,client_product_id' })
        );
        if (snapError) {
          // Rollback: revert visit to em_andamento
          await supabase
            .from('crm_visits')
            .update({ status: 'em_andamento', checkout_at: null, checkout_lat: null, checkout_lon: null })
            .eq('id', visitId);
          throw snapError;
        }
      }
    },
    onSuccess: () => {
      toast({ title: 'Visita finalizada com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['crm-visitas'] });
      queryClient.invalidateQueries({ queryKey: ['crm-carteira-visits'] });
      queryClient.invalidateQueries({ queryKey: ['crm-carteira'] });
      queryClient.invalidateQueries({ queryKey: ['crm-visit', visitId] });
      onOpenChange(false);
      onFinalized();
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Finalizar Visita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Deseja encerrar esta visita?</p>

          {visit?.checkin_at && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Check-in:</span>
                <span className="font-medium">{format(new Date(visit.checkin_at), 'dd/MM HH:mm')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <LogOut className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Término:</span>
                <span className="font-medium">{format(now, 'dd/MM HH:mm')}</span>
              </div>
              {durationMinutes != null && durationMinutes > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Duração:</span>
                  <span className="font-medium">{formatDuration(durationMinutes)}</span>
                </div>
              )}
            </div>
          )}

          {pendingAudios > 0 && (
            <div className="flex items-start gap-2 text-sm p-3 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{pendingAudios} áudio(s) pendente(s) de envio. Serão enviados quando houver conexão.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}>
            {finalizeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
