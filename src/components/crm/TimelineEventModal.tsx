import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  Calendar, 
  Wrench, 
  ExternalLink,
  Maximize2
} from 'lucide-react';
import { Link } from 'react-router-dom';

type EventType = 'chamado' | 'preventiva' | 'corretiva';

interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  subtitle?: string;
  date: Date;
  status: string;
  statusColor: string;
  link?: string;
}

interface TimelineEventModalProps {
  event: TimelineEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimelineEventModal({ event, open, onOpenChange }: TimelineEventModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  if (!event) return null;

  const getIcon = () => {
    switch (event.type) {
      case 'chamado':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'preventiva':
        return <Calendar className="h-5 w-5 text-green-600" />;
      case 'corretiva':
        return <Wrench className="h-5 w-5 text-blue-600" />;
    }
  };

  const getTypeLabel = () => {
    switch (event.type) {
      case 'chamado':
        return 'Chamado Técnico';
      case 'preventiva':
        return 'Manutenção Preventiva';
      case 'corretiva':
        return 'Visita Corretiva';
    }
  };

  const getBgColor = () => {
    switch (event.type) {
      case 'chamado':
        return 'bg-orange-100 dark:bg-orange-900/30';
      case 'preventiva':
        return 'bg-green-100 dark:bg-green-900/30';
      case 'corretiva':
        return 'bg-blue-100 dark:bg-blue-900/30';
    }
  };

  const hasIframeLink = !!event.link;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) setIframeLoaded(false);
      onOpenChange(isOpen);
    }}>
      <DialogContent className={hasIframeLink ? "w-[95vw] max-w-5xl h-[90vh] flex flex-col p-3 sm:p-6" : "sm:max-w-md"}>
        <DialogHeader className="shrink-0 pb-2">
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <div className={`p-2 rounded-full ${getBgColor()}`}>
                {getIcon()}
              </div>
              <div>
                <span>{event.title}</span>
                <p className="text-sm font-normal text-muted-foreground mt-0.5">
                  {getTypeLabel()} • {format(event.date, "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={event.statusColor}>
                {event.status}
              </Badge>
              {event.link && (
                <Link to={event.link} onClick={() => onOpenChange(false)}>
                  <Button size="icon" variant="ghost" title="Abrir página completa">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </DialogHeader>

        {hasIframeLink ? (
          <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border bg-muted/30">
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-background">
                <div className="space-y-3 w-full max-w-md px-4">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-32 w-full mt-4" />
                </div>
              </div>
            )}
            <iframe
              src={event.link}
              className="w-full h-full border-0"
              onLoad={() => setIframeLoaded(true)}
              title={`Detalhes - ${event.title}`}
            />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo</span>
              <span className="text-sm font-medium">{getTypeLabel()}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="outline" className={event.statusColor}>
                {event.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Data</span>
              <span className="text-sm font-medium">
                {format(event.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>

            {event.subtitle && (
              <div className="pt-2 border-t">
                <span className="text-sm text-muted-foreground block mb-1">Descrição</span>
                <p className="text-sm">{event.subtitle}</p>
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground py-4">
              Detalhes não disponíveis para visualização inline.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
