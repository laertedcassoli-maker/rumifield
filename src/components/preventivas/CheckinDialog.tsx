import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  MapPin, 
  Clock, 
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useGeolocation } from '@/hooks/useGeolocation';

interface CheckinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmName: string;
  farmFazenda?: string;
  onConfirm: (lat: number | null, lon: number | null) => void;
  isLoading: boolean;
}

export function CheckinDialog({
  open,
  onOpenChange,
  farmName,
  farmFazenda,
  onConfirm,
  isLoading,
}: CheckinDialogProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { latitude, longitude, accuracy, loading: geoLoading, error: geoError, getLocation, hasLocation } = useGeolocation();

  // Update time every second while dialog is open
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [open]);

  // Request location when dialog opens
  useEffect(() => {
    if (open) {
      getLocation();
    }
  }, [open, getLocation]);

  const handleConfirm = () => {
    onConfirm(latitude, longitude);
  };

  const handleConfirmWithoutLocation = () => {
    onConfirm(null, null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Check-in
          </DialogTitle>
          <DialogDescription>
            Registrar entrada na fazenda
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Farm Info */}
          <div className="rounded-lg bg-muted p-4">
            <p className="font-medium">{farmName}</p>
            {farmFazenda && (
              <p className="text-sm text-muted-foreground">{farmFazenda}</p>
            )}
          </div>

          {/* Current Time */}
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Data e Hora</p>
              <p className="font-medium">
                {format(currentTime, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Location Status */}
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <MapPin className={`h-5 w-5 ${hasLocation ? 'text-green-600' : geoError ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Localização</p>
              {geoLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Obtendo localização...</span>
                </div>
              ) : hasLocation ? (
                <div>
                  <p className="font-medium text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Localização capturada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
                    {accuracy && ` (±${Math.round(accuracy)}m)`}
                  </p>
                </div>
              ) : geoError ? (
                <p className="text-sm text-destructive">{geoError}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Aguardando...</p>
              )}
            </div>
            {!geoLoading && !hasLocation && (
              <Button variant="outline" size="sm" onClick={() => getLocation()}>
                Tentar novamente
              </Button>
            )}
          </div>

          {/* Warning if no location */}
          {!geoLoading && !hasLocation && geoError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Não foi possível obter a localização. Você pode continuar sem ela, mas o registro ficará incompleto.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          
          {hasLocation ? (
            <Button onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirmar Check-in
                </>
              )}
            </Button>
          ) : !geoLoading && geoError ? (
            <Button onClick={handleConfirmWithoutLocation} disabled={isLoading} variant="secondary">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Continuar sem localização'
              )}
            </Button>
          ) : (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Aguardando localização...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
