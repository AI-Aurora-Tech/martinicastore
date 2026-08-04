import { isSupabaseConfigured, supabase } from '../lib/supabase'

export interface PaymentResult {
  /** URL do Mercado Pago para o cliente pagar. `null` = pagamento online não configurado. */
  initPoint: string | null
  error: string | null
}

/**
 * Cria a preferência de pagamento no Mercado Pago (via Edge Function) e retorna
 * a URL de checkout. Se o Mercado Pago não estiver configurado (ou no modo demo),
 * retorna initPoint:null para a loja seguir com o fluxo sem pagamento online.
 */
export async function createPayment(
  orderId: string | null,
  method: string,
  origin: string,
): Promise<PaymentResult> {
  if (!isSupabaseConfigured || !supabase || !orderId) {
    return { initPoint: null, error: null }
  }
  try {
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: { orderId, method, origin },
    })
    if (error) {
      let detail = error.message
      const ctx = (error as { context?: unknown }).context
      if (ctx && typeof (ctx as Response).json === 'function') {
        try {
          const body = await (ctx as Response).json()
          if (body?.error) detail = body.error
        } catch { /* ignore */ }
      }
      console.warn('[payment] erro ao criar pagamento:', detail)
      return { initPoint: null, error: detail }
    }
    const d = data as { initPoint?: string | null } | null
    return { initPoint: d?.initPoint ?? null, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao iniciar o pagamento.'
    return { initPoint: null, error: message }
  }
}
