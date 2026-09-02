// Supabase Edge Function: create-payment
// Cria uma preferência de pagamento no Mercado Pago (Checkout Pro) para um
// pedido e devolve o init_point (URL de pagamento). O cliente é redirecionado
// para lá e paga com Pix ou Cartão. O status vem depois pelo webhook.
//
// Deploy:  supabase functions deploy create-payment
// Segredos:
//   MP_ACCESS_TOKEN  (Access Token de PRODUÇÃO ou TESTE do Mercado Pago)
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da função.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Tipos de pagamento a excluir conforme a escolha do cliente.
function excludedTypes(method: string) {
  if (method === 'pix') return [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'ticket' }]
  if (method === 'cartao') return [{ id: 'ticket' }, { id: 'bank_transfer' }]
  return [{ id: 'ticket' }] // padrão: sem boleto
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const token = Deno.env.get('MP_ACCESS_TOKEN')
    if (!token) {
      return new Response(JSON.stringify({ error: 'mp-not-configured' }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const { orderId, method, origin } = await req.json()
    if (!orderId) throw new Error('orderId é obrigatório.')

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: order, error: oErr } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (oErr || !order) throw oErr ?? new Error('Pedido não encontrado.')
    const { data: itemRows } = await supabase.from('order_items').select('*').eq('order_id', orderId)

    const items = (itemRows ?? []).map((i) => ({
      title: String(i.name).slice(0, 250),
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      currency_id: 'BRL',
    }))
    if (Number(order.shipping) > 0) {
      items.push({ title: `Frete ${order.shipping_service ?? ''}`.trim(), quantity: 1, unit_price: Number(order.shipping), currency_id: 'BRL' })
    }

    const base = (origin && String(origin).replace(/\/$/, '')) || ''
    const num = String(order.number ?? '')
    const preference = {
      items,
      external_reference: String(orderId),
      payer: {
        name: order.customer_name ?? undefined,
        email: order.customer_email ?? undefined,
      },
      payment_methods: { excluded_payment_types: excludedTypes(String(method ?? '')), installments: 10 },
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      statement_descriptor: 'MARTINICA STORE',
      ...(base
        ? {
            back_urls: {
              success: `${base}/?pedido=${num}&pago=aprovado`,
              pending: `${base}/?pedido=${num}&pago=pendente`,
              failure: `${base}/?pedido=${num}&pago=falhou`,
            },
            // auto_return exige URL https válida — o MP rejeita localhost.
            ...(base.startsWith('https://') ? { auto_return: 'approved' } : {}),
          }
        : {}),
    }

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference),
    })
    const pref = await res.json()
    if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${JSON.stringify(pref)}`)

    await supabase.from('orders').update({ mp_preference_id: pref.id, payment_status: 'pending' }).eq('id', orderId)

    return new Response(JSON.stringify({ initPoint: pref.init_point, preferenceId: pref.id }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[create-payment]', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
