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
import { 
  AlertTriangle, 
  Calendar, 
  Wrench, 
  ExternalLink 
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${getBgColor()}`}>
              {getIcon()}
            </div>
            <span>{event.title}</span>
          </DialogTitle>
        </DialogHeader>

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

          {event.link && (
            <div className="pt-4">
              <Link to={event.link} onClick={() => onOpenChange(false)}>
                <Button className="w-full" variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver página completa
                </Button>
              </Link>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
