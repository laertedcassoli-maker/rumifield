import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check } from "lucide-react";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface ChecklistItemNotesProps {
  itemId: string;
  initialValue: string | null;
  onSave: (itemId: string, notes: string) => Promise<void> | void;
  disabled?: boolean;
}

export default function ChecklistItemNotes({
  itemId,
  initialValue,
  onSave,
  disabled
}: ChecklistItemNotesProps) {
  const [localValue, setLocalValue] = useState(initialValue || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastSavedValue = useRef(initialValue || '');
  const hasChanges = localValue !== lastSavedValue.current;

  // Sync with external value changes (e.g., from server refetch)
  useEffect(() => {
    if (initialValue !== null && initialValue !== lastSavedValue.current) {
      setLocalValue(initialValue);
      lastSavedValue.current = initialValue;
    }
  }, [initialValue]);

  const debouncedSave = useDebouncedCallback(async (value: string) => {
    if (value === lastSavedValue.current) return;
    
    setSaveStatus('saving');
    try {
      await onSave(itemId, value);
      lastSavedValue.current = value;
      setSaveStatus('saved');
      
      // Reset to idle after showing "saved"
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('idle');
    }
  }, 800);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedSave(newValue);
  };

  // Save immediately on blur if there are unsaved changes
  const handleBlur = async () => {
    if (localValue !== lastSavedValue.current) {
      setSaveStatus('saving');
      try {
        await onSave(itemId, localValue);
        lastSavedValue.current = localValue;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        setSaveStatus('idle');
      }
    }
  };

  return (
    <div className="relative">
      <Textarea
        placeholder="Observações (opcional)"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        className={cn(
          "text-sm pr-8 transition-colors min-h-[40px] resize-none",
          hasChanges && saveStatus === 'idle' && "border-amber-300"
        )}
        rows={1}
      />
      {/* Save status indicator */}
      <div className="absolute right-2 top-2">
        {saveStatus === 'saving' && (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        )}
        {saveStatus === 'saved' && (
          <Check className="h-4 w-4 text-success" />
        )}
      </div>
    </div>
  );
}
