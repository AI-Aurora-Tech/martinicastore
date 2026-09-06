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

    await sendWhatsApp(destino, purchaseText(purchase, items, 'Martinica Store'))
    return json({ sent: true, via, to: waDestination(destino), supplier: supplier?.name ?? null })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[notify-purchase]', message)
    return json({ sent: false, error: message })
  }
})
