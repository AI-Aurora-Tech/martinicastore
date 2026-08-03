import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Product } from '../types'

export interface SaveResult {
  error: string | null
}

/** Converte um Product para a linha da tabela `products`. */
function toRow(p: Product) {
  return {
    id: p.id,
    name: p.name,
    category_id: p.category,
    kind: p.kind,
    price: p.price,
    old_price: p.oldPrice ?? null,
    color_main: p.colors[0],
    color_accent: p.colors[1],
    badge: p.badge ?? null,
    description: p.description,
    sizes: p.sizes ?? null,
    rating: p.rating,
    reviews: p.reviews,
    stock: p.stock ?? 0,
    active: p.active ?? true,
  }
}

/**
 * Cria ou atualiza um produto (upsert). No modo demo apenas confirma — a lista
 * em memória é atualizada pelo chamador (CatalogContext.upsertLocal).
 */
export async function saveProduct(p: Product): Promise<SaveResult> {
  if (!isSupabaseConfigured || !supabase) return { error: null }
  const { error } = await supabase.from('products').upsert(toRow(p))
  return { error: error?.message ?? null }
}

/** Atualiza apenas o estoque de um produto. */
export async function setStock(id: string, stock: number): Promise<SaveResult> {
  if (!isSupabaseConfigured || !supabase) return { error: null }
  const { error } = await supabase
    .from('products')
    .update({ stock: Math.max(0, stock) })
    .eq('id', id)
  return { error: error?.message ?? null }
}

/** Remove um produto. */
export async function deleteProduct(id: string): Promise<SaveResult> {
  if (!isSupabaseConfigured || !supabase) return { error: null }
  const { error } = await supabase.from('products').delete().eq('id', id)
  return { error: error?.message ?? null }
}
