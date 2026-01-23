import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [open]);

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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Check-in
            </DrawerTitle>
            <DrawerDescription>
              Registrar entrada na fazenda
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 space-y-3">
            {/* Farm Info */}
            <div className="rounded-xl bg-muted p-4">
              <p className="font-semibold">{farmName}</p>
              {farmFazenda && (
                <p className="text-sm text-muted-foreground mt-0.5">{farmFazenda}</p>
              )}
            </div>

            {/* Current Time */}
            <div className="flex items-center gap-4 p-4 border rounded-xl">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Data e Hora</p>
                <p className="font-semibold text-lg">
                  {format(currentTime, "HH:mm:ss", { locale: ptBR })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(currentTime, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Location Status */}
            <div className="flex items-center gap-4 p-4 border rounded-xl">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                hasLocation 
                  ? 'bg-green-500/10' 
                  : geoError 
                  ? 'bg-destructive/10' 
                  : 'bg-muted'
              }`}>
                <MapPin className={`h-5 w-5 ${
                  hasLocation 
                    ? 'text-green-600' 
                    : geoError 
                    ? 'text-destructive' 
                    : 'text-muted-foreground'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Localização</p>
                {geoLoading ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Obtendo localização...</span>
                  </div>
                ) : hasLocation ? (
                  <div>
                    <p className="font-medium text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Localização capturada
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                <Button variant="outline" size="sm" onClick={() => getLocation()} className="shrink-0">
                  Tentar
                </Button>
              )}
            </div>

            {/* Warning if no location */}
            {!geoLoading && !hasLocation && geoError && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm">
                  Sem localização. O registro ficará incompleto.
                </p>
              </div>
            )}
          </div>

          <DrawerFooter className="pt-4">
            {hasLocation ? (
              <Button onClick={handleConfirm} disabled={isLoading} size="lg" className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Confirmar Check-in
                  </>
                )}
              </Button>
            ) : !geoLoading && geoError ? (
              <Button onClick={handleConfirmWithoutLocation} disabled={isLoading} size="lg" variant="secondary" className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Continuar sem localização'
                )}
              </Button>
            ) : (
              <Button disabled size="lg" className="w-full">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Aguardando localização...
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} size="lg" className="w-full">
              Cancelar
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
