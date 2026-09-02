import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  appendExpense,
  readExpenses,
  removeExpenseLocal,
  updateExpenseLocal,
  type ExpenseRecord,
} from './localStore'
import { listPurchases, markPurchasePaid, payPurchaseInstallment } from './purchase'

export interface Expense {
  id: string
  description: string
  category?: string
  amount: number
  dueDate?: string
  paid: boolean
  recurring: boolean
  recurrence?: 'mensal' | 'semanal'
  createdAt: string
}

export interface ExpenseInput {
  description: string
  category?: string
  amount: number
  dueDate?: string
  paid: boolean
  recurring: boolean
  recurrence?: 'mensal' | 'semanal'
  operatorEmail?: string
}

/** Linha unificada de "contas": despesas manuais + compras a pagar/pagas. */
export interface Conta {
  key: string
  source: 'despesa' | 'compra'
  refId: string
  description: string
  category?: string
  amount: number
  when: string
  paid: boolean
  recurring: boolean
  recurrence?: 'mensal' | 'semanal'
  /** Nº da compra (quando source === 'compra'), usado no modo demo. */
  purchaseNumber?: number
  /** Nº da parcela (quando a compra é parcelada). */
  installmentN?: number
}

function rowToExpense(r: Record<string, unknown>): Expense {
  return {
    id: String(r.id),
    description: String(r.description),
    category: (r.category as string) ?? undefined,
    amount: Number(r.amount),
    dueDate: (r.due_date as string) ?? undefined,
    paid: Boolean(r.paid),
    recurring: Boolean(r.recurring),
    recurrence: (r.recurrence as 'mensal' | 'semanal') ?? undefined,
    createdAt: String(r.created_at),
  }
}

function localToExpense(r: ExpenseRecord): Expense {
  return {
    id: r.id,
    description: r.description,
    category: r.category,
    amount: r.amount,
    dueDate: r.dueDate,
    paid: r.paid,
    recurring: r.recurring,
    recurrence: r.recurrence,
    createdAt: r.createdAt,
  }
}

export async function listExpenses(): Promise<Expense[]> {
  if (!isSupabaseConfigured || !supabase) {
    return readExpenses().map(localToExpense).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  const { data, error } = await supabase.from('expenses').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToExpense)
}

export async function createExpense(input: ExpenseInput): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    appendExpense({
      description: input.description,
      category: input.category,
      amount: input.amount,
      dueDate: input.dueDate,
      paid: input.paid,
      paidAt: input.paid ? new Date().toISOString() : undefined,
      recurring: input.recurring,
      recurrence: input.recurrence,
      createdAt: new Date().toISOString(),
    })
    return { error: null }
  }
  const { error } = await supabase.from('expenses').insert({
    description: input.description,
    category: input.category ?? null,
    amount: input.amount,
    due_date: input.dueDate ?? null,
    paid: input.paid,
    paid_at: input.paid ? new Date().toISOString() : null,
    recurring: input.recurring,
    recurrence: input.recurrence ?? null,
    operator_email: input.operatorEmail ?? null,
  })
  return { error: error?.message ?? null }
}

export async function setExpensePaid(id: string, paid: boolean): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    updateExpenseLocal(id, { paid, paidAt: paid ? new Date().toISOString() : undefined })
    return { error: null }
  }
  const { error } = await supabase
    .from('expenses')
    .update({ paid, paid_at: paid ? new Date().toISOString() : null })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function removeExpense(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    removeExpenseLocal(id)
    return { error: null }
  }
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  return { error: error?.message ?? null }
}

/** Lança uma cópia (avulsa) de uma despesa recorrente com vencimento neste mês. */
export async function postRecurringThisMonth(exp: Expense): Promise<{ error: string | null }> {
  const now = new Date()
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return createExpense({
    description: exp.description,
    category: exp.category,
    amount: exp.amount,
    dueDate: due.toISOString().slice(0, 10),
    paid: false,
    recurring: false,
  })
}

/** Contas unificadas: despesas manuais + compras (contas a pagar/pagas). */
export async function listContas(): Promise<Conta[]> {
  const [expenses, purchases] = await Promise.all([listExpenses(), listPurchases()])
  const fromExpenses: Conta[] = expenses.map((e) => ({
    key: `d-${e.id}`,
    source: 'despesa',
    refId: e.id,
    description: e.description,
    category: e.category ?? 'Despesa',
    amount: e.amount,
    when: e.dueDate ?? e.createdAt,
    paid: e.paid,
    recurring: e.recurring,
    recurrence: e.recurrence,
  }))
  const fromPurchases: Conta[] = purchases.flatMap((p) => {
    const label = `Compra nº ${String(p.number).padStart(6, '0')}${p.supplier ? ` · ${p.supplier}` : ''}`
    // Compra parcelada (não à vista) => uma conta por parcela, com o seu vencimento.
    if (p.installments && p.installments.length > 0) {
      const n = p.installments.length
      return p.installments.map((par) => ({
        key: `c-${p.id}-${par.n}`,
        source: 'compra' as const,
        refId: p.id,
        description: `${label} · parcela ${par.n}/${n}`,
        category: 'Compras',
        amount: par.amount,
        when: par.dueDate || p.when,
        paid: !!par.paid,
        recurring: false,
        purchaseNumber: p.number,
        installmentN: par.n,
      }))
    }
    return [{
      key: `c-${p.id}`,
      source: 'compra' as const,
      refId: p.id,
      description: label,
      category: 'Compras',
      amount: p.total,
      when: p.when,
      paid: !!p.paid,
      recurring: false,
      purchaseNumber: p.number,
    }]
  })
  return [...fromExpenses, ...fromPurchases].sort((a, b) => b.when.localeCompare(a.when))
}

/** Marca uma conta como paga/em aberto, despachando por origem. */
export async function setContaPaid(conta: Conta, paid: boolean): Promise<{ error: string | null }> {
  if (conta.source === 'despesa') return setExpensePaid(conta.refId, paid)
  // Compra: baixa da parcela (ou da compra à vista). Reabertura não é suportada aqui.
  if (!paid) return { error: null }
  if (conta.installmentN != null) {
    return payPurchaseInstallment({ id: conta.refId, number: conta.purchaseNumber }, conta.installmentN)
  }
  return markPurchasePaid({ id: conta.refId, number: conta.purchaseNumber } as never)
}
