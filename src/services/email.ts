import { isSupabaseConfigured, supabase } from '../lib/supabase'

export interface EmailResult {
  sent: boolean
  error: string | null
}

/**
 * Dispara o e-mail de confirmação do pedido chamando a Edge Function
 * `send-order-email` (que lê o pedido no banco e envia via Resend).
 * É "best-effort": nunca deve travar a confirmação da compra.
 * No modo demo (sem Supabase) não há backend de e-mail — retorna sent:false.
 */
export async function sendOrderEmail(orderId: string | null): Promise<EmailResult> {
  if (!isSupabaseConfigured || !supabase || !orderId) {
    return { sent: false, error: null }
  }
  try {
    const { error } = await supabase.functions.invoke('send-order-email', {
      body: { orderId },
    })
    if (error) return { sent: false, error: error.message }
    return { sent: true, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao enviar e-mail.'
    console.warn('[email] não foi possível enviar a confirmação:', err)
    return { sent: false, error: message }
  }
}
