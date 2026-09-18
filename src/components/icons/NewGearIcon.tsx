import { Cog } from 'lucide-react';

interface NewGearIconProps {
  className?: string;
}

/**
 * Ícone de engrenagem com selo "NEW" no canto superior direito.
 * Usado nos itens de "Novas Instalações" (menu lateral e outros contextos).
 */
export function NewGearIcon({ className }: NewGearIconProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <Cog className={className} />
      <span className="absolute -top-1 -right-1 text-[8px] font-bold leading-none bg-primary text-primary-foreground rounded-sm px-0.5">
        NEW
      </span>
    </span>
  );
}
