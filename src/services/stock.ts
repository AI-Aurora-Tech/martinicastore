// Movimentação de estoque por produto (log gravado pela migração 0025).
// No modo demo (sem Supabase) não há histórico — devolve lista vazia.
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type StockMovementKind = 'venda' | 'pedido' | 'compra' | 'estorno' | 'ajuste' | string

export interface StockMovement {
  id: string
  productId: string
  /** Variação (tamanho/cor). Ausente quando o produto não tem variação. */
  size?: string
  /** Positivo = entrada; negativo = saída. */
  delta: number
  kind: StockMovementKind
  /** Nº do documento (venda/pedido/compra) ou observação do ajuste. */
  ref?: string
  when: string
}

/** Lista as movimentações de um produto (mais recentes primeiro). */
export async function listStockMovements(productId: string): Promise<StockMovement[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('stock_movements')
    .select('id, product_id, size, delta, kind, ref, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) {
    // Tabela ainda não existe (migração 0025 não aplicada).
    if (error.code === '42P01' || /stock_movements/.test(error.message)) {
      throw new Error('O histórico de estoque precisa da migração 0025 aplicada no Supabase.')
    }
    throw error
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    productId: String(r.product_id),
    size: (r.size as string) ?? undefined,
    delta: Number(r.delta),
    kind: String(r.kind),
    ref: (r.ref as string) ?? undefined,
    when: String(r.created_at),
  }))
}

/**
 * Registra um AJUSTE manual de estoque (baixa/entrada manual feita no admin).
 * As demais movimentações (venda, pedido, compra, estorno) são gravadas no
 * banco por gatilhos — aqui só entra o que não passa por eles.
 */
export async function logStockAdjustment(
  productId: string,
  delta: number,
  opts: { size?: string; note?: string } = {},
): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !delta) return
  try {
    await supabase.from('stock_movements').insert({
      product_id: productId,
      size: opts.size ?? null,
      delta,
      kind: 'ajuste',
      ref: opts.note ?? null,
    })
  } catch {
    /* o log nunca quebra o ajuste de estoque */
  }
}
