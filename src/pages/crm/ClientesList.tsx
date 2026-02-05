import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Building2, MapPin, Phone, ChevronRight, WifiOff } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useOffline } from '@/contexts/OfflineContext';
import { useOfflineClientes } from '@/hooks/useOfflineData';

export default function ClientesList() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { isOnline } = useOffline();
  const { clientes: offlineClientes, isLoading: offlineLoading } = useOfflineClientes();

  // Online query
  const { data: onlineClientes, isLoading: onlineLoading } = useQuery({
    queryKey: ['clientes-crm', debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, estado, telefone, status')
        .eq('status', 'ativo')
        .order('nome');

      if (debouncedSearch) {
        query = query.or(`nome.ilike.%${debouncedSearch}%,fazenda.ilike.%${debouncedSearch}%,cidade.ilike.%${debouncedSearch}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
    enabled: isOnline,
  });

  // Use offline data when offline, online data when online
  const clientes = useMemo(() => {
    if (!isOnline) {
      // Filter offline data based on search
      const searchLower = debouncedSearch.toLowerCase();
      return offlineClientes
        .filter(c => c.status === 'ativo')
        .filter(c => {
          if (!debouncedSearch) return true;
          return (
            c.nome.toLowerCase().includes(searchLower) ||
            (c.fazenda?.toLowerCase().includes(searchLower) ?? false) ||
            (c.cidade?.toLowerCase().includes(searchLower) ?? false)
          );
        })
        .slice(0, 50);
    }
    return onlineClientes || [];
  }, [isOnline, onlineClientes, offlineClientes, debouncedSearch]);

  const isLoading = isOnline ? onlineLoading : offlineLoading;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Visão 360° dos seus clientes</p>
        </div>
        {!isOnline && (
          <Badge variant="secondary" className="gap-1">
            <WifiOff className="h-3 w-3" />
            Offline
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, fazenda ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Client List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))
        ) : clientes?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum cliente encontrado
            </CardContent>
          </Card>
        ) : (
          clientes?.map((cliente) => (
            <Link key={cliente.id} to={`/clientes/${cliente.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium truncate">{cliente.nome}</span>
                      </div>
                      
                      {cliente.fazenda && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5 ml-6">
                          {cliente.fazenda}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-1 ml-6 text-xs text-muted-foreground">
                        {cliente.cidade && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ''}
                          </span>
                        )}
                        {cliente.telefone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {cliente.telefone}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {clientes && clientes.length >= 50 && (
        <p className="text-center text-sm text-muted-foreground">
          Mostrando os primeiros 50 resultados. Refine sua busca para encontrar mais.
        </p>
      )}
    </div>
  );
}
