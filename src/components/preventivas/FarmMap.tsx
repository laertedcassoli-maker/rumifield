import { useEffect, useMemo, useRef } from 'react';
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
    sem_historico: '#6b7280',
    atrasada: '#ef4444',
    elegivel: '#f59e0b',
    em_dia: '#22c55e',
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

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function FarmMap({ clients, highlightedClientId, onClientClick }: FarmMapProps) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

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

  // Mount Leaflet map + markers
  useEffect(() => {
    if (!mapElRef.current) return;

    // (Re)create map instance
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current.clear();

    const map = L.map(mapElRef.current, {
      center: mapCenter,
      zoom: mapZoom,
      zoomControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    clientsWithCoords.forEach((client) => {
      const marker = L.marker([client.latitude!, client.longitude!], {
        icon: createCustomIcon(client.preventive_status),
      });

      const title = escapeHtml(client.client_name);
      const farm = client.fazenda ? `<div style=\"opacity:.8;font-size:12px;margin-top:2px;\">${escapeHtml(client.fazenda)}</div>` : '';

      const status = statusConfig[client.preventive_status]?.label || client.preventive_status;
      const freq = client.preventive_frequency_days ? `<span style=\"opacity:.8;font-size:12px;margin-left:8px;\">${client.preventive_frequency_days}d</span>` : '';
      const days =
        client.days_until_due !== null
          ? `<div style=\"font-size:12px;margin-top:6px;\"><span style=\"opacity:.8\">Dias restantes: </span><b>${client.days_until_due}</b></div>`
          : '';

      const mapsUrl = getGoogleMapsUrl(client);
      const mapsBtn = mapsUrl
        ? `<button type=\"button\" data-open-maps=\"1\" style=\"margin-top:8px;width:100%;padding:6px 8px;border-radius:8px;border:1px solid rgba(0,0,0,.15);background:white;font-size:12px;cursor:pointer;\">Abrir no Google Maps</button>`
        : '';

      const popupHtml = `
        <div style=\"min-width:200px;\">
          <div style=\"font-weight:600;font-size:13px;\">${title}</div>
          ${farm}
          <div style=\"margin-top:6px;font-size:12px;\">
            <span style=\"padding:2px 6px;border-radius:999px;border:1px solid rgba(0,0,0,.15);\">${escapeHtml(status)}</span>
            ${freq}
          </div>
          ${days}
          ${mapsBtn}
        </div>
      `;

      // Tooltip on hover
      const tooltipHtml = `
        <div style="min-width:160px;">
          <div style="font-weight:600;font-size:12px;">${title}</div>
          ${farm}
          <div style="margin-top:4px;font-size:11px;">
            <span style="padding:2px 6px;border-radius:999px;border:1px solid rgba(0,0,0,.15);background:rgba(255,255,255,0.9);">${escapeHtml(status)}</span>
            ${client.days_until_due !== null ? `<span style="margin-left:6px;opacity:.8;">${client.days_until_due}d</span>` : ''}
          </div>
        </div>
      `;

      marker.bindTooltip(tooltipHtml, {
        direction: 'top',
        offset: [0, -20],
        opacity: 0.95,
        className: 'farm-tooltip',
      });

      marker.bindPopup(popupHtml);

      marker.on('click', () => onClientClick?.(client.client_id));
      marker.on('popupopen', (e) => {
        const popupEl = (e as any)?.popup?.getElement?.() as HTMLElement | undefined;
        if (!popupEl || !mapsUrl) return;
        const btn = popupEl.querySelector('button[data-open-maps="1"]') as HTMLButtonElement | null;
        if (btn) {
          btn.onclick = () => window.open(mapsUrl, '_blank');
        }
      });

      marker.addTo(map);
      markersRef.current.set(client.client_id, marker);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsWithCoords, mapCenter[0], mapCenter[1], mapZoom]);

  // Focus/open popup when a client is highlighted
  useEffect(() => {
    if (!highlightedClientId) return;
    const marker = markersRef.current.get(highlightedClientId);
    const map = mapRef.current;
    if (!marker || !map) return;

    const latlng = marker.getLatLng();
    map.flyTo([latlng.lat, latlng.lng], Math.max(map.getZoom(), 12), { duration: 0.5 });
    marker.openPopup();
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
            <div ref={mapElRef} style={{ height: '100%', width: '100%' }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
