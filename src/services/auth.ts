import { isSupabaseConfigured, supabase } from '../lib/supabase'

export interface Operator {
  id: string
  email: string
  name: string
}

export const authMode: 'supabase' | 'demo' = isSupabaseConfigured
  ? 'supabase'
  : 'demo'

/** Operadores de demonstração (usados apenas no modo demo, sem Supabase). */
const DEMO_OPERATORS = [
  { user: 'caixa01', pass: '1234', name: 'Operador — Caixa 01' },
  { user: 'gerente', pass: 'martinica', name: 'Gerente da Loja' },
]
const DEMO_KEY = 'martinica-pdv-operator'

interface AuthResult {
  operator: Operator | null
  error: string | null
}

function nameFromEmail(email: string) {
  const handle = email.split('@')[0] ?? email
  return handle.charAt(0).toUpperCase() + handle.slice(1)
}

/**
 * Verifica se o usuário atualmente autenticado é ADMIN (consta na tabela
 * `admins`). Só admins podem acessar o PDV e o painel de gestão. No modo demo
 * não há distinção de papéis (retorna true).
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  if (authMode !== 'supabase' || !supabase) return true
  const { data, error } = await supabase.rpc('is_admin')
  if (error) {
    console.warn('[auth] falha ao verificar admin:', error.message)
    return false
  }
  return data === true
}

/** Autentica um operador. `login` é o e-mail no modo Supabase. */
export async function signIn(login: string, password: string): Promise<AuthResult> {
  if (authMode === 'supabase' && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: login.trim(),
      password,
    })
    if (error || !data.user) {
      return { operator: null, error: error?.message ?? 'Falha na autenticação.' }
    }
    // Só admins entram no PDV/painel. Cliente comum é deslogado aqui.
    if (!(await isCurrentUserAdmin())) {
      await supabase.auth.signOut()
      return {
        operator: null,
        error: 'Esta conta não tem acesso ao PDV/painel. Fale com o administrador.',
      }
    }
    const email = data.user.email ?? login
    return {
      operator: {
        id: data.user.id,
        email,
        name: (data.user.user_metadata?.name as string) || nameFromEmail(email),
      },
      error: null,
    }
  }

  // Modo demo
  const found = DEMO_OPERATORS.find(
    (o) => o.user === login.trim().toLowerCase() && o.pass === password,
  )
  if (!found) return { operator: null, error: 'Usuário ou senha inválidos.' }
  const op: Operator = { id: found.user, email: found.user, name: found.name }
  try {
    sessionStorage.setItem(DEMO_KEY, JSON.stringify(op))
  } catch {
    /* ignore */
  }
  return { operator: op, error: null }
}

export async function signOut(): Promise<void> {
  if (authMode === 'supabase' && supabase) {
    await supabase.auth.signOut()
    return
  }
  try {
    sessionStorage.removeItem(DEMO_KEY)
  } catch {
    /* ignore */
  }
}

/** Recupera a sessão atual (se houver) para manter o operador logado. */
export async function getCurrentOperator(): Promise<Operator | null> {
  if (authMode === 'supabase' && supabase) {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) return null
    // Mantém logado no PDV/painel apenas se ainda for admin.
    if (!(await isCurrentUserAdmin())) return null
    const email = user.email ?? ''
    return {
      id: user.id,
      email,
      name: (user.user_metadata?.name as string) || nameFromEmail(email),
    }
  }
  try {
    const raw = sessionStorage.getItem(DEMO_KEY)
    return raw ? (JSON.parse(raw) as Operator) : null
  } catch {
    return null
  }
}
