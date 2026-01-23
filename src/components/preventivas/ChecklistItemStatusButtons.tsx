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
    <div className="grid grid-cols-3 gap-2">
      <Button
        type="button"
        variant={value === 'S' ? 'default' : 'outline'}
        size="default"
        disabled={disabled}
        onClick={() => onChange('S')}
        className={cn(
          "h-12 px-3 sm:px-6 text-sm sm:text-base font-medium transition-all min-w-0",
          value === 'S' 
            ? "bg-success text-success-foreground hover:bg-success/90 border-success"
            : "hover:bg-success/10 hover:text-success hover:border-success/40"
        )}
      >
        <CheckCircle2 className="h-5 w-5 mr-2" />
        OK
      </Button>
      <Button
        type="button"
        variant={value === 'N' ? 'default' : 'outline'}
        size="default"
        disabled={disabled}
        onClick={() => onChange('N')}
        className={cn(
          "h-12 px-3 sm:px-6 text-sm sm:text-base font-medium transition-all min-w-0",
          value === 'N' 
            ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
            : "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
        )}
      >
        <XCircle className="h-5 w-5 mr-2" />
        Falha
      </Button>
      <Button
        type="button"
        variant={value === 'NA' ? 'default' : 'outline'}
        size="default"
        disabled={disabled}
        onClick={() => onChange('NA')}
        className={cn(
          "h-12 px-3 sm:px-6 text-sm sm:text-base font-medium transition-all min-w-0",
          value === 'NA' 
            ? "bg-muted text-muted-foreground" 
            : "hover:bg-muted/50"
        )}
      >
        <MinusCircle className="h-5 w-5 mr-2" />
        N/A
      </Button>
    </div>
  );
}
