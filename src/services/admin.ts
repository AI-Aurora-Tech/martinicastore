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
    image_url: p.image ?? null,
  }
}

const BUCKET = 'product-images'
const MAX_IMAGE_BYTES = 3 * 1024 * 1024 // 3 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export interface UploadResult {
  url: string | null
  error: string | null
}

/**
 * Faz upload da imagem do produto. Aceita apenas JPG/PNG (até 3 MB).
 * - Modo Supabase: envia para o Storage e devolve a URL pública.
 * - Modo demo: devolve um data URL (base64) para pré-visualização em memória.
 */
export async function uploadProductImage(file: File): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { url: null, error: 'Formato inválido. Envie um arquivo JPG ou PNG.' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { url: null, error: 'Imagem muito grande (máximo 3 MB).' }
  }

  if (!isSupabaseConfigured || !supabase) {
    try {
      return { url: await readAsDataUrl(file), error: null }
    } catch {
      return { url: null, error: 'Não foi possível ler a imagem.' }
    }
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
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
