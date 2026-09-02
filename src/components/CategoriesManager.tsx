import { useState } from 'react'
import { useCatalog } from '../context/CatalogContext'
import { deleteCategory, saveCategory, slugify } from '../services/categories'
import type { Category } from '../types'

/** Edição das categorias de produtos (adicionar, renomear, reordenar, excluir). */
export function CategoriesManager({ onFlash }: { onFlash?: (msg: string) => void }) {
  const { categories, products, refresh } = useCatalog()
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function countProducts(id: string) {
    return products.filter((p) => p.category === id).length
  }

  async function add() {
    const label = newLabel.trim()
    if (!label) return
    const id = slugify(label) || `cat-${Date.now().toString(36)}`
    if (categories.some((c) => c.id === id)) {
      setError('Já existe uma categoria com esse nome.')
      return
    }
    setBusy(true)
    setError(null)
    const cat: Category = { id, label, sort: categories.length }
    const { error: err } = await saveCategory(cat, categories)
    setBusy(false)
    if (err) return setError(err)
    setNewLabel('')
    onFlash?.(`Categoria "${label}" adicionada.`)
    refresh()
  }

  async function rename(cat: Category) {
    const label = (editing[cat.id] ?? cat.label).trim()
    if (!label || label === cat.label) {
      setEditing((e) => {
        const { [cat.id]: _drop, ...rest } = e
        return rest
      })
      return
    }
    setBusy(true)
    setError(null)
    const { error: err } = await saveCategory({ ...cat, label }, categories)
    setBusy(false)
    if (err) return setError(err)
    setEditing((e) => {
      const { [cat.id]: _drop, ...rest } = e
      return rest
    })
    onFlash?.(`Categoria renomeada para "${label}".`)
    refresh()
  }

  async function move(cat: Category, dir: -1 | 1) {
    const ordered = [...categories]
    const i = ordered.findIndex((c) => c.id === cat.id)
    const j = i + dir
    if (j < 0 || j >= ordered.length) return
    ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
    setBusy(true)
    setError(null)
    for (let k = 0; k < ordered.length; k++) {
      await saveCategory({ ...ordered[k], sort: k }, ordered)
    }
    setBusy(false)
    onFlash?.('Ordem das categorias atualizada.')
    refresh()
  }

  async function remove(cat: Category) {
    const n = countProducts(cat.id)
    if (n > 0) {
      setError(`"${cat.label}" tem ${n} produto(s). Mova-os para outra categoria antes de excluir.`)
      return
    }
    if (!confirm(`Excluir a categoria "${cat.label}"?`)) return
    setBusy(true)
    setError(null)
    const { error: err } = await deleteCategory(cat.id, categories)
    setBusy(false)
    if (err) return setError(err)
    onFlash?.(`Categoria "${cat.label}" excluída.`)
    refresh()
  }

  return (
    <section className="cats">
      <div className="cats__head">
        <h3>Categorias de produtos</h3>
        <p>Adicione, renomeie, reordene ou exclua as categorias exibidas na loja.</p>
      </div>

      {error && (
        <div className="admin__banner admin__banner--error">
          ⚠️ {error} <button onClick={() => setError(null)}>fechar</button>
        </div>
      )}

      <div className="cats__add">
        <input
          type="text"
          placeholder="Nome da nova categoria (ex.: Bonés)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn btn--primary" onClick={add} disabled={busy || !newLabel.trim()}>
          + Adicionar
        </button>
      </div>

      <ul className="cats__list">
        {categories.map((cat, i) => (
          <li key={cat.id} className="cats__row">
            <div className="cats__order">
              <button onClick={() => move(cat, -1)} disabled={busy || i === 0} aria-label="Subir">▲</button>
              <button onClick={() => move(cat, 1)} disabled={busy || i === categories.length - 1} aria-label="Descer">▼</button>
            </div>
            <input
              className="cats__label"
              value={editing[cat.id] ?? cat.label}
              onChange={(e) => setEditing((s) => ({ ...s, [cat.id]: e.target.value }))}
              onBlur={() => rename(cat)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <span className="cats__id">/{cat.id}</span>
            <span className="cats__count">{countProducts(cat.id)} produto(s)</span>
            <button className="cats__del" onClick={() => remove(cat)} disabled={busy} aria-label="Excluir">🗑</button>
          </li>
        ))}
        {categories.length === 0 && <li className="cats__empty">Nenhuma categoria cadastrada.</li>}
      </ul>
    </section>
  )
}
