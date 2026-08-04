import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Supplier } from '../types'

const DEMO_KEY = 'martinica-suppliers'

function readDemo(): Supplier[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]') as Supplier[]
  } catch {
    return []
  }
}
function writeDemo(list: Supplier[]) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

function fromRow(r: Record<string, unknown>): Supplier {
  return {
    id: String(r.id),
    name: String(r.name),
    phone: (r.phone as string) ?? undefined,
    cnpj: (r.cnpj as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    contact: (r.contact as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
  }
}

export async function listSuppliers(): Promise<Supplier[]> {
  if (!isSupabaseConfigured || !supabase) {
    return readDemo().sort((a, b) => a.name.localeCompare(b.name))
  }
  const { data, error } = await supabase.from('suppliers').select('*').order('name')
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function saveSupplier(s: Supplier): Promise<{ supplier: Supplier | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    const list = readDemo()
    const id = s.id || `demo-sup-${Date.now()}`
    const next = { ...s, id }
    const idx = list.findIndex((x) => x.id === id)
    if (idx >= 0) list[idx] = next
    else list.push(next)
    writeDemo(list)
    return { supplier: next, error: null }
  }
  const row = {
    ...(s.id ? { id: s.id } : {}),
    name: s.name,
    phone: s.phone ?? null,
    cnpj: s.cnpj ?? null,
    email: s.email ?? null,
    contact: s.contact ?? null,
    notes: s.notes ?? null,
  }
  const { data, error } = await supabase.from('suppliers').upsert(row).select('*').single()
  if (error || !data) return { supplier: null, error: error?.message ?? 'Falha ao salvar fornecedor.' }
  return { supplier: fromRow(data), error: null }
}

export async function deleteSupplier(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    writeDemo(readDemo().filter((x) => x.id !== id))
    return { error: null }
  }
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  return { error: error?.message ?? null }
}
