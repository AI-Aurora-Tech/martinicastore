import { useState } from 'react'
import { uid, useStore } from '../store'
import { ROLE_LABEL, type Role, type User } from '../types'

function blankUser(): User {
  return { id: uid('user'), name: '', username: '', password: '', role: 'pdv', active: true }
}

/** Perfis de acesso: Admin (gestão completa) e PDV (apenas caixa e fila). */
export function UsersScreen({ currentUserId }: { currentUserId: string }) {
  const { users, saveUser, removeUser, resetDemo } = useStore()
  const [editing, setEditing] = useState<User | null>(null)

  return (
    <div className="lm-stack">
      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Usuários e perfis</h2>
          <button
            type="button"
            className="lm-btn lm-btn--primary lm-btn--sm"
            onClick={() => setEditing(blankUser())}
          >
            + Novo usuário
          </button>
        </header>
        <div className="lm-tableWrap">
          <table className="lm-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Situação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    {u.id === currentUserId && <span className="lm-sub">sessão atual</span>}
                  </td>
                  <td>{u.username}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>
                    <span className={`lm-tag lm-tag--${u.active ? 'entregue' : 'cancelado'}`}>
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="lm-actions">
                    <button
                      type="button"
                      className="lm-btn lm-btn--ghost lm-btn--sm"
                      onClick={() => setEditing({ ...u })}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="lm-btn lm-btn--danger lm-btn--sm"
                      disabled={u.id === currentUserId}
                      onClick={() => {
                        if (confirm(`Excluir o usuário "${u.name}"?`)) removeUser(u.id)
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="lm-note lm-note--muted">
          O perfil <strong>Administrador</strong> abre a gestão completa (produtos, estoque,
          compras, contas e financeiro). O perfil <strong>Operador de PDV</strong> vê apenas a
          vitrine de vendas e a fila de pedidos.
        </p>
      </section>

      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Dados do sistema</h2>
        </header>
        <p className="lm-note lm-note--muted">
          Os dados ficam salvos neste navegador. Restaurar a demonstração apaga pedidos, compras e
          contas lançadas e devolve o cadastro inicial.
        </p>
        <button
          type="button"
          className="lm-btn lm-btn--danger"
          onClick={() => {
            if (confirm('Restaurar os dados de demonstração? Todo o histórico será apagado.')) {
              resetDemo()
            }
          }}
        >
          Restaurar dados de demonstração
        </button>
      </section>

      {editing && (
        <UserDialog
          user={editing}
          onCancel={() => setEditing(null)}
          onSave={(u) => {
            saveUser(u)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function UserDialog({
  user,
  onSave,
  onCancel,
}: {
  user: User
  onSave: (u: User) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(user)
  const [error, setError] = useState('')

  return (
    <div className="lm-modal" role="dialog" aria-modal="true" aria-label="Usuário">
      <div className="lm-modal__box">
        <h2>{user.name ? 'Editar usuário' : 'Novo usuário'}</h2>
        <div className="lm-form lm-form--2">
          <label>
            Nome
            <input
              className="lm-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Usuário (login)
            <input
              className="lm-input"
              value={draft.username}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
              autoCapitalize="none"
            />
          </label>
          <label>
            Senha
            <input
              className="lm-input"
              type="text"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
          </label>
          <label>
            Perfil
            <select
              className="lm-input"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
            >
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="lm-check lm-span2">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Usuário ativo
          </label>
        </div>
        {error && <p className="lm-alert">{error}</p>}
        <div className="lm-modal__actions">
          <button type="button" className="lm-btn lm-btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="lm-btn lm-btn--primary"
            onClick={() => {
              if (!draft.name.trim() || !draft.username.trim() || !draft.password) {
                setError('Preencha nome, usuário e senha.')
                return
              }
              onSave({
                ...draft,
                name: draft.name.trim(),
                username: draft.username.trim().toLowerCase(),
              })
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
