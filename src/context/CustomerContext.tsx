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
  signUp: (name: string, email: string, password: string, phone: string, cpf: string) => Promise<string | null>
  signOut: () => Promise<void>
  saveAddress: (address: Address, extra?: { name?: string; phone?: string }) => Promise<string | null>
  updateProfile: (patch: { name?: string; phone?: string; cpf?: string; address?: Address }) => Promise<string | null>
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

  const signUp = useCallback(
    async (name: string, email: string, password: string, phone: string, cpf: string) => {
      const { customer: c, error } = await signUpCustomer(name, email, password, phone, cpf)
      if (error || !c) return error ?? 'Falha ao cadastrar.'
      setCustomer(c)
      return null
    },
    [],
  )

  const signOut = useCallback(async () => {
    await signOutCustomer()
    setCustomer(null)
  }, [])

  const updateProfile = useCallback(
    async (patch: { name?: string; phone?: string; cpf?: string; address?: Address }) => {
      if (!customer) return 'Você precisa estar logado.'
      const { error } = await saveCustomerProfile(customer.id, patch)
      if (error) return error
      setCustomer({ ...customer, ...patch })
      return null
    },
    [customer],
  )

  const saveAddress = useCallback(
    (address: Address, extra?: { name?: string; phone?: string }) =>
      updateProfile({ address, ...extra }),
    [updateProfile],
  )

  const value = useMemo(
    () => ({ customer, loading, signIn, signUp, signOut, saveAddress, updateProfile }),
    [customer, loading, signIn, signUp, signOut, saveAddress, updateProfile],
  )

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCustomer() {
  const ctx = useContext(CustomerContext)
  if (!ctx) throw new Error('useCustomer deve ser usado dentro de <CustomerProvider>')
  return ctx
}
