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
    <div className="flex gap-2">
      <Button
        type="button"
        variant={value === 'S' ? 'default' : 'outline'}
        size="lg"
        disabled={disabled}
        onClick={() => onChange('S')}
        className={cn(
          "flex-1 h-12 text-base font-medium transition-all",
          value === 'S' 
            ? "bg-green-600 hover:bg-green-700 text-white border-green-600" 
            : "hover:bg-green-50 hover:text-green-700 hover:border-green-300"
        )}
      >
        <CheckCircle2 className="h-5 w-5 mr-2" />
        OK
      </Button>
      <Button
        type="button"
        variant={value === 'N' ? 'default' : 'outline'}
        size="lg"
        disabled={disabled}
        onClick={() => onChange('N')}
        className={cn(
          "flex-1 h-12 text-base font-medium transition-all",
          value === 'N' 
            ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
            : "hover:bg-red-50 hover:text-red-700 hover:border-red-300"
        )}
      >
        <XCircle className="h-5 w-5 mr-2" />
        Falha
      </Button>
      <Button
        type="button"
        variant={value === 'NA' ? 'default' : 'outline'}
        size="lg"
        disabled={disabled}
        onClick={() => onChange('NA')}
        className={cn(
          "flex-1 h-12 text-base font-medium transition-all",
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
