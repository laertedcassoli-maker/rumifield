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
    <div className="grid grid-cols-3 gap-1.5 w-full">
      <Button
        type="button"
        variant={value === 'S' ? 'default' : 'outline'}
        size="sm"
        disabled={disabled}
        onClick={() => onChange('S')}
        className={cn(
          "h-12 px-1 text-xs font-medium transition-all flex-col gap-0.5 sm:flex-row sm:gap-1.5 sm:h-11 sm:px-4 sm:text-sm",
          value === 'S' 
            ? "bg-success text-success-foreground hover:bg-success/90 border-success shadow-sm"
            : "hover:bg-success/10 hover:text-success hover:border-success/50"
        )}
      >
        <CheckCircle2 className="h-5 w-5 sm:h-4 sm:w-4 shrink-0" />
        <span>OK</span>
      </Button>
      <Button
        type="button"
        variant={value === 'N' ? 'default' : 'outline'}
        size="sm"
        disabled={disabled}
        onClick={() => onChange('N')}
        className={cn(
          "h-12 px-1 text-xs font-medium transition-all flex-col gap-0.5 sm:flex-row sm:gap-1.5 sm:h-11 sm:px-4 sm:text-sm",
          value === 'N' 
            ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm" 
            : "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
        )}
      >
        <XCircle className="h-5 w-5 sm:h-4 sm:w-4 shrink-0" />
        <span>Falha</span>
      </Button>
      <Button
        type="button"
        variant={value === 'NA' ? 'default' : 'outline'}
        size="sm"
        disabled={disabled}
        onClick={() => onChange('NA')}
        className={cn(
          "h-12 px-1 text-xs font-medium transition-all flex-col gap-0.5 sm:flex-row sm:gap-1.5 sm:h-11 sm:px-4 sm:text-sm",
          value === 'NA' 
            ? "bg-muted text-muted-foreground shadow-sm" 
            : "hover:bg-muted/60"
        )}
      >
        <MinusCircle className="h-5 w-5 sm:h-4 sm:w-4 shrink-0" />
        <span>N/A</span>
      </Button>
    </div>
  );
}
