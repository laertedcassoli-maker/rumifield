import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MapPin, ExternalLink, X, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const itemStatusConfig = {
  planejado: { label: 'Planejado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  executado: { label: 'Executado', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  reagendado: { label: 'Reagendado', color: 'bg-warning/10 text-warning border-warning/20' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

interface RouteItem {
  id: string;
  client_id: string;
  client_name: string;
  client_fazenda: string | null;
  client_link_maps: string | null;
  status: string;
  planned_date: string | null;
}

interface SortableRouteItemProps {
  item: RouteItem;
  index: number;
  isEditable: boolean;
  isAdminOrCoordinator: boolean;
  onRemove: (itemId: string) => void;
  onStatusChange: (itemId: string, newStatus: string) => void;
  isUpdating: boolean;
}

export function SortableRouteItem({
  item,
  index,
  isEditable,
  isAdminOrCoordinator,
  onRemove,
  onStatusChange,
  isUpdating,
}: SortableRouteItemProps) {
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isEditable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Get completed date from status (when executado, show current date as placeholder)
  const completedDate = item.status === 'executado' ? item.planned_date : null;

  const handleStatusSelect = (newStatus: string) => {
    if (newStatus !== item.status) {
      setPendingStatus(newStatus);
      setIsStatusDialogOpen(true);
    }
  };

  const confirmStatusChange = () => {
    if (pendingStatus) {
      onStatusChange(item.id, pendingStatus);
      setPendingStatus(null);
    }
    setIsStatusDialogOpen(false);
  };

  const cancelStatusChange = () => {
    setPendingStatus(null);
    setIsStatusDialogOpen(false);
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted' : ''}>
      <TableCell className="w-16 text-center font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          {isEditable && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab touch-none p-1 hover:bg-muted rounded"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <span>{index + 1}</span>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{item.client_name}</div>
          {item.client_fazenda && (
            <div className="text-sm text-muted-foreground">{item.client_fazenda}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        {item.client_link_maps ? (
          <a
            href={item.client_link_maps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
          >
            <MapPin className="h-3 w-3" />
            Ver no Maps
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell>
        {completedDate
          ? format(new Date(completedDate), 'dd/MM/yyyy', { locale: ptBR })
          : '-'}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={itemStatusConfig[item.status as keyof typeof itemStatusConfig]?.color}
        >
          {itemStatusConfig[item.status as keyof typeof itemStatusConfig]?.label}
        </Badge>
      </TableCell>
      {isAdminOrCoordinator && (
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            {isEditable ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover fazenda?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A fazenda "{item.client_name}" será removida da rota.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onRemove(item.id)}>
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <>
                <Select
                  value={item.status}
                  onValueChange={handleStatusSelect}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planejado">Planejado</SelectItem>
                    <SelectItem value="executado">Executado</SelectItem>
                    <SelectItem value="reagendado">Reagendado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>

                <AlertDialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar alteração de status?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O status da fazenda "{item.client_name}" será alterado de{' '}
                        <strong>{itemStatusConfig[item.status as keyof typeof itemStatusConfig]?.label}</strong> para{' '}
                        <strong>{pendingStatus ? itemStatusConfig[pendingStatus as keyof typeof itemStatusConfig]?.label : ''}</strong>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={cancelStatusChange}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={confirmStatusChange}>
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
