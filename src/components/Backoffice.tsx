import { useState } from 'react'
import { AuthGate } from './AuthGate'
import { PDV } from './PDV'
import { Admin } from './Admin'
import type { Operator } from '../services/auth'

type Tool = 'pdv' | 'admin'

/** Área da equipe (PDV + Gestão), separada da loja online por URL (/gestao).
 *  Usa o MESMO banco de dados da loja — muda apenas o acesso.
 *  Papéis: `admin` acessa Gestão + PDV; `operator` acessa somente o PDV. */
export function Backoffice() {
  return (
    <AuthGate subtitle="Área restrita da equipe" onExit={() => window.location.assign('/')}>
      {(operator, logout) => <Shell operator={operator} logout={logout} />}
    </AuthGate>
  )
}

function Shell({ operator, logout }: { operator: Operator; logout: () => Promise<void> }) {
  const isAdmin = operator.role === 'admin'
  // Operador só tem PDV; admin escolhe a ferramenta (começa na que a URL pedir).
  const [tool, setTool] = useState<Tool>(
    !isAdmin || /\/pdv(\/|$)/.test(window.location.pathname) ? 'pdv' : 'admin',
  )
  const current: Tool = isAdmin ? tool : 'pdv'

  function go(next: Tool) {
    if (!isAdmin) return
    setTool(next)
    window.history.replaceState({}, '', next === 'pdv' ? '/gestao/pdv' : '/gestao')
  }
  function exitToStore() {
    window.location.assign('/')
  }

  return (
    <div className="backoffice">
      <div className="backoffice__switch" role="tablist" aria-label="Área da equipe">
        <span className="backoffice__brand">MARTINICA · Equipe</span>
        {isAdmin && (
          <>
            <button
              role="tab"
              aria-selected={current === 'admin'}
              className={`backoffice__tab ${current === 'admin' ? 'is-active' : ''}`}
              onClick={() => go('admin')}
            >
              📦 Gestão
            </button>
            <button
              role="tab"
              aria-selected={current === 'pdv'}
              className={`backoffice__tab ${current === 'pdv' ? 'is-active' : ''}`}
              onClick={() => go('pdv')}
            >
              🧾 PDV
            </button>
          </>
        )}
        {!isAdmin && <span className="backoffice__role">🧾 Ponto de Venda</span>}
        <button className="backoffice__store" onClick={exitToStore} title="Abrir a loja online">
          ↗ Ver loja
        </button>
      </div>
      {current === 'pdv' ? (
        <PDV operator={operator} onLogout={logout} onExit={exitToStore} />
      ) : (
        <Admin operator={operator} onLogout={logout} onExit={exitToStore} />
      )}
    </div>
  )
}
