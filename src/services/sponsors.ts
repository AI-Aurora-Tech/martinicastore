import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Sponsor } from '../types'

const DEMO_KEY = 'martinica-sponsors'

interface SponsorRow {
  id: string
  name: string | null
  image_url: string
  link: string | null
  active: boolean | null
  sort: number | null
}

function toSponsor(r: SponsorRow): Sponsor {
  return {
    id: r.id,
    name: r.name ?? undefined,
    imageUrl: r.image_url,
    link: r.link ?? undefined,
    active: r.active ?? true,
    sort: r.sort ?? 0,
  }
}

function readDemo(): Sponsor[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    return raw ? (JSON.parse(raw) as Sponsor[]) : []
  } catch {
    return []
  }
}
function writeDemo(list: Sponsor[]): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

/** Carrega os patrocinadores ordenados. Só os ativos por padrão (loja). */
export async function loadSponsors(onlyActive = true): Promise<Sponsor[]> {
  if (!isSupabaseConfigured || !supabase) {
    const list = readDemo().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    return onlyActive ? list.filter((s) => s.active !== false) : list
  }
  let q = supabase.from('sponsors').select('*').order('sort', { ascending: true })
  if (onlyActive) q = q.eq('active', true)
  const { data, error } = await q
  if (error) {
    console.warn('[sponsors] falha ao carregar:', error.message)
    return []
  }
  return (data as SponsorRow[]).map(toSponsor)
}

export interface SponsorResult {
  error: string | null
  sponsor?: Sponsor
}

async function fnError(error: unknown): Promise<string> {
  let detail = error instanceof Error ? error.message : String(error)
  const ctx = (error as { context?: unknown })?.context
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = await (ctx as Response).json()
      if (body?.error) detail = body.error
    } catch { /* ignore */ }
  }
  if (/failed to send a request|fetch/i.test(detail)) {
    detail = "Não foi possível alcançar a função 'manage-sponsor'. Ela provavelmente ainda não foi publicada (faça o deploy)."
  }
  return detail
}

/**
 * Cria/atualiza um patrocinador. No Supabase, a gravação é feita pela Edge
 * Function `manage-sponsor` (service role) que confere se você é admin.
 */
export async function saveSponsor(s: Sponsor, imageDataUrl?: string): Promise<SponsorResult> {
  if (!isSupabaseConfigured || !supabase) {
    const sponsor = imageDataUrl ? { ...s, imageUrl: imageDataUrl } : s
    const list = readDemo()
    const idx = list.findIndex((x) => x.id === sponsor.id)
    if (idx === -1) list.push(sponsor)
    else list[idx] = sponsor
    writeDemo(list)
    return { error: null, sponsor }
  }
  try {
    const { data, error } = await supabase.functions.invoke('manage-sponsor', {
      body: { action: 'save', sponsor: s, imageDataUrl },
    })
    if (error) return { error: await fnError(error) }
    const d = data as { sponsor?: Sponsor; error?: string } | null
    if (d?.error) return { error: d.error }
    return { error: null, sponsor: d?.sponsor }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Falha ao salvar o patrocinador.' }
  }
}

export async function deleteSponsor(id: string): Promise<SponsorResult> {
  if (!isSupabaseConfigured || !supabase) {
    writeDemo(readDemo().filter((s) => s.id !== id))
    return { error: null }
  }
  try {
    const { data, error } = await supabase.functions.invoke('manage-sponsor', {
      body: { action: 'delete', id },
    })
    if (error) return { error: await fnError(error) }
    const d = data as { error?: string } | null
    return { error: d?.error ?? null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Falha ao excluir o patrocinador.' }
  }
}

export function newSponsorId(): string {
  return `spn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
