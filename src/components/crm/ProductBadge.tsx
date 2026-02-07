import { Badge } from '@/components/ui/badge';
import { type ProductCode, PRODUCT_LABELS } from '@/hooks/useCrmData';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Fallback colors when DB has no badge_color configured */
const FALLBACK_COLORS: Record<ProductCode, string> = {
  ideagri: '#10b981',
  rumiflow: '#0ea5e9',
  onfarm: '#f59e0b',
  rumiaction: '#8b5cf6',
  insights: '#f43f5e',
};

/** Shared query for badge colors from the produtos table */
export function useProductBadgeColors() {
  return useQuery({
    queryKey: ['produto-badge-colors'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('produtos')
        .select('product_code, badge_color');
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        if (p.product_code && p.badge_color) map[p.product_code] = p.badge_color;
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}

interface ProductBadgeProps {
  productCode: ProductCode;
  className?: string;
  /** When true, renders muted/gray style (e.g. inactive products) */
  muted?: boolean;
}

export function ProductBadge({ productCode, className, muted }: ProductBadgeProps) {
  const { data: badgeColors } = useProductBadgeColors();
  const hex = badgeColors?.[productCode] || FALLBACK_COLORS[productCode] || '#6b7280';

  if (muted) {
    return (
      <Badge
        variant="outline"
        className={cn('text-[10px] px-1.5 py-0 font-semibold bg-muted text-muted-foreground border-border', className)}
      >
        {PRODUCT_LABELS[productCode] || productCode}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 font-semibold border', className)}
      style={{
        backgroundColor: `${hex}1a`,
        color: hex,
        borderColor: `${hex}66`,
      }}
    >
      {PRODUCT_LABELS[productCode] || productCode}
    </Badge>
  );
}

/**
 * Returns the hex color for a product code (useful for buttons, borders, etc.)
 */
export function getProductColorClasses(productCode: ProductCode) {
  // This is a static fallback; prefer useProductBadgeColors() for dynamic colors
  return FALLBACK_COLORS[productCode] || '#6b7280';
}
