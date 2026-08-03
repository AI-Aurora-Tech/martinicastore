import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Category, Product } from '../types'
import { loadCatalog } from '../services/catalog'

interface CatalogContextValue {
  products: Product[]
  categories: Category[]
  loading: boolean
  source: 'supabase' | 'demo'
  /** Erro de leitura do Supabase (quando configurado mas a busca falhou). */
  error?: string
  /** Recarrega o catálogo do backend. */
  refresh: () => void
  /** Insere ou atualiza um produto na lista em memória (reflexo imediato na UI). */
  upsertLocal: (product: Product) => void
  /** Remove um produto da lista em memória. */
  removeLocal: (id: string) => void
  /** Abate estoque local após uma venda/pedido (mantém a UI em sincronia). */
  decrementStockLocal: (items: { id: string; quantity: number }[]) => void
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'supabase' | 'demo'>('demo')
  const [error, setError] = useState<string | undefined>(undefined)

  const load = useCallback(() => {
    let alive = true
    setLoading(true)
    loadCatalog().then((c) => {
      if (!alive) return
      setProducts(c.products)
      setCategories(c.categories)
      setSource(c.source)
      setError(c.error)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => load(), [load])

  const upsertLocal = useCallback((product: Product) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id)
      if (idx === -1) return [...prev, product]
      const next = [...prev]
      next[idx] = product
      return next
    })
  }, [])

  const removeLocal = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const decrementStockLocal = useCallback(
    (items: { id: string; quantity: number }[]) => {
      const map = new Map(items.map((i) => [i.id, i.quantity]))
      setProducts((prev) =>
        prev.map((p) => {
          const qty = map.get(p.id)
          if (qty == null || p.stock == null) return p
          return { ...p, stock: Math.max(0, p.stock - qty) }
        }),
      )
    },
    [],
  )

  return (
    <CatalogContext.Provider
      value={{
        products,
        categories,
        loading,
        source,
        error,
        refresh: load,
        upsertLocal,
        removeLocal,
        decrementStockLocal,
      }}
    >
      {children}
    </CatalogContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog deve ser usado dentro de <CatalogProvider>')
  return ctx
}
