import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Address, Customer } from '../types'

export const customerAuthMode: 'supabase' | 'demo' = isSupabaseConfigured
  ? 'supabase'
  : 'demo'

export interface CustomerResult {
  customer: Customer | null
  error: string | null
}

const DEMO_LIST = 'martinica-customers'
const DEMO_SESSION = 'martinica-customer'

interface DemoCustomer extends Customer {
  password: string
}

function readDemo(): DemoCustomer[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_LIST) || '[]') as DemoCustomer[]
  } catch {
    return []
  }
}
function writeDemo(list: DemoCustomer[]) {
  try {
    localStorage.setItem(DEMO_LIST, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}
function setDemoSession(id: string | null) {
  try {
    if (id) localStorage.setItem(DEMO_SESSION, id)
    else localStorage.removeItem(DEMO_SESSION)
  } catch {
    /* ignore */
  }
}
function publicCustomer(c: DemoCustomer): Customer {
  const { password: _pw, ...rest } = c
  void _pw
  return rest
}

function rowToAddress(row: Record<string, unknown>): Address | undefined {
  if (!row.cep) return undefined
  return {
    cep: String(row.cep),
    street: String(row.street ?? ''),
    number: String(row.number ?? ''),
    complement: (row.complement as string) ?? undefined,
    neighborhood: String(row.neighborhood ?? ''),
    city: String(row.city ?? ''),
    uf: String(row.uf ?? ''),
  }
}

async function fetchProfile(id: string, email: string, fallbackName: string): Promise<Customer> {
  if (!supabase) return { id, name: fallbackName, email }
  const { data } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
  const row = (data ?? {}) as Record<string, unknown>
  return {
    id,
    name: (row.name as string) || fallbackName,
    email,
    phone: (row.phone as string) ?? undefined,
    address: rowToAddress(row),
  }
}

export async function signUpCustomer(
  name: string,
  email: string,
  password: string,
): Promise<CustomerResult> {
  const cleanEmail = email.trim().toLowerCase()

  if (customerAuthMode === 'supabase' && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { name } },
    })
    if (error) return { customer: null, error: error.message }
    const user = data.user
    if (!user) return { customer: null, error: 'Não foi possível criar a conta.' }

    await supabase.from('customers').upsert({ id: user.id, name, email: cleanEmail })

    if (!data.session) {
      // Projeto exige confirmação de e-mail.
      return {
        customer: null,
        error:
          'Conta criada! Confirme o e-mail para entrar (ou desative a confirmação em Auth → Providers → Email).',
      }
    }
    return { customer: { id: user.id, name, email: cleanEmail }, error: null }
  }

  // Demo
  const list = readDemo()
  if (list.some((c) => c.email === cleanEmail)) {
    return { customer: null, error: 'Já existe uma conta com esse e-mail.' }
  }
  const c: DemoCustomer = {
    id: `demo-${Date.now()}`,
    name,
    email: cleanEmail,
    password,
  }
  writeDemo([...list, c])
  setDemoSession(c.id)
  return { customer: publicCustomer(c), error: null }
}

export async function signInCustomer(email: string, password: string): Promise<CustomerResult> {
  const cleanEmail = email.trim().toLowerCase()

  if (customerAuthMode === 'supabase' && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })
    if (error || !data.user) {
      return { customer: null, error: error?.message ?? 'E-mail ou senha inválidos.' }
    }
    const name = (data.user.user_metadata?.name as string) || cleanEmail.split('@')[0]
    return { customer: await fetchProfile(data.user.id, cleanEmail, name), error: null }
  }

  const c = readDemo().find((x) => x.email === cleanEmail && x.password === password)
  if (!c) return { customer: null, error: 'E-mail ou senha inválidos.' }
  setDemoSession(c.id)
  return { customer: publicCustomer(c), error: null }
}

export async function signOutCustomer(): Promise<void> {
  if (customerAuthMode === 'supabase' && supabase) {
    await supabase.auth.signOut()
    return
  }
  setDemoSession(null)
}

export async function getCurrentCustomer(): Promise<Customer | null> {
  if (customerAuthMode === 'supabase' && supabase) {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) return null
    const email = user.email ?? ''
    const name = (user.user_metadata?.name as string) || email.split('@')[0]
    return fetchProfile(user.id, email, name)
  }

  let id: string | null = null
  try {
    id = localStorage.getItem(DEMO_SESSION)
  } catch {
    id = null
  }
  if (!id) return null
  const c = readDemo().find((x) => x.id === id)
  return c ? publicCustomer(c) : null
}

/** Salva/atualiza nome, telefone e endereço do comprador. */
export async function saveCustomerProfile(
  id: string,
  patch: { name?: string; phone?: string; address?: Address },
): Promise<CustomerResult> {
  if (customerAuthMode === 'supabase' && supabase) {
    const row: Record<string, unknown> = { id }
    if (patch.name !== undefined) row.name = patch.name
    if (patch.phone !== undefined) row.phone = patch.phone
    if (patch.address) {
      Object.assign(row, {
        cep: patch.address.cep,
        street: patch.address.street,
        number: patch.address.number,
        complement: patch.address.complement ?? null,
        neighborhood: patch.address.neighborhood,
        city: patch.address.city,
        uf: patch.address.uf,
      })
    }
    const { error } = await supabase.from('customers').upsert(row)
    if (error) return { customer: null, error: error.message }
    return { customer: null, error: null }
  }

  const list = readDemo()
  const idx = list.findIndex((c) => c.id === id)
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      name: patch.name ?? list[idx].name,
      phone: patch.phone ?? list[idx].phone,
      address: patch.address ?? list[idx].address,
    }
    writeDemo(list)
  }
  return { customer: null, error: null }
}
