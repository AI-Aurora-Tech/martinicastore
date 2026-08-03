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
  cost: number | string | null
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
    cost: r.cost == null ? undefined : Number(r.cost),
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
  /** Mensagem de erro quando estava configurado mas a leitura falhou. */
  error?: string
}

/**
 * Carrega catálogo (categorias + produtos).
 * - Sem Supabase configurado: usa o seed local (modo demo).
 * - Com Supabase: usa SEMPRE os dados reais do banco, inclusive quando ainda
 *   não há produtos (loja/estoque vazios são o esperado até você cadastrar).
 *   Só cai para o seed se a leitura realmente falhar (erro de conexão/policy),
 *   e nesse caso devolve a mensagem de erro para exibir um aviso.
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
          'id,name,category_id,kind,price,old_price,cost,color_main,color_accent,badge,description,sizes,rating,reviews,stock,active,image_url',
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

    // Dados reais do banco — mesmo que `products` esteja vazio.
    // As categorias caem para a lista padrão apenas se ainda não houver
    // nenhuma cadastrada, para o formulário do Admin continuar utilizável.
    return {
      products,
      categories: categories.length > 0 ? categories : seedCategories,
      source: 'supabase',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[catalog] falha ao carregar do Supabase, usando seed local.', err)
    return { products: seedProducts, categories: seedCategories, source: 'demo', error: message }
  }
}
