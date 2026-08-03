import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Address, Customer } from '../types'
import {
  getCurrentCustomer,
  saveCustomerProfile,
  signInCustomer,
  signOutCustomer,
  signUpCustomer,
} from '../services/customer'

interface CustomerContextValue {
  customer: Customer | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (name: string, email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  saveAddress: (address: Address, extra?: { name?: string; phone?: string }) => Promise<string | null>
}

const CustomerContext = createContext<CustomerContextValue | null>(null)

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getCurrentCustomer().then((c) => {
      if (!alive) return
      setCustomer(c)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { customer: c, error } = await signInCustomer(email, password)
    if (error || !c) return error ?? 'Falha ao entrar.'
    setCustomer(c)
    return null
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { customer: c, error } = await signUpCustomer(name, email, password)
    if (error || !c) return error ?? 'Falha ao cadastrar.'
    setCustomer(c)
    return null
  }, [])

  const signOut = useCallback(async () => {
    await signOutCustomer()
    setCustomer(null)
  }, [])

  const saveAddress = useCallback(
    async (address: Address, extra?: { name?: string; phone?: string }) => {
      if (!customer) return 'Você precisa estar logado.'
      const { error } = await saveCustomerProfile(customer.id, { address, ...extra })
      if (error) return error
      setCustomer({ ...customer, address, ...extra })
      return null
    },
    [customer],
  )

  const value = useMemo(
    () => ({ customer, loading, signIn, signUp, signOut, saveAddress }),
    [customer, loading, signIn, signUp, signOut, saveAddress],
  )

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCustomer() {
  const ctx = useContext(CustomerContext)
  if (!ctx) throw new Error('useCustomer deve ser usado dentro de <CustomerProvider>')
  return ctx
}
