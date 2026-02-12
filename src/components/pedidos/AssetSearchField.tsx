import { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandInput, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Search, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface WorkshopItem {
  id: string;
  unique_code: string;
  current_motor_code?: string;
  status?: string;
}

interface AssetSearchFieldProps {
  pecaId: string;
  onAssetSelected: (workshopItemId: string | null) => void;
  currentAssetId?: string | null;
  disabled?: boolean;
}

export default function AssetSearchField({ 
  pecaId, 
  onAssetSelected, 
  currentAssetId, 
  disabled = false 
}: AssetSearchFieldProps) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<WorkshopItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<WorkshopItem | null>(null);
  const [searchValue, setSearchValue] = useState('');

  // Load current asset on mount
  useEffect(() => {
    if (currentAssetId) {
      fetchAssetDetails(currentAssetId);
    }
  }, [currentAssetId]);

  // Auto-load assets when popover opens
  useEffect(() => {
    if (open) {
      searchAssets('');
    }
  }, [open]);

  const fetchAssetDetails = async (assetId: string) => {
    try {
      const { data } = await supabase
        .from('workshop_items')
        .select('id, unique_code, current_motor_code, status')
        .eq('id', assetId)
        .single();
      if (data) {
        setSelectedAsset(data);
      }
    } catch (error) {
      console.error('Error fetching asset:', error);
    }
  };

  const searchAssets = async (query: string) => {
    if (!pecaId) return;
    
    setIsLoading(true);
    try {
      // Search workshop_items by omie_product_id matching the part
      const { data } = await supabase
        .from('workshop_items')
        .select('id, unique_code, current_motor_code, status')
        .eq('omie_product_id', pecaId)
        .ilike('unique_code', `%${query}%`)
        .order('unique_code', { ascending: true });
      
      setAssets(data || []);
    } catch (error) {
      console.error('Error searching assets:', error);
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (asset: WorkshopItem) => {
    setSelectedAsset(asset);
    onAssetSelected(asset.id);
    setOpen(false);
    setSearchValue('');
  };

  const handleClear = () => {
    setSelectedAsset(null);
    onAssetSelected(null);
    setSearchValue('');
  };

  return (
    <div className="space-y-2">
      <Label>Código do Ativo (se aplicável)</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedAsset ? (
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4 opacity-50" />
                {selectedAsset.unique_code}
              </span>
            ) : (
              <span className="text-muted-foreground">Buscar ativo...</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput 
              placeholder="Buscar por código..." 
              value={searchValue}
              onValueChange={(value) => {
                setSearchValue(value);
                searchAssets(value);
              }}
              disabled={disabled}
            />
            <CommandEmpty>
              {isLoading ? 'Buscando...' : searchValue.trim() ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <p className="text-sm text-muted-foreground">Nenhum ativo encontrado.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isCreating}
                    onClick={async () => {
                      setIsCreating(true);
                      try {
                        const { data, error } = await supabase
                          .from('workshop_items')
                          .insert({ unique_code: searchValue.trim(), omie_product_id: pecaId })
                          .select('id, unique_code, current_motor_code, status')
                          .single();
                        if (error) throw error;
                        if (data) {
                          handleSelect(data);
                          toast({ title: `Ativo "${data.unique_code}" criado com sucesso!` });
                        }
                      } catch (err: any) {
                        console.error('Error creating asset:', err);
                        toast({ title: 'Erro ao criar ativo', description: err?.message || 'Sem permissão ou erro inesperado.', variant: 'destructive' });
                      } finally {
                        setIsCreating(false);
                      }
                    }}
                  >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Criar ativo "{searchValue.trim()}"
                  </Button>
                </div>
              ) : 'Nenhum ativo encontrado para este tipo de peça.'}
            </CommandEmpty>
            <CommandList>
              <CommandGroup>
                {assets.map((asset) => (
                  <CommandItem
                    key={asset.id}
                    value={asset.id}
                    onSelect={() => handleSelect(asset)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1">
                        <div className="font-medium">{asset.unique_code}</div>
                        {asset.current_motor_code && (
                          <div className="text-xs text-muted-foreground">
                            Motor: {asset.current_motor_code}
                          </div>
                        )}
                      </div>
                      {asset.status && (
                        <Badge variant="outline" className="text-xs">
                          {asset.status}
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedAsset && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded">
          <span className="text-sm flex-1">
            Ativo: <strong>{selectedAsset.unique_code}</strong>
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
