// Supabase Edge Function: place-order
// Cria o pedido da loja NO SERVIDOR, com preços, custos e frete recalculados a
// partir do banco (nunca confia nos valores enviados pelo navegador). Assim o
// cliente não consegue forjar preço/frete antes de ir ao Mercado Pago.
//
// Também valida disponibilidade de estoque. O estoque só é ABATIDO quando o
// pagamento é aprovado (webhook), não na criação do pedido.
//
// Chamada pelo navegador do cliente (anon), então publique SEM JWT:
//   supabase/config.toml → [functions.place-order] verify_jwt = false
//
// Deploy:  supabase functions deploy place-order
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da função.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ---- Frete (espelha src/services/shipping.ts) -----------------------------
const FREE_SHIPPING_MIN = 299
const UF_REGION: Record<string, string> = {
  SP: 'sudeste', RJ: 'sudeste', MG: 'sudeste', ES: 'sudeste',
  PR: 'sul', SC: 'sul', RS: 'sul',
  DF: 'centro', GO: 'centro', MT: 'centro', MS: 'centro',
  BA: 'nordeste', SE: 'nordeste', AL: 'nordeste', PE: 'nordeste', PB: 'nordeste',
  RN: 'nordeste', CE: 'nordeste', PI: 'nordeste', MA: 'nordeste',
  TO: 'norte', PA: 'norte', AP: 'norte', RR: 'norte', AM: 'norte', AC: 'norte', RO: 'norte',
}
const REGION_RATE: Record<string, { pacBase: number; pacPerKg: number; pacDays: number }> = {
  sudeste: { pacBase: 18.9, pacPerKg: 6, pacDays: 4 },
  sul: { pacBase: 22.9, pacPerKg: 7, pacDays: 5 },
  centro: { pacBase: 26.9, pacPerKg: 8, pacDays: 6 },
  nordeste: { pacBase: 32.9, pacPerKg: 10, pacDays: 8 },
  norte: { pacBase: 39.9, pacPerKg: 13, pacDays: 11 },
}
const round2 = (n: number) => Math.round(n * 100) / 100

function quoteShipping(uf: string, weightGrams: number, subtotal: number) {
  const region = UF_REGION[(uf || '').toUpperCase()] ?? 'sudeste'
  const rate = REGION_RATE[region]
  const kg = Math.max(0.3, weightGrams / 1000)
  const pacPrice = round2(rate.pacBase + rate.pacPerKg * kg)
  const sedexPrice = round2(pacPrice * 1.6 + 5)
  const sedexDays = Math.max(1, Math.ceil(rate.pacDays / 2))
  const freePac = subtotal >= FREE_SHIPPING_MIN
  return [
    { service: 'PAC', price: freePac ? 0 : pacPrice, days: rate.pacDays },
    { service: 'SEDEX', price: sedexPrice, days: sedexDays },
  ]
}

interface ItemIn { productId: string; size?: string | null; quantity: number }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const input = await req.json()
    const rawItems: ItemIn[] = Array.isArray(input?.items) ? input.items : []
    if (rawItems.length === 0) return json({ error: 'Carrinho vazio.' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Consolida quantidades por produto e busca os dados REAIS no banco.
    const ids = [...new Set(rawItems.map((i) => String(i.productId)))]
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, name, price, cost, stock, weight, active')
      .in('id', ids)
    if (pErr) throw pErr
    const byId = new Map((products ?? []).map((p) => [String(p.id), p]))

    let subtotal = 0
    let weight = 0
    const orderItems: Record<string, unknown>[] = []
    // Soma por produto p/ checar estoque total do pedido.
    const qtyByProduct = new Map<string, number>()
    for (const it of rawItems) {
      qtyByProduct.set(String(it.productId), (qtyByProduct.get(String(it.productId)) ?? 0) + Math.max(0, Number(it.quantity) || 0))
    }

    for (const it of rawItems) {
      const pid = String(it.productId)
      const qty = Math.floor(Number(it.quantity) || 0)
      if (qty <= 0) return json({ error: 'Quantidade inválida no carrinho.' }, 400)
      const p = byId.get(pid)
      if (!p || p.active === false) return json({ error: `Produto indisponível: ${pid}.` }, 400)
      if (Number(p.stock) < (qtyByProduct.get(pid) ?? qty)) {
        return json({ error: `Estoque insuficiente para "${p.name}".` }, 409)
      }
      const price = Number(p.price)
      subtotal += price * qty
      weight += (Number(p.weight) || 300) * qty
      orderItems.push({
        product_id: pid,
        name: p.name,
        size: it.size ?? null,
        unit_price: price,
        unit_cost: Number(p.cost) || 0,
        quantity: qty,
        line_total: round2(price * qty),
      })
    }
    subtotal = round2(subtotal)

    // Frete recalculado no servidor a partir da UF e do peso reais.
    const uf = String(input?.address?.uf ?? '')
    const opts = quoteShipping(uf, weight, subtotal)
    const wanted = String(input?.shippingService ?? 'PAC').toUpperCase()
    const ship = opts.find((o) => o.service === wanted) ?? opts[0]
    const shipping = round2(ship.price)

    const discount = 0
    const total = round2(subtotal - discount + shipping)
    const payment = ['pix', 'cartao', 'boleto'].includes(String(input?.payment))
      ? String(input.payment)
      : 'pix'

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert({
        customer_id: input?.customerId ?? null,
        customer_name: input?.customerName ?? null,
        customer_email: input?.customerEmail ?? null,
        customer_phone: input?.customerPhone ?? null,
        subtotal,
        discount,
        shipping,
        total,
        payment_method: payment,
        status: 'pending',
        shipping_service: ship.service,
        shipping_days: ship.days,
        ship_cep: input?.address?.cep ?? null,
        ship_street: input?.address?.street ?? null,
        ship_number: input?.address?.number ?? null,
        ship_complement: input?.address?.complement ?? null,
        ship_neighborhood: input?.address?.neighborhood ?? null,
        ship_city: input?.address?.city ?? null,
        ship_uf: input?.address?.uf ?? null,
      })
      .select('id, number')
      .single()
    if (oErr || !order) throw oErr ?? new Error('Falha ao criar pedido.')

    const withOrder = orderItems.map((i) => ({ ...i, order_id: order.id }))
    const { error: iErr } = await supabase.from('order_items').insert(withOrder)
    if (iErr) throw iErr

    return json({
      id: order.id,
      number: order.number,
      subtotal,
      discount,
      shipping,
      total,
      shippingService: ship.service,
      shippingDays: ship.days,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[place-order]', message)
    return json({ error: message }, 500)
  }
})
