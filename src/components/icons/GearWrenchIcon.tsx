import { Cog, Wrench } from 'lucide-react';

interface GearWrenchIconProps {
  className?: string;
  /** Tamanho da chave sobreposta. Por padrão, o mesmo usado no menu lateral. */
  wrenchClassName?: string;
}

/**
 * Ícone composto "engrenagem + chave": Cog como base com Wrench
 * sobreposto no canto inferior direito. Usado nos itens de
 * "Novas Instalações" (menu lateral e outros contextos).
 */
export function GearWrenchIcon({ className, wrenchClassName = 'h-2.5 w-2.5' }: GearWrenchIconProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <Cog className={className} />
      <Wrench className={`absolute -bottom-0.5 -right-0.5 ${wrenchClassName}`} />
    </span>
  );
}
