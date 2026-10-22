// Supabase Edge Function: notify-purchase
// Envia o PEDIDO DE COMPRA pelo WhatsApp (Evolution API). Lê a compra no banco
// com a service role — o Admin só informa o purchaseId.
//
// Destino: o GRUPO do fornecedor (`suppliers.whatsapp_group`, migração 0020) e,
// quando não houver grupo, o telefone dele (`suppliers.phone`).
//
// Deploy:  supabase functions deploy notify-purchase
// Segredos: EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da função.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)
const onlyDigits = (s: string) => (s || '').replace(/\D/g, '')

/**
 * Destino do envio: pode ser um GRUPO ou um telefone.
 *
 * O id de grupo (`120363XXXXXXXXXXXX@g.us`) vai como veio — passar pelos
 * dígitos apagaria o "@g.us" e viraria um telefone que não existe. Também
 * aceita o id sem o sufixo: um número E.164 tem no máximo 15 dígitos, então
 * 16 ou mais é sempre grupo. Telefone segue a regra de sempre (10 ou 11
 * dígitos sem "+" = brasileiro).
 */
function waDestination(dest: string): string {
  const raw = (dest || '').trim()
  if (/@(g\.us|s\.whatsapp\.net)$/i.test(raw)) return raw
  const d = onlyDigits(raw)
  if (d.length >= 16) return `${d}@g.us`
  if (raw.startsWith('+')) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

async function sendWhatsApp(dest: string, message: string) {
  const base = Deno.env.get('EVOLUTION_API_URL')
  const apiKey = Deno.env.get('EVOLUTION_API_KEY')
  const instance = Deno.env.get('EVOLUTION_INSTANCE')
  const to = waDestination(dest)
  if (!base || !apiKey || !instance || !to) throw new Error('whatsapp-not-configured')
  const url = `${base.replace(/\/+$/, '')}/message/sendText/${instance}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ number: to, text: message }),
  })
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${await res.text()}`)
}

/** Envia um documento (PDF em base64) pela Evolution, com legenda opcional. */
async function sendWhatsAppMedia(dest: string, base64: string, fileName: string, caption: string) {
  const base = Deno.env.get('EVOLUTION_API_URL')
  const apiKey = Deno.env.get('EVOLUTION_API_KEY')
  const instance = Deno.env.get('EVOLUTION_INSTANCE')
  const to = waDestination(dest)
  if (!base || !apiKey || !instance || !to) throw new Error('whatsapp-not-configured')
  const url = `${base.replace(/\/+$/, '')}/message/sendMedia/${instance}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({
      number: to,
      mediatype: 'document',
      mimetype: 'application/pdf',
      media: base64,
      fileName,
      caption,
    }),
  })
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${await res.text()}`)
}

/** Monta o PDF do pedido de compra (pdf-lib, sem fontes externas). */
async function buildPurchasePdf(
  p: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  storeName: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.1, 0.1, 0.12)
  const muted = rgb(0.4, 0.4, 0.45)

  let page = doc.addPage([595.28, 841.89]) // A4 em pontos
  const margin = 48
  const right = 595.28 - margin
  let y = 841.89 - margin

  const num = String(p.number ?? '').padStart(6, '0')
  const line = (text: string, opts: { size?: number; f?: typeof font; color?: typeof ink; x?: number } = {}) => {
    const size = opts.size ?? 11
    if (y < margin + size) { page = doc.addPage([595.28, 841.89]); y = 841.89 - margin }
    page.drawText(text, { x: opts.x ?? margin, y, size, font: opts.f ?? font, color: opts.color ?? ink })
    y -= size + 6
  }
  const rightText = (text: string, size = 11, f = font, color = ink) => {
    const w = f.widthOfTextAtSize(text, size)
    page.drawText(text, { x: right - w, y, size, font: f, color })
  }

  line(`Pedido de compra no ${num}`, { size: 18, f: bold })
  line(storeName, { size: 11, color: muted })
  y -= 4
  line(`Fornecedor: ${String(p.supplier ?? '-') || '-'}`)
  const dt = p.created_at ? new Date(String(p.created_at)) : null
  line(`Data: ${dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString('pt-BR') : '-'}`)
  if (p.payment_method) line(`Pagamento: ${String(p.payment_method)}`)
  y -= 6

  // Cabecalho da tabela
  line('Itens', { size: 13, f: bold })
  let total = 0
  for (const i of items) {
    const nome = `${i.name}${i.size ? ` (${i.size})` : ''}`
    const sub = Number(i.unit_cost) * Number(i.quantity)
    total += sub
    const label = `• ${i.quantity}x ${nome}`
    const price = `${BRL(Number(i.unit_cost))}/un  =  ${BRL(sub)}`
    if (y < margin + 16) { page = doc.addPage([595.28, 841.89]); y = 841.89 - margin }
    page.drawText(label.length > 58 ? label.slice(0, 57) + '…' : label, { x: margin, y, size: 11, font, color: ink })
    rightText(price, 11, font, muted)
    y -= 17
  }
  y -= 6
  if (y < margin + 20) { page = doc.addPage([595.28, 841.89]); y = 841.89 - margin }
  page.drawText('Total do pedido', { x: margin, y, size: 13, font: bold, color: ink })
  rightText(BRL(total), 13, bold, ink)
  y -= 26
  line('Pode confirmar disponibilidade e prazo de entrega, por favor?', { size: 11, color: muted })

  return await doc.save()
}

