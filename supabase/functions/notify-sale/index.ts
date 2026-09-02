// Supabase Edge Function: notify-sale
// Avisa a LOJA (STORE_WHATSAPP) por WhatsApp (Z-API) a cada venda registrada no
// PDV. Lê a venda no banco com service role; o PDV só informa o saleId.
//
// Deploy:  supabase functions deploy notify-sale
// Segredos: ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN, STORE_WHATSAPP
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

const PAY_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', fiado: 'Fiado', cartao: 'Cartão',
}

async function sendWhatsApp(phone: string, message: string) {
  const inst = Deno.env.get('ZAPI_INSTANCE_ID')
  const token = Deno.env.get('ZAPI_INSTANCE_TOKEN')
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')
  const to = onlyDigits(phone)
  if (!inst || !token || !to) throw new Error('zapi-not-configured')
  const url = `https://api.z-api.io/instances/${inst}/token/${token}/send-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(clientToken ? { 'Client-Token': clientToken } : {}) },
    body: JSON.stringify({ phone: to, message }),
  })
  if (!res.ok) throw new Error(`Z-API ${res.status}: ${await res.text()}`)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const store = Deno.env.get('STORE_WHATSAPP')
    if (!store) return json({ sent: false, error: 'store-whatsapp-not-configured' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Só a equipe registra venda: confere o JWT do chamador.
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: userData } = await supabase.auth.getUser(jwt)
    const uid = userData?.user?.id
    if (!uid) return json({ sent: false, error: 'unauthorized' }, 401)
    const { data: adminRow } = await supabase.from('admins').select('id').eq('id', uid).maybeSingle()
    if (!adminRow) return json({ sent: false, error: 'forbidden' }, 403)

    const { saleId } = await req.json()
    if (!saleId) return json({ sent: false, error: 'saleId é obrigatório.' }, 400)

    const { data: sale } = await supabase.from('sales').select('*').eq('id', saleId).single()
    if (!sale) return json({ sent: false, error: 'venda não encontrada' })
    const { data: itemRows } = await supabase.from('sale_items').select('*').eq('sale_id', saleId)

    const num = String(sale.number ?? '').padStart(6, '0')
    const list = (itemRows ?? [])
      .map((i) => `• ${i.quantity}x ${i.name}${i.size ? ` (${i.size})` : ''}`)
      .join('\n')
    const pay = PAY_LABEL[String(sale.payment_method)] ?? String(sale.payment_method)
    const pending = String(sale.status) === 'pending'
    const head = pending ? '🧾 *Venda FIADO (pendente)*' : '🧾 *Nova venda no PDV*'
    const buyer = sale.customer_name ? `\nComprador: ${sale.customer_name}${sale.customer_phone ? ` (${sale.customer_phone})` : ''}` : ''
    const msg = `${head}\nVenda nº ${num}\nOperador: ${sale.operator_email ?? '—'}\n${list}\n*Total:* ${BRL(Number(sale.total))}\nPagamento: ${pay}${pending ? ' — *PENDENTE DE RECEBIMENTO*' : ''}${buyer}`

    await sendWhatsApp(store, msg)
    return json({ sent: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[notify-sale]', message)
    return json({ sent: false, error: message })
  }
})
