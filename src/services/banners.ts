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

/** Extrai a mensagem de erro do corpo de uma resposta de Edge Function. */
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
    detail = "Não foi possível alcançar a função 'manage-banner'. Ela provavelmente ainda não foi publicada (faça o deploy) — veja BANNERS.md."
  }
  return detail
}

/**
 * Cria ou atualiza um banner. No Supabase a gravação é feita pela Edge Function
 * `manage-banner` (service role), que confere se você é admin — evitando o erro
 * de RLS. `imageDataUrl` (data URL) envia uma imagem nova ao servidor.
 */
export async function saveBanner(b: Banner, imageDataUrl?: string): Promise<BannerResult> {
  if (!isSupabaseConfigured || !supabase) {
    const banner = imageDataUrl ? { ...b, imageUrl: imageDataUrl } : b
    const list = readDemo()
    const idx = list.findIndex((x) => x.id === banner.id)
    if (idx === -1) list.push(banner)
    else list[idx] = banner
    writeDemo(list)
    return { error: null, banner }
  }
  try {
    const { data, error } = await supabase.functions.invoke('manage-banner', {
      body: { action: 'save', banner: b, imageDataUrl },
    })
    if (error) return { error: await fnError(error) }
    const d = data as { banner?: Banner; error?: string } | null
    if (d?.error) return { error: d.error }
    return { error: null, banner: d?.banner }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Falha ao salvar o banner.' }
  }
}

/** Remove um banner. */
export async function deleteBanner(id: string): Promise<BannerResult> {
  if (!isSupabaseConfigured || !supabase) {
    writeDemo(readDemo().filter((b) => b.id !== id))
    return { error: null }
  }
  try {
    const { data, error } = await supabase.functions.invoke('manage-banner', {
      body: { action: 'delete', id },
    })
    if (error) return { error: await fnError(error) }
    const d = data as { error?: string } | null
    return { error: d?.error ?? null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Falha ao excluir o banner.' }
  }
}

/** Gera um id simples para banners no modo demo. */
export function newBannerId(): string {
  return `bnr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
