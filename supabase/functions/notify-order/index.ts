// Supabase Edge Function: notify-order
// Notifica o pedido por WHATSAPP (Z-API). Lê o pedido no banco com a service
// role — o cliente só informa o orderId. Avisa a LOJA e o CLIENTE.
//
// Deploy:  supabase functions deploy notify-order
// Segredos (Dashboard → Edge Functions → Secrets, ou `supabase secrets set`):
//   ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN
//   STORE_WHATSAPP   (número da loja p/ receber aviso de cada pedido)
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

function orderAddress(o: Record<string, unknown>): string {
  return [
    o.ship_street, o.ship_number, o.ship_complement, o.ship_neighborhood,
    o.ship_city && `${o.ship_city} - ${o.ship_uf ?? ''}`, o.ship_cep,
  ].filter(Boolean).join(', ')
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

function forStore(o: Record<string, unknown>, items: Array<Record<string, unknown>>): string {
  const num = String(o.number ?? '').padStart(6, '0')
  const list = items.map((i) => `• ${i.quantity}x ${i.name}`).join('\n')
  return `🛒 *Novo pedido nº ${num}*\nCliente: ${o.customer_name ?? '—'}\nWhatsApp: ${o.customer_phone ?? '—'}\n${list}\n*Total:* ${BRL(Number(o.total))}\nEntrega: ${o.shipping_service ?? '—'}\n📍 ${orderAddress(o) || '—'}`
}
function forCustomer(o: Record<string, unknown>): string {
  const num = String(o.number ?? '').padStart(6, '0')
  return `✅ *Martinica Store*\nRecebemos seu pedido *nº ${num}*!\nTotal: ${BRL(Number(o.total))}\nEntrega: ${o.shipping_service ?? '—'} (até ${o.shipping_days ?? '?'} dias úteis).\nObrigado pela compra! 🧡`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { orderId } = await req.json()
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId é obrigatório.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: order, error: oErr } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (oErr || !order) throw oErr ?? new Error('Pedido não encontrado.')
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId)
    const list = items ?? []

    let whatsappSent = false
    let lastError: string | null = null

    const storeWa = Deno.env.get('STORE_WHATSAPP')
    try {
      if (storeWa) { await sendWhatsApp(storeWa, forStore(order, list)); whatsappSent = true }
    } catch (e) {
      if (String((e as Error).message) !== 'zapi-not-configured') lastError = (e as Error).message
    }
    if (order.customer_phone) {
      try { await sendWhatsApp(String(order.customer_phone), forCustomer(order)); whatsappSent = true }
      catch (e) { lastError = (e as Error).message }
    }

    if (!whatsappSent) {
      return new Response(
        JSON.stringify({ error: lastError ?? 'WhatsApp (Z-API) não configurado.' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify({ ok: true, whatsappSent }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[notify-order]', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
