import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  products as seedProducts,
  categories as seedCategories,
} from '../data/products'
import type { Category, CategoryId, Product, ProductKind } from '../types'

interface ProductRow {
  id: string
  name: string
  category_id: string
  kind: string
  price: number | string
  old_price: number | string | null
  color_main: string
  color_accent: string
  badge: string | null
  description: string
  sizes: string[] | null
  rating: number | string
  reviews: number
  stock: number | null
  active: boolean | null
  image_url: string | null
}

interface CategoryRow {
  id: string
  label: string
}

function toProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category_id as CategoryId,
    kind: r.kind as ProductKind,
    price: Number(r.price),
    oldPrice: r.old_price == null ? undefined : Number(r.old_price),
    colors: [r.color_main, r.color_accent],
    badge: r.badge ?? undefined,
    description: r.description,
    sizes: r.sizes ?? undefined,
    rating: Number(r.rating),
    reviews: r.reviews,
    stock: r.stock == null ? undefined : Number(r.stock),
    active: r.active ?? true,
    image: r.image_url ?? undefined,
  }
}

export interface Catalog {
  products: Product[]
  categories: Category[]
  /** 'supabase' quando os dados vieram do banco; 'demo' quando são o seed local. */
  source: 'supabase' | 'demo'
}

/**
 * Carrega catálogo (categorias + produtos). Usa o Supabase quando configurado;
 * caso contrário — ou em caso de erro — cai para o seed local.
 */
export async function loadCatalog(): Promise<Catalog> {
  if (!isSupabaseConfigured || !supabase) {
    return { products: seedProducts, categories: seedCategories, source: 'demo' }
  }

  try {
    const [cats, prods] = await Promise.all([
      supabase.from('categories').select('id,label').order('sort', { ascending: true }),
      supabase
        .from('products')
        .select(
          'id,name,category_id,kind,price,old_price,color_main,color_accent,badge,description,sizes,rating,reviews,stock,active,image_url',
        )
        .order('sort', { ascending: true }),
    ])

    if (cats.error) throw cats.error
    if (prods.error) throw prods.error

    const categories = (cats.data as CategoryRow[]).map((c) => ({
      id: c.id as CategoryId,
      label: c.label,
    }))
    const products = (prods.data as ProductRow[]).map(toProduct)

    // Se o banco ainda estiver vazio, usa o seed para não exibir loja vazia.
    if (products.length === 0 || categories.length === 0) {
      return { products: seedProducts, categories: seedCategories, source: 'demo' }
    }
    return { products, categories, source: 'supabase' }
  } catch (err) {
    console.warn('[catalog] falha ao carregar do Supabase, usando seed local.', err)
    return { products: seedProducts, categories: seedCategories, source: 'demo' }
  }
}
