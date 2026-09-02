import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Category } from '../types'

const DEMO_KEY = 'martinica-categories'

export interface CatResult {
  error: string | null
}

/** Gera um id (slug) a partir do rótulo: "Bonés & Toucas" -> "bones-toucas". */
export function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function readDemo(): Category[] | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    return raw ? (JSON.parse(raw) as Category[]) : null
  } catch {
    return null
  }
}

function writeDemo(list: Category[]): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

/**
 * Categorias no modo demo: guardadas no navegador (localStorage). Retorna
 * `null` quando o usuário ainda não editou nada (aí o catálogo usa o seed).
 */
export function demoCategories(): Category[] | null {
  return readDemo()
}

/** Cria ou atualiza uma categoria (upsert). */
export async function saveCategory(cat: Category, current: Category[]): Promise<CatResult> {
  if (!isSupabaseConfigured || !supabase) {
    const list = [...current]
    const idx = list.findIndex((c) => c.id === cat.id)
    if (idx === -1) list.push(cat)
    else list[idx] = cat
    writeDemo(list)
    return { error: null }
  }
  const { error } = await supabase
    .from('categories')
    .upsert({ id: cat.id, label: cat.label, sort: cat.sort ?? 0 })
  return { error: error?.message ?? null }
}

/**
 * Remove uma categoria. Falha se houver produtos usando-a (chave estrangeira),
 * devolvendo uma mensagem amigável.
 */
export async function deleteCategory(id: string, current: Category[]): Promise<CatResult> {
  if (!isSupabaseConfigured || !supabase) {
    writeDemo(current.filter((c) => c.id !== id))
    return { error: null }
  }
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) {
    if (/foreign key|violates|referenced/i.test(error.message)) {
      return { error: 'Há produtos nesta categoria. Mova-os antes de excluir.' }
    }
    return { error: error.message }
  }
  return { error: null }
}
