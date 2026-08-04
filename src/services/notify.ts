import { isSupabaseConfigured, supabase } from '../lib/supabase'

export interface NotifyResult {
  sent: boolean
  error: string | null
}

/**
 * Dispara a notificação do pedido por WhatsApp chamando a Edge Function
 * `notify-order` (que lê o pedido no banco e envia via Z-API para a loja e o
 * cliente). É "best-effort": nunca deve travar a confirmação da compra.
 * No modo demo (sem Supabase) não há backend — retorna sent:false.
 */
export async function notifyOrder(orderId: string | null): Promise<NotifyResult> {
  if (!isSupabaseConfigured || !supabase || !orderId) {
    return { sent: false, error: null }
  }
  try {
    const { data, error } = await supabase.functions.invoke('notify-order', {
      body: { orderId },
    })
    if (error) {
      let detail = error.message
      // FunctionsHttpError expõe a resposta em `context`; lê o {error} do corpo.
      const ctx = (error as { context?: unknown }).context
      if (ctx && typeof (ctx as Response).json === 'function') {
        try {
          const body = await (ctx as Response).json()
          if (body?.error) detail = body.error
        } catch {
          /* corpo não-JSON */
        }
      }
      // Erro de alcance (função ainda não publicada / CORS / rede).
      if (/failed to send a request|fetch/i.test(detail)) {
        detail =
          "Não foi possível alcançar a função 'notify-order'. Ela provavelmente ainda não foi publicada (faça o deploy) — veja SETUP.md."
      }
      console.warn('[notify] função retornou erro:', detail)
      return { sent: false, error: detail }
    }
    const d = data as { whatsappSent?: boolean } | null
    const sent = d ? Boolean(d.whatsappSent) : true
    return { sent, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao notificar o pedido.'
    console.warn('[notify] não foi possível enviar a notificação:', err)
    return { sent: false, error: message }
  }
}
