import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';

interface AssetCodesInputProps {
  itemId: string;
  pecaNome: string;
  quantidade: number;
  initialCodes?: string[];
  isAsset: boolean;
  onCodesChange: (codes: string[]) => void;
}

export default function AssetCodesInput({
  itemId,
  pecaNome,
  quantidade,
  initialCodes = [],
  isAsset,
  onCodesChange,
}: AssetCodesInputProps) {
  const [codes, setCodes] = useState<string[]>(initialCodes);
  const [newCode, setNewCode] = useState('');
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    // Initialize codes array with empty strings if needed
    if (codes.length < quantidade) {
      setCodes([...codes, ...Array(quantidade - codes.length).fill('')]);
    } else if (codes.length > quantidade) {
      setCodes(codes.slice(0, quantidade));
    }
  }, [quantidade]);

  useEffect(() => {
    onCodesChange(codes.filter(c => c.trim() !== ''));
  }, [codes]);

  const loadExistingCodes = async () => {
    const { data } = await supabase
      .from('workshop_items')
      .select('unique_code')
      .eq('omie_product_id', itemId);
    
    setExistingCodes(new Set(data?.map(d => d.unique_code) || []));
  };

  useEffect(() => {
    if (isAsset) {
      loadExistingCodes();
    }
  }, [itemId, isAsset]);

  const handleAddCode = async () => {
    if (!newCode.trim()) return;

    setRegistering(true);
    try {
      // Check if code already exists
      if (!existingCodes.has(newCode)) {
        // Register new asset
        const { error } = await supabase.from('workshop_items').insert({
          omie_product_id: itemId,
          unique_code: newCode,
          status: 'disponivel',
        });

        if (error) throw error;
        setExistingCodes(new Set([...existingCodes, newCode]));
      }

      // Add to codes array
      const emptyIndex = codes.findIndex(c => c.trim() === '');
      if (emptyIndex !== -1) {
        const newCodes = [...codes];
        newCodes[emptyIndex] = newCode;
        setCodes(newCodes);
      }
      setNewCode('');
    } finally {
      setRegistering(false);
    }
  };

  const handleRemoveCode = (index: number) => {
    const newCodes = [...codes];
    newCodes[index] = '';
    setCodes(newCodes);
  };

  if (!isAsset) return null;

  return (
    <div className="space-y-3 p-3 bg-muted/50 rounded-md border border-border">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground">
          Códigos de Ativo - {pecaNome}
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          Necessários {quantidade} código(s)
        </p>
      </div>

      <div className="space-y-2">
        {codes.map((code, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={code}
              onChange={(e) => {
                const newCodes = [...codes];
                newCodes[index] = e.target.value.toUpperCase();
                setCodes(newCodes);
              }}
              placeholder={`Código ${index + 1}`}
              className="h-8 text-xs"
              disabled={registering}
            />
            {code && (
              <Badge variant="outline" className="text-[10px]">
                {existingCodes.has(code) ? '✓ Existe' : '+ Novo'}
              </Badge>
            )}
            {code && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => handleRemoveCode(index)}
                disabled={registering}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddCode();
            }
          }}
          placeholder="Digite código e pressione Enter"
          className="h-8 text-xs"
          disabled={registering || codes.every(c => c.trim() !== '')}
        />
        <Button
          size="sm"
          onClick={handleAddCode}
          disabled={!newCode.trim() || registering || codes.every(c => c.trim() !== '')}
          className="h-8 px-2"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {codes.filter(c => c.trim() === '').length > 0 && (
        <div className="flex gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{codes.filter(c => c.trim() === '').length} código(s) pendente(s)</span>
        </div>
      )}
    </div>
  );
}
