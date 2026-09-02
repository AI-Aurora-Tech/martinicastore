import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Banner } from '../types'

const DEMO_KEY = 'martinica-banners'

interface BannerRow {
  id: string
  image_url: string
  headline: string | null
  subtext: string | null
  cta_label: string | null
  link: string | null
  active: boolean | null
  sort: number | null
}

function toBanner(r: BannerRow): Banner {
  return {
    id: r.id,
    imageUrl: r.image_url,
    headline: r.headline ?? undefined,
    subtext: r.subtext ?? undefined,
    ctaLabel: r.cta_label ?? undefined,
    link: r.link ?? undefined,
    active: r.active ?? true,
    sort: r.sort ?? 0,
  }
}

function toRow(b: Banner): BannerRow {
  return {
    id: b.id,
    image_url: b.imageUrl,
    headline: b.headline ?? null,
    subtext: b.subtext ?? null,
    cta_label: b.ctaLabel ?? null,
    link: b.link ?? null,
    active: b.active ?? true,
    sort: b.sort ?? 0,
  }
}

function readDemo(): Banner[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    return raw ? (JSON.parse(raw) as Banner[]) : []
  } catch {
    return []
  }
}

function writeDemo(list: Banner[]): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

/** Carrega os banners ordenados. Só os ativos por padrão (loja). */
export async function loadBanners(onlyActive = true): Promise<Banner[]> {
  if (!isSupabaseConfigured || !supabase) {
    const list = readDemo().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    return onlyActive ? list.filter((b) => b.active !== false) : list
  }
  let q = supabase.from('banners').select('*').order('sort', { ascending: true })
  if (onlyActive) q = q.eq('active', true)
  const { data, error } = await q
  if (error) {
    console.warn('[banners] falha ao carregar:', error.message)
    return []
  }
  return (data as BannerRow[]).map(toBanner)
}

export interface BannerResult {
  error: string | null
  banner?: Banner
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Cria ou atualiza um banner. No Supabase, banner novo deixa o banco gerar o
 *  uuid (o id local "bnr-..." só vale no modo demo). */
export async function saveBanner(b: Banner): Promise<BannerResult> {
  if (!isSupabaseConfigured || !supabase) {
    const list = readDemo()
    const idx = list.findIndex((x) => x.id === b.id)
    if (idx === -1) list.push(b)
    else list[idx] = b
    writeDemo(list)
    return { error: null, banner: b }
  }

  // Novo banner (id ainda não é um uuid do banco): INSERT sem id.
  if (!UUID_RE.test(b.id)) {
    const row = toRow(b)
    delete (row as Partial<BannerRow>).id
    const { data, error } = await supabase.from('banners').insert(row).select('*').single()
    if (error) return { error: error.message }
    return { error: null, banner: toBanner(data as BannerRow) }
  }

  // Banner existente: upsert pelo uuid.
  const { data, error } = await supabase.from('banners').upsert(toRow(b)).select('*').single()
  if (error) return { error: error.message }
  return { error: null, banner: toBanner(data as BannerRow) }
}

/** Remove um banner. */
export async function deleteBanner(id: string): Promise<BannerResult> {
  if (!isSupabaseConfigured || !supabase) {
    writeDemo(readDemo().filter((b) => b.id !== id))
    return { error: null }
  }
  const { error } = await supabase.from('banners').delete().eq('id', id)
  return { error: error?.message ?? null }
}

/** Gera um id simples para banners no modo demo. */
export function newBannerId(): string {
  return `bnr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
