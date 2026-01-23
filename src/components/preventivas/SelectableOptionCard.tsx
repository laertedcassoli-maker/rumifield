import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

interface SelectableOptionCardProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  variant?: "default" | "warning" | "danger" | "success";
}

export default function SelectableOptionCard({
  label,
  selected,
  disabled,
  loading = false,
  onClick,
  icon,
  variant = "default",
}: SelectableOptionCardProps) {
  const variantStyles = {
    default: {
      base: "border-border hover:border-primary/50 hover:bg-primary/5",
      selected: "border-primary bg-primary/10 ring-1 ring-primary/30",
    },
    warning: {
      base: "border-amber-200 hover:border-amber-400 hover:bg-amber-50",
      selected: "border-amber-400 bg-amber-50 ring-1 ring-amber-300",
    },
    danger: {
      base: "border-red-200 hover:border-red-400 hover:bg-red-50",
      selected: "border-red-400 bg-red-50 ring-1 ring-red-300",
    },
    success: {
      base: "border-green-200 hover:border-green-400 hover:bg-green-50",
      selected: "border-green-400 bg-green-50 ring-1 ring-green-300",
    },
  };

  const styles = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all text-sm",
        isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]",
        selected ? styles.selected : styles.base
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
          selected
            ? variant === "warning"
              ? "bg-amber-500 border-amber-500"
              : variant === "danger"
                ? "bg-red-500 border-red-500"
                : variant === "success"
                  ? "bg-green-500 border-green-500"
                  : "bg-primary border-primary"
            : "border-muted-foreground/30"
        )}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 text-white animate-spin" />
        ) : (
          selected && <Check className="h-3 w-3 text-white" />
        )}
      </div>

      {/* Icon */}
      {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}

      {/* Label */}
      <span className={cn("flex-1", selected && "font-medium")}>{label}</span>
    </button>
  );
}