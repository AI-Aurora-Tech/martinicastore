// Supabase Edge Function: mercadopago-webhook
// Recebe as notificações do Mercado Pago. Quando o pagamento é APROVADO:
//   - marca o pedido como pago (orders.status='paid', payment_status, paid_at)
//   - envia um WhatsApp de "pagamento aprovado" ao cliente (Z-API)
//
// IMPORTANTE: esta função é chamada pelo Mercado Pago (sem JWT). Publique com
// verificação de JWT DESLIGADA:
//   - CLI: já vem em supabase/config.toml ([functions.mercadopago-webhook] verify_jwt=false)
//   - Dashboard: em Edge Functions → mercadopago-webhook → Details → desmarque
//     "Enforce JWT verification".
//
// Segredos: MP_ACCESS_TOKEN, ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN,
//           ZAPI_CLIENT_TOKEN, STORE_WHATSAPP (opcional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)
const onlyDigits = (s: string) => (s || '').replace(/\D/g, '')

async function sendWhatsApp(phone: string, message: string) {
  const inst = Deno.env.get('ZAPI_INSTANCE_ID')
  const token = Deno.env.get('ZAPI_INSTANCE_TOKEN')
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')
  const to = onlyDigits(phone)
  if (!inst || !token || !to) return
  const url = `https://api.z-api.io/instances/${inst}/token/${token}/send-text`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(clientToken ? { 'Client-Token': clientToken } : {}) },
    body: JSON.stringify({ phone: to, message }),
  }).catch(() => {})
}

function approvedMsg(o: Record<string, unknown>): string {
  const num = String(o.number ?? '').padStart(6, '0')
  const first = o.customer_name ? String(o.customer_name).trim().split(/\s+/)[0] : ''
  const hi = first ? `Olá ${first}, o` : 'O'
  const pickup = String(o.shipping_service ?? '') === 'RETIRADA'
  const closing = pickup
    ? 'Seu pedido já pode ser retirado na loja (Sáb. e Dom., das 8h às 15h).'
    : `Já estamos preparando seu envio (${o.shipping_service ?? '—'}).`
  return `🎉 *Pagamento aprovado!*\n${hi} pagamento do seu pedido *nº ${num}* foi confirmado.\nTotal: ${BRL(Number(o.total))}\n${closing} Obrigado pela compra! 🧡`
}

Deno.serve(async (req: Request) => {
  // Sempre responde 200 rápido (o MP reenvia em caso de erro).
  try {
    const token = Deno.env.get('MP_ACCESS_TOKEN')
    if (!token) return new Response('no token', { status: 200 })

    const url = new URL(req.url)
    let type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? ''
    let paymentId = url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? ''
    if (!paymentId || !type) {
      try {
        const body = await req.json()
        type = type || body.type || body.action?.split('.')?.[0] || ''
        paymentId = paymentId || body.data?.id || body.id || ''
      } catch { /* sem corpo */ }
    }
    if (!paymentId || !/payment/i.test(type)) return new Response('ignored', { status: 200 })

    // Consulta o pagamento no Mercado Pago.
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return new Response('mp query failed', { status: 200 })
    const payment = await res.json()
    const orderId = payment.external_reference
    const status = payment.status // approved / pending / rejected / ...
    if (!orderId) return new Response('no ref', { status: 200 })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Carrega o pedido primeiro (para idempotência: o MP reenvia notificações).
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (!order) return new Response('order not found', { status: 200 })

    if (status !== 'approved') {
      // Só atualiza o status de pagamento; não mexe em estoque nem notifica.
      await supabase.from('orders').update({ payment_status: status, mp_payment_id: String(paymentId) }).eq('id', orderId)
      return new Response('ok', { status: 200 })
    }

    // Aprovado. Se já processamos este pedido (paid_at preenchido), não repete
    // baixa de estoque nem WhatsApp — apenas confirma.
    if (order.paid_at) return new Response('already processed', { status: 200 })

    await supabase.from('orders').update({
      payment_status: status,
      mp_payment_id: String(paymentId),
      status: 'paid',
      paid_at: new Date().toISOString(),
    }).eq('id', orderId)

    // Abate o estoque de todos os itens do pedido (agora que está pago).
    const { error: stockErr } = await supabase.rpc('apply_order_stock', { p_order_id: orderId })
    if (stockErr) console.error('[mercadopago-webhook] baixa de estoque falhou:', stockErr.message)

    if (order.customer_phone) await sendWhatsApp(String(order.customer_phone), approvedMsg(order))
    const storeWa = Deno.env.get('STORE_WHATSAPP')
    if (storeWa) {
      await sendWhatsApp(storeWa, `💰 *Pagamento aprovado* — pedido nº ${String(order.number ?? '').padStart(6, '0')} (${BRL(Number(order.total))}).`)
    }
    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('[mercadopago-webhook]', err instanceof Error ? err.message : String(err))
    return new Response('ok', { status: 200 })
  }
})
