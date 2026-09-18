import { Cog, Wrench } from 'lucide-react';

interface GearWrenchIconProps {
  className?: string;
}

/**
 * Ícone composto "engrenagem + chave": Cog como base com Wrench
 * sobreposto no canto inferior direito. Usado nos itens de
 * "Novas Instalações" (menu lateral e outros contextos).
 */
export function GearWrenchIcon({ className }: GearWrenchIconProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <Cog className={className} />
      <Wrench className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
    </span>
  );
}
