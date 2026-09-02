import { isSupabaseConfigured, supabase } from '../lib/supabase'

/** Papel do usuário da equipe. `admin` = Gestão + PDV. `operator` = só PDV. */
export type StaffRole = 'admin' | 'operator'

export interface Operator {
  id: string
  email: string
  name: string
  role: StaffRole
}

export const authMode: 'supabase' | 'demo' = isSupabaseConfigured
  ? 'supabase'
  : 'demo'

/** Operadores de demonstração (usados apenas no modo demo, sem Supabase). */
const DEMO_OPERATORS: { user: string; pass: string; name: string; role: StaffRole }[] = [
  { user: 'caixa01', pass: '1234', name: 'Operador — Caixa 01', role: 'operator' },
  { user: 'gerente', pass: 'martinica', name: 'Gerente da Loja', role: 'admin' },
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
 * Retorna o papel do usuário autenticado no Supabase: `admin`, `operator` ou
 * `null` (não faz parte da equipe). No modo demo não se aplica (retorna null).
 */
export async function getStaffRole(): Promise<StaffRole | null> {
  if (authMode !== 'supabase' || !supabase) return null
  const { data, error } = await supabase.rpc('staff_role')
  if (error) {
    console.warn('[auth] falha ao verificar papel:', error.message)
    return null
  }
  return data === 'admin' || data === 'operator' ? data : null
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
    // Só a equipe (admin/operador) entra. Cliente comum é deslogado aqui.
    const role = await getStaffRole()
    if (!role) {
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
        role,
      },
      error: null,
    }
  }

  // Modo demo
  const found = DEMO_OPERATORS.find(
    (o) => o.user === login.trim().toLowerCase() && o.pass === password,
  )
  if (!found) return { operator: null, error: 'Usuário ou senha inválidos.' }
  const op: Operator = { id: found.user, email: found.user, name: found.name, role: found.role }
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
    // Mantém logado no PDV/painel apenas se ainda fizer parte da equipe.
    const role = await getStaffRole()
    if (!role) return null
    const email = user.email ?? ''
    return {
      id: user.id,
      email,
      name: (user.user_metadata?.name as string) || nameFromEmail(email),
      role,
    }
  }
  try {
    const raw = sessionStorage.getItem(DEMO_KEY)
    if (!raw) return null
    const op = JSON.parse(raw) as Operator
    // Compatibilidade: sessões antigas sem `role` viram admin.
    return { ...op, role: op.role ?? 'admin' }
  } catch {
    return null
  }
}
