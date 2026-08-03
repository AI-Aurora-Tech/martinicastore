import {
  createContext,
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
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'supabase' | 'demo'>('demo')

  useEffect(() => {
    let alive = true
    loadCatalog().then((c) => {
      if (!alive) return
      setProducts(c.products)
      setCategories(c.categories)
      setSource(c.source)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <CatalogContext.Provider value={{ products, categories, loading, source }}>
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
