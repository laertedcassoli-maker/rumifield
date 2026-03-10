import { Clock, Eye, Package, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WorkOrder {
  id: string;
  code: string;
  activity_id: string;
  status: 'aguardando' | 'em_manutencao' | 'concluido';
  assigned_to_user_id: string | null;
  total_time_seconds: number;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  activities?: {
    id: string;
    name: string;
    execution_type: string;
    has_motor?: boolean;
  };
  profiles?: {
    nome: string;
  };
  item_info?: {
    unique_code?: string;
    product_name?: string;
    meter_hours_last?: number;
    motor_replaced_at_meter_hours?: number;
  };
  parts_count?: number;
}

interface OSKanbanProps {
  workOrders: WorkOrder[];
  onViewOS: (os: WorkOrder) => void;
}

const statusConfig = {
  aguardando: {
    label: 'Aguardando',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    badgeColor: 'bg-yellow-100 text-yellow-800',
  },
  em_manutencao: {
    label: 'Em Manutenção',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
  concluido: {
    label: 'Concluído',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    badgeColor: 'bg-green-100 text-green-800',
  },
};

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

function KanbanColumn({ 
  status, 
  orders, 
  onViewOS 
}: { 
  status: 'aguardando' | 'em_manutencao' | 'concluido';
  orders: WorkOrder[];
  onViewOS: (os: WorkOrder) => void;
}) {
  const config = statusConfig[status];

  return (
    <div className={`flex-1 min-w-[280px] max-w-[350px] rounded-lg border ${config.borderColor} ${config.bgColor}`}>
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{config.label}</h3>
          <Badge variant="secondary" className="text-xs">
            {orders.length}
          </Badge>
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="p-2 space-y-2">
          {orders.map((os) => (
            <Card 
              key={os.id}
              className="cursor-pointer hover:shadow-md transition-shadow bg-card"
              onClick={() => onViewOS(os)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-mono font-bold text-sm">{os.code}</p>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => {
                    e.stopPropagation();
                    onViewOS(os);
                  }}>
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground mb-1">{os.activities?.name}</p>
                
                {os.item_info?.unique_code && (
                  <Badge variant="secondary" className="font-mono text-xs mb-1">
                    {os.item_info.unique_code}
                  </Badge>
                )}
                
                {os.item_info?.product_name && (
                  <p className="text-xs text-muted-foreground break-words whitespace-normal mt-1 mb-2">
                    {os.item_info.product_name}
                  </p>
                )}

                {/* Motor hours since last replacement */}
                {os.item_info?.motor_replaced_at_meter_hours != null && os.item_info?.meter_hours_last != null && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mb-2">
                    <Wrench className="h-3 w-3" />
                    <span>Motor: {(os.item_info.meter_hours_last - os.item_info.motor_replaced_at_meter_hours).toFixed(0)}h</span>
                  </div>
                )}

                {os.profiles?.nome && (
                  <p className="text-xs text-muted-foreground mb-2">
                    👤 {os.profiles.nome}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span className="font-mono">{formatTime(os.total_time_seconds)}</span>
                    </div>
                    {(os.parts_count ?? 0) > 0 && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span>{os.parts_count}</span>
                      </div>
                    )}
                  </div>
                  <span>{format(new Date(os.created_at), "dd/MM", { locale: ptBR })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {orders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma OS
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function OSKanban({ workOrders, onViewOS }: OSKanbanProps) {
  const aguardando = workOrders.filter(wo => wo.status === 'aguardando');
  const emManutencao = workOrders.filter(wo => wo.status === 'em_manutencao');
  const concluido = workOrders.filter(wo => wo.status === 'concluido');

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      <KanbanColumn status="aguardando" orders={aguardando} onViewOS={onViewOS} />
      <KanbanColumn status="em_manutencao" orders={emManutencao} onViewOS={onViewOS} />
      <KanbanColumn status="concluido" orders={concluido} onViewOS={onViewOS} />
    </div>
  );
}
