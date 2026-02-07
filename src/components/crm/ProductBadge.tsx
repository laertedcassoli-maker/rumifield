import { Badge } from '@/components/ui/badge';
import { type ProductCode, PRODUCT_LABELS } from '@/hooks/useCrmData';
import { cn } from '@/lib/utils';

const PRODUCT_COLORS: Record<ProductCode, string> = {
  ideagri: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
  rumiflow: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700',
  onfarm: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
  rumiaction: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700',
  insights: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700',
};

interface ProductBadgeProps {
  productCode: ProductCode;
  className?: string;
}

export function ProductBadge({ productCode, className }: ProductBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-1.5 py-0 font-semibold',
        PRODUCT_COLORS[productCode] || '',
        className
      )}
    >
      {PRODUCT_LABELS[productCode] || productCode}
    </Badge>
  );
}

/**
 * Returns the color classes for a product code (useful for buttons, borders, etc.)
 */
export function getProductColorClasses(productCode: ProductCode) {
  return PRODUCT_COLORS[productCode] || '';
}
