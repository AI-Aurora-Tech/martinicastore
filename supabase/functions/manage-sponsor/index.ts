// Supabase Edge Function: manage-sponsor
// Cria/atualiza/exclui patrocinadores (logos com link) com SERVICE ROLE, depois
// de confirmar que quem chamou é ADMIN — evitando erros de RLS. Faz também o
// upload da imagem (data URL) para o Storage pelo servidor.
//
// Deploy:  supabase functions deploy manage-sponsor
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da função.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BUCKET = 'product-images'
const MAX_BYTES = 3 * 1024 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Sponsor {
  id?: string
  name?: string
  imageUrl?: string
  link?: string
  active?: boolean
  sort?: number
}

function toRow(s: Sponsor, imageUrl: string) {
  return {
    name: s.name ?? null,
    image_url: imageUrl,
    link: s.link ?? null,
    active: s.active ?? true,
    sort: s.sort ?? 0,
  }
}

function toSponsor(r: Record<string, unknown>): Sponsor {
  return {
    id: String(r.id),
    name: (r.name as string) ?? undefined,
    imageUrl: (r.image_url as string) ?? '',
    link: (r.link as string) ?? undefined,
    active: (r.active as boolean) ?? true,
    sort: (r.sort as number) ?? 0,
  }
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; type: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!m) return null
  const type = m[1]
  const bin = atob(m[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { bytes, type }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // --- Confirma que quem chamou é ADMIN ---
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Não autenticado.' }, 401)
    const { data: userData, error: uErr } = await supabase.auth.getUser(jwt)
    const uid = userData?.user?.id
    if (uErr || !uid) return json({ error: 'Sessão inválida. Faça login novamente.' }, 401)
    const { data: adminRow } = await supabase.from('admins').select('role').eq('id', uid).maybeSingle()
    if (!adminRow) return json({ error: 'Apenas administradores podem gerenciar patrocinadores.' }, 403)

    const body = await req.json()
    const action = String(body?.action ?? 'save')

    if (action === 'delete') {
      if (!body?.id) return json({ error: 'id é obrigatório.' }, 400)
      const { error } = await supabase.from('sponsors').delete().eq('id', String(body.id))
      if (error) throw error
      return json({ ok: true })
    }

    // --- save (create/update) ---
    const sponsor: Sponsor = body?.sponsor ?? {}
    let imageUrl = sponsor.imageUrl ?? ''

    if (body?.imageDataUrl) {
      const decoded = decodeDataUrl(String(body.imageDataUrl))
      if (!decoded) return json({ error: 'Imagem inválida.' }, 400)
      if (decoded.bytes.byteLength > MAX_BYTES) return json({ error: 'Imagem muito grande (máx. 3 MB).' }, 400)
      const ext = decoded.type === 'image/png' ? 'png' : decoded.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `sponsors/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
      const up = await supabase.storage.from(BUCKET).upload(path, decoded.bytes, { contentType: decoded.type, upsert: false })
      if (up.error) throw up.error
      imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }

    if (!imageUrl) return json({ error: 'Envie uma imagem para o patrocinador.' }, 400)

    const row = toRow(sponsor, imageUrl)
    let saved
    if (sponsor.id && UUID_RE.test(sponsor.id)) {
      const r = await supabase.from('sponsors').update(row).eq('id', sponsor.id).select('*').single()
      if (r.error) throw r.error
      saved = r.data
    } else {
      const r = await supabase.from('sponsors').insert(row).select('*').single()
      if (r.error) throw r.error
      saved = r.data
    }
    return json({ sponsor: toSponsor(saved as Record<string, unknown>) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[manage-sponsor]', message)
    return json({ error: message }, 500)
  }
})