function purchaseText(
  p: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  storeName: string,
): string {
  const num = String(p.number ?? '').padStart(6, '0')
  const linhas = items
    .map((i) => {
      const nome = `${i.name}${i.size ? ` (${i.size})` : ''}`
      return `• ${i.quantity}x ${nome} — ${BRL(Number(i.unit_cost))}/un`
    })
    .join('\n')
  const total = items.reduce((s, i) => s + Number(i.unit_cost) * Number(i.quantity), 0)
  const pagamento = p.payment_method ? `\nPagamento: ${p.payment_method}` : ''
  return (
    `🛒 *Pedido de compra nº ${num}*\n` +
    `${storeName}\n\n` +
    `${linhas}\n\n` +
    `*Total:* ${BRL(total)}${pagamento}\n\n` +
    'Pode confirmar disponibilidade e prazo de entrega, por favor?'
  )
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

    // Só a equipe registra compra: confere o JWT do chamador.
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: userData } = await supabase.auth.getUser(jwt)
    const uid = userData?.user?.id
    if (!uid) return json({ sent: false, error: 'unauthorized' }, 401)
    const { data: adminRow } = await supabase.from('admins').select('id').eq('id', uid).maybeSingle()
    if (!adminRow) return json({ sent: false, error: 'forbidden' }, 403)

    const { purchaseId } = await req.json()
    if (!purchaseId) return json({ sent: false, error: 'purchaseId é obrigatório.' }, 400)

    const { data: purchase } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .single()
    if (!purchase) return json({ sent: false, error: 'compra não encontrada' })

    // Destino: o grupo cadastrado no fornecedor; sem grupo, o WhatsApp dele.
    if (!purchase.supplier_id) return json({ sent: false, error: 'sem-fornecedor' })
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('name, phone, whatsapp_group')
      .eq('id', purchase.supplier_id)
      .maybeSingle()
    const grupo = String(supplier?.whatsapp_group ?? '').trim()
    const telefone = String(supplier?.phone ?? purchase.supplier_phone ?? '').trim()
    const destino = grupo || telefone
    const via = grupo ? 'grupo' : 'telefone'
    if (!destino) return json({ sent: false, error: 'sem-destino' })

    const { data: items } = await supabase
      .from('purchase_items')
      .select('name, size, quantity, unit_cost')
      .eq('purchase_id', purchaseId)
    if (!items?.length) return json({ sent: false, error: 'compra sem itens' })

    const texto = purchaseText(purchase, items, 'Martinica Store')
    // Preferência: enviar o PDF do pedido como documento (legenda = texto do
    // pedido). Se a geração do PDF ou o envio de mídia falhar, cai para texto.
    let formato = 'pdf'
    try {
      const pdf = await buildPurchasePdf(purchase, items, 'Martinica Store')
      const num = String(purchase.number ?? '').padStart(6, '0')
      await sendWhatsAppMedia(destino, encodeBase64(pdf), `pedido-${num}.pdf`, texto)
    } catch (pdfErr) {
      console.warn('[notify-purchase] PDF falhou, enviando texto:', pdfErr instanceof Error ? pdfErr.message : pdfErr)
      await sendWhatsApp(destino, texto)
      formato = 'texto'
    }
    return json({ sent: true, via, formato, to: waDestination(destino), supplier: supplier?.name ?? null })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[notify-purchase]', message)
    return json({ sent: false, error: message })
  }
})
