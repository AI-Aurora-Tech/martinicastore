import type { Product, ProductVariant } from '../types'

/** O produto controla estoque por variação? */
export function hasVariants(p: Pick<Product, 'variants'>): boolean {
  return Array.isArray(p.variants) && p.variants.length > 0
}

/** Estoque total: soma das variações (se houver) ou o estoque do produto. */
export function totalStock(p: Pick<Product, 'variants' | 'stock'>): number {
  if (hasVariants(p)) return p.variants!.reduce((s, v) => s + Math.max(0, Number(v.stock) || 0), 0)
  return p.stock ?? 0
}

/** Estoque de uma variação específica (por rótulo). */
export function variantStock(p: Pick<Product, 'variants'>, label?: string): number {
  if (!label) return 0
  return p.variants?.find((v) => v.label === label)?.stock ?? 0
}

/**
 * Estoque disponível para a opção escolhida: a variação (se houver variações)
 * ou o estoque do produto (quando não há variações).
 */
export function availableFor(p: Pick<Product, 'variants' | 'stock'>, label?: string): number {
  if (hasVariants(p)) return variantStock(p, label)
  return p.stock ?? 0
}

/** Normaliza uma lista de variações (rótulos únicos e não vazios). */
export function cleanVariants(list: ProductVariant[]): ProductVariant[] {
  const seen = new Set<string>()
  const out: ProductVariant[] = []
  for (const v of list) {
    const label = (v.label ?? '').trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    out.push({ label, stock: Math.max(0, Math.round(Number(v.stock) || 0)) })
  }
  return out
}
