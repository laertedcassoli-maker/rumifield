import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, MapPin, AlertTriangle } from 'lucide-react';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons by status
const createCustomIcon = (status: string) => {
  const colors: Record<string, string> = {
    sem_historico: '#6b7280', // gray
    atrasada: '#ef4444', // red
    elegivel: '#f59e0b', // yellow/warning
    em_dia: '#22c55e', // green
  };
  
  const color = colors[status] || '#6b7280';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

const statusConfig: Record<string, { label: string; color: string }> = {
  sem_historico: { label: 'Sem Histórico', color: 'bg-muted text-muted-foreground' },
  atrasada: { label: 'Atrasada', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  elegivel: { label: 'Elegível', color: 'bg-warning/10 text-warning border-warning/20' },
  em_dia: { label: 'Em Dia', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
};

export interface FarmMapClient {
  client_id: string;
  client_name: string;
  fazenda: string | null;
  latitude: number | null;
  longitude: number | null;
  link_maps: string | null;
  preventive_status: string;
  preventive_frequency_days: number | null;
  days_until_due: number | null;
}

interface FarmMapProps {
  clients: FarmMapClient[];
  highlightedClientId?: string | null;
  onClientClick?: (clientId: string) => void;
}

// Component to handle map view updates
function MapUpdater({ highlightedClientId, clients }: { 
  highlightedClientId?: string | null;
  clients: FarmMapClient[];
}) {
  const map = useMap();
  const prevHighlightedRef = useRef<string | null>(null);

  useEffect(() => {
    if (highlightedClientId && highlightedClientId !== prevHighlightedRef.current) {
      const client = clients.find(c => c.client_id === highlightedClientId);
      if (client?.latitude && client?.longitude) {
        map.flyTo([client.latitude, client.longitude], 12, { duration: 0.5 });
      }
      prevHighlightedRef.current = highlightedClientId;
    }
  }, [highlightedClientId, clients, map]);

  return null;
}

export default function FarmMap({ clients, highlightedClientId, onClientClick }: FarmMapProps) {
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

  // Filter clients with valid coordinates
  const clientsWithCoords = useMemo(() => {
    return clients.filter(c => {
      if (c.latitude === null || c.longitude === null) return false;
      if (c.latitude < -90 || c.latitude > 90) return false;
      if (c.longitude < -180 || c.longitude > 180) return false;
      return true;
    });
  }, [clients]);

  const clientsWithoutCoords = clients.length - clientsWithCoords.length;

  // Calculate map center
  const mapCenter = useMemo((): [number, number] => {
    if (clientsWithCoords.length === 0) {
      return [-15.7801, -47.9292]; // Default to Brazil center
    }
    
    const avgLat = clientsWithCoords.reduce((sum, c) => sum + (c.latitude || 0), 0) / clientsWithCoords.length;
    const avgLng = clientsWithCoords.reduce((sum, c) => sum + (c.longitude || 0), 0) / clientsWithCoords.length;
    
    return [avgLat, avgLng];
  }, [clientsWithCoords]);

  // Calculate appropriate zoom level based on spread
  const mapZoom = useMemo(() => {
    if (clientsWithCoords.length === 0) return 4;
    if (clientsWithCoords.length === 1) return 12;
    
    const lats = clientsWithCoords.map(c => c.latitude!);
    const lngs = clientsWithCoords.map(c => c.longitude!);
    
    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const maxSpread = Math.max(latSpread, lngSpread);
    
    if (maxSpread > 10) return 5;
    if (maxSpread > 5) return 6;
    if (maxSpread > 2) return 7;
    if (maxSpread > 1) return 8;
    return 10;
  }, [clientsWithCoords]);

  const getGoogleMapsUrl = (client: FarmMapClient) => {
    if (client.link_maps) return client.link_maps;
    if (client.latitude && client.longitude) {
      return `https://www.google.com/maps?q=${client.latitude},${client.longitude}`;
    }
    return null;
  };

  // Open popup for highlighted client
  useEffect(() => {
    if (highlightedClientId) {
      const marker = markerRefs.current.get(highlightedClientId);
      if (marker) {
        marker.openPopup();
      }
    }
  }, [highlightedClientId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Mapa das Fazendas
            </CardTitle>
            <CardDescription className="mt-1">
              Exibindo {clientsWithCoords.length} fazenda(s) no mapa (de {clients.length} visíveis na tabela)
            </CardDescription>
          </div>
          {clientsWithoutCoords > 0 && (
            <Badge variant="outline" className="flex items-center gap-1 text-warning border-warning/30">
              <AlertTriangle className="h-3 w-3" />
              {clientsWithoutCoords} sem coordenadas
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {clientsWithCoords.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center bg-muted/20 rounded-b-lg">
            <div className="text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma fazenda com coordenadas válidas</p>
              <p className="text-sm">Cadastre latitude e longitude nos clientes</p>
            </div>
          </div>
        ) : (
          <div className="h-[400px] rounded-b-lg overflow-hidden">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapUpdater 
                highlightedClientId={highlightedClientId}
                clients={clientsWithCoords}
              />
              {clientsWithCoords.map((client) => (
                <Marker
                  key={client.client_id}
                  position={[client.latitude!, client.longitude!]}
                  icon={createCustomIcon(client.preventive_status)}
                  ref={(ref) => {
                    if (ref) {
                      markerRefs.current.set(client.client_id, ref);
                    }
                  }}
                  eventHandlers={{
                    click: () => onClientClick?.(client.client_id)
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px] p-1">
                      <h3 className="font-semibold text-sm mb-1">{client.client_name}</h3>
                      {client.fazenda && (
                        <p className="text-xs text-muted-foreground mb-2">{client.fazenda}</p>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${statusConfig[client.preventive_status]?.color || ''}`}
                        >
                          {statusConfig[client.preventive_status]?.label || client.preventive_status}
                        </Badge>
                        {client.preventive_frequency_days && (
                          <span className="text-xs text-muted-foreground">
                            {client.preventive_frequency_days}d
                          </span>
                        )}
                      </div>
                      {client.days_until_due !== null && (
                        <p className="text-xs mb-2">
                          <span className="text-muted-foreground">Dias restantes: </span>
                          <span className={client.days_until_due < 0 ? 'text-destructive font-medium' : ''}>
                            {client.days_until_due}
                          </span>
                        </p>
                      )}
                      {getGoogleMapsUrl(client) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-xs"
                          onClick={() => window.open(getGoogleMapsUrl(client)!, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir no Google Maps
                        </Button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
