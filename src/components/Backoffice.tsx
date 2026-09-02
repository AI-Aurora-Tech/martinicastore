import { useState } from 'react'
import { AuthGate } from './AuthGate'
import { PDV } from './PDV'
import { Admin } from './Admin'

type Tool = 'pdv' | 'admin'

/** Área da equipe (PDV + Gestão), separada da loja online por URL (/gestao).
 *  Usa o MESMO banco de dados da loja — muda apenas o acesso. */
export function Backoffice() {
  const [tool, setTool] = useState<Tool>(
    /\/pdv(\/|$)/.test(window.location.pathname) ? 'pdv' : 'admin',
  )

  function go(next: Tool) {
    setTool(next)
    window.history.replaceState({}, '', next === 'pdv' ? '/gestao/pdv' : '/gestao')
  }
  function exitToStore() {
    window.location.assign('/')
  }

  return (
    <AuthGate subtitle="Área restrita da equipe" onExit={exitToStore}>
      {(operator, logout) => (
        <div className="backoffice">
          <div className="backoffice__switch" role="tablist" aria-label="Área da equipe">
            <span className="backoffice__brand">MARTINICA · Equipe</span>
            <button
              role="tab"
              aria-selected={tool === 'admin'}
              className={`backoffice__tab ${tool === 'admin' ? 'is-active' : ''}`}
              onClick={() => go('admin')}
            >
              📦 Gestão
            </button>
            <button
              role="tab"
              aria-selected={tool === 'pdv'}
              className={`backoffice__tab ${tool === 'pdv' ? 'is-active' : ''}`}
              onClick={() => go('pdv')}
            >
              🧾 PDV
            </button>
            <button className="backoffice__store" onClick={exitToStore} title="Abrir a loja online">
              ↗ Ver loja
            </button>
          </div>
          {tool === 'pdv' ? (
            <PDV operator={operator} onLogout={logout} onExit={exitToStore} />
          ) : (
            <Admin operator={operator} onLogout={logout} onExit={exitToStore} />
          )}
        </div>
      )}
    </AuthGate>
  )
}
