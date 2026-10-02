// Unidades e controle de consumo do Estoque Uso/Consumo.
export const UNIDADES = ['un', 'm', 'kg', 'L', 'cx', 'rolo', 'par', 'pç'] as const;
export type Unidade = typeof UNIDADES[number];
const DECIMAIS = new Set(['m', 'kg', 'L']);

export type ControleConsumo = 'por_uso' | 'a_granel';

/** Converte e valida a quantidade conforme a unidade; lança erro com mensagem amigável. */
export function parseQuantidade(v: string, unidade?: string | null): number {
  const q = Number(String(v ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(q) || q <= 0) throw new Error('Informe uma quantidade maior que zero.');
  const u = unidade || 'un';
  if (!DECIMAIS.has(u) && !Number.isInteger(q)) throw new Error(`Para a unidade "${u}" use apenas números inteiros.`);
  return q;
}

export const fmtQtd = (n: number, unidade?: string | null) =>
  `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade || 'un'}`;
