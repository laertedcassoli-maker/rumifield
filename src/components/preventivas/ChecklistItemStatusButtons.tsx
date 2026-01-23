import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItemStatusButtonsProps {
  value: 'S' | 'N' | 'NA' | null;
  onChange: (value: 'S' | 'N' | 'NA') => void;
  disabled?: boolean;
}

export default function ChecklistItemStatusButtons({ 
  value, 
  onChange, 
  disabled 
}: ChecklistItemStatusButtonsProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full">
      <Button
        type="button"
        variant={value === 'S' ? 'default' : 'outline'}
        size="sm"
        disabled={disabled}
        onClick={() => onChange('S')}
        className={cn(
          "h-11 px-2 sm:px-4 text-xs sm:text-sm font-medium transition-all",
          value === 'S' 
            ? "bg-success text-success-foreground hover:bg-success/90 border-success"
            : "hover:bg-success/10 hover:text-success hover:border-success/40"
        )}
      >
        <CheckCircle2 className="h-4 w-4 sm:mr-1.5 shrink-0" />
        <span className="hidden sm:inline">OK</span>
      </Button>
      <Button
        type="button"
        variant={value === 'N' ? 'default' : 'outline'}
        size="sm"
        disabled={disabled}
        onClick={() => onChange('N')}
        className={cn(
          "h-11 px-2 sm:px-4 text-xs sm:text-sm font-medium transition-all",
          value === 'N' 
            ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
            : "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
        )}
      >
        <XCircle className="h-4 w-4 sm:mr-1.5 shrink-0" />
        <span className="hidden sm:inline">Falha</span>
      </Button>
      <Button
        type="button"
        variant={value === 'NA' ? 'default' : 'outline'}
        size="sm"
        disabled={disabled}
        onClick={() => onChange('NA')}
        className={cn(
          "h-11 px-2 sm:px-4 text-xs sm:text-sm font-medium transition-all",
          value === 'NA' 
            ? "bg-muted text-muted-foreground" 
            : "hover:bg-muted/50"
        )}
      >
        <MinusCircle className="h-4 w-4 sm:mr-1.5 shrink-0" />
        <span className="hidden sm:inline">N/A</span>
      </Button>
    </div>
  );
}
