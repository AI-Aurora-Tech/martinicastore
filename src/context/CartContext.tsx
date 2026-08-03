import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CartItem, Product } from '../types'

interface CartContextValue {
  items: CartItem[]
  count: number
  subtotal: number
  isOpen: boolean
  addItem: (product: Product, size?: string) => void
  removeItem: (id: string, size?: string) => void
  setQuantity: (id: string, size: string | undefined, quantity: number) => void
  clear: () => void
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'martinica-cart'

function lineKey(id: string, size?: string) {
  return `${id}::${size ?? ''}`
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CartItem[]) : []
    } catch {
      return []
    }
  })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [items])

  const addItem = useCallback((product: Product, size?: string) => {
    setItems((prev) => {
      const key = lineKey(product.id, size)
      const existing = prev.find((i) => lineKey(i.product.id, i.size) === key)
      if (existing) {
        return prev.map((i) =>
          lineKey(i.product.id, i.size) === key
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        )
      }
      return [...prev, { product, size, quantity: 1 }]
    })
    setIsOpen(true)
  }, [])

  const removeItem = useCallback((id: string, size?: string) => {
    const key = lineKey(id, size)
    setItems((prev) => prev.filter((i) => lineKey(i.product.id, i.size) !== key))
  }, [])

  const setQuantity = useCallback(
    (id: string, size: string | undefined, quantity: number) => {
      const key = lineKey(id, size)
      setItems((prev) =>
        prev
          .map((i) =>
            lineKey(i.product.id, i.size) === key
              ? { ...i, quantity: Math.max(0, quantity) }
              : i,
          )
          .filter((i) => i.quantity > 0),
      )
    },
    [],
  )

  const clear = useCallback(() => setItems([]), [])
  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  )
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [items],
  )

  const value = useMemo(
    () => ({
      items,
      count,
      subtotal,
      isOpen,
      addItem,
      removeItem,
      setQuantity,
      clear,
      openCart,
      closeCart,
    }),
    [items, count, subtotal, isOpen, addItem, removeItem, setQuantity, clear, openCart, closeCart],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart deve ser usado dentro de <CartProvider>')
  return ctx
}
