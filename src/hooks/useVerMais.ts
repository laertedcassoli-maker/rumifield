import { useEffect, useMemo, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Limita a exibição de listas longas no celular (< 768px) a `pageSize` itens,
 * com "Ver mais" somando mais `pageSize`. No desktop devolve a lista inteira.
 * Volta para a primeira página quando `resetKey` muda (busca, filtros, aba, ordenação).
 */
export function useVerMais<T>(
  items: readonly T[] | null | undefined,
  { pageSize = 20, resetKey }: { pageSize?: number; resetKey?: unknown } = {},
) {
  const isMobile = useIsMobile();
  const [limite, setLimite] = useState(pageSize);
  const resetSig = JSON.stringify(resetKey ?? null);

  useEffect(() => {
    setLimite(pageSize);
  }, [resetSig, pageSize]);

  const lista = items ?? [];
  const total = lista.length;

  return useMemo(() => {
    const visiveis = isMobile ? lista.slice(0, limite) : (lista as T[]);
    return {
      visiveis: visiveis as T[],
      total,
      mostrados: visiveis.length,
      temMais: isMobile && total > limite,
      verMais: () => setLimite(l => l + pageSize),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, limite, isMobile, total, pageSize]);
}
