import { useMemo, useState } from 'react'
import { money, qty as fmtQty } from '../format'
import { parseNumber } from './PdvScreen'
import { productAvailability, productCost, uid, useStore } from '../store'
import { UNIT_LABEL, type Ingredient, type Unit } from '../types'

/**
 * Estoque de insumos. É aqui que a conta "5 kg de batata ÷ 500 g por porção =
 * 10 porções" aparece: o painel de disponibilidade traduz o saldo dos insumos
 * em quantas porções cada produto ainda pode vender.
 */
export function StockScreen() {
  const { ingredients, products, saveIngredient, removeIngredient } = useStore()
  const [editing, setEditing] = useState<Ingredient | null>(null)

  const totalValue = ingredients.reduce((s, i) => s + i.stock * i.avgCost, 0)
  const low = ingredients.filter((i) => i.stock <= i.minStock)

  const availability = useMemo(
    () =>
      products
        .filter((p) => p.active)
        .map((p) => ({
          product: p,
          portions: productAvailability(p, ingredients),
          cost: productCost(p, ingredients),
        }))
        .sort((a, b) => (a.portions ?? Infinity) - (b.portions ?? Infinity)),
    [products, ingredients],
  )

  return (
    <div className="lm-stack">
      <div className="lm-kpis">
        <Kpi label="Insumos cadastrados" value={String(ingredients.length)} />
        <Kpi label="Valor em estoque" value={money(totalValue)} />
        <Kpi
          label="Abaixo do mínimo"
          value={String(low.length)}
          tone={low.length > 0 ? 'bad' : 'good'}
        />
      </div>

      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Insumos</h2>
          <button
            type="button"
            className="lm-btn lm-btn--primary lm-btn--sm"
            onClick={() =>
              setEditing({
                id: uid('ing'),
                name: '',
                unit: 'kg',
                stock: 0,
                minStock: 0,
                avgCost: 0,
              })
            }
          >
            + Novo insumo
          </button>
        </header>
        <div className="lm-tableWrap">
          <table className="lm-table">
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Unidade</th>
                <th>Saldo</th>
                <th>Mínimo</th>
                <th>Custo médio</th>
                <th>Valor em estoque</th>
                <th>Situação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {ingredients.map((i) => {
                const status =
                  i.stock <= 0 ? 'zerado' : i.stock <= i.minStock ? 'baixo' : 'ok'
                return (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td>{UNIT_LABEL[i.unit]}</td>
                    <td>
                      <strong>
                        {fmtQty(i.stock)} {i.unit}
                      </strong>
                    </td>
                    <td>{fmtQty(i.minStock)}</td>
                    <td>{money(i.avgCost)}</td>
                    <td>{money(i.stock * i.avgCost)}</td>
                    <td>
                      <span
                        className={`lm-tag lm-tag--${status === 'ok' ? 'entregue' : status === 'baixo' ? 'pronto' : 'cancelado'}`}
                      >
                        {status === 'ok' ? 'Normal' : status === 'baixo' ? 'Repor' : 'Zerado'}
                      </span>
                    </td>
                    <td className="lm-actions">
                      <button
                        type="button"
                        className="lm-btn lm-btn--ghost lm-btn--sm"
                        onClick={() => setEditing({ ...i })}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="lm-btn lm-btn--danger lm-btn--sm"
                        onClick={() => {
                          if (confirm(`Excluir o insumo "${i.name}"? Ele sairá das fichas técnicas.`)) {
                            removeIngredient(i.id)
                          }
                        }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Disponibilidade por produto</h2>
          <span className="lm-panel__hint">
            Porções que o estoque atual permite vender, pela ficha técnica
          </span>
        </header>
        <div className="lm-tableWrap">
          <table className="lm-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Ficha técnica</th>
                <th>Custo</th>
                <th>Preço</th>
                <th>Margem</th>
                <th>Porções disponíveis</th>
              </tr>
            </thead>
            <tbody>
              {availability.map(({ product, portions, cost }) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td className="lm-recipeCell">
                    {product.recipe.length === 0
                      ? '—'
                      : product.recipe
                          .map((r) => {
                            const ing = ingredients.find((x) => x.id === r.ingredientId)
                            if (!ing) return null
                            return `${fmtQty(r.qty)} ${ing.unit} ${ing.name}`
                          })
                          .filter(Boolean)
                          .join(' · ')}
                  </td>
                  <td>{money(cost)}</td>
                  <td>{money(product.price)}</td>
                  <td>
                    {product.price > 0
                      ? `${Math.round(((product.price - cost) / product.price) * 100)}%`
                      : '—'}
                  </td>
                  <td>
                    <strong className={portions != null && portions <= 0 ? 'lm-bad' : undefined}>
                      {portions == null ? 'Sob demanda' : `${portions} porções`}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <IngredientDialog
          ingredient={editing}
          onCancel={() => setEditing(null)}
          onSave={(i) => {
            saveIngredient(i)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function IngredientDialog({
  ingredient,
  onSave,
  onCancel,
}: {
  ingredient: Ingredient
  onSave: (i: Ingredient) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(ingredient.name)
  const [unit, setUnit] = useState<Unit>(ingredient.unit)
  const [stock, setStock] = useState(String(ingredient.stock))
  const [minStock, setMinStock] = useState(String(ingredient.minStock))
  const [avgCost, setAvgCost] = useState(String(ingredient.avgCost))
  const [error, setError] = useState('')

  return (
    <div className="lm-modal" role="dialog" aria-modal="true" aria-label="Insumo">
      <div className="lm-modal__box">
        <h2>{ingredient.name ? 'Editar insumo' : 'Novo insumo'}</h2>
        <div className="lm-form lm-form--2">
          <label>
            Nome
            <input className="lm-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Unidade de estoque
            <select
              className="lm-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
            >
              {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Saldo atual
            <input
              className="lm-input"
              inputMode="decimal"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </label>
          <label>
            Estoque mínimo
            <input
              className="lm-input"
              inputMode="decimal"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </label>
          <label>
            Custo médio por unidade (R$)
            <input
              className="lm-input"
              inputMode="decimal"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
            />
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
              if (!name.trim()) {
                setError('Informe o nome do insumo.')
                return
              }
              onSave({
                ...ingredient,
                name: name.trim(),
                unit,
                stock: Math.max(0, parseNumber(stock)),
                minStock: Math.max(0, parseNumber(minStock)),
                avgCost: Math.max(0, parseNumber(avgCost)),
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

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`lm-kpi${tone ? ` is-${tone}` : ''}`}>
      <span className="lm-kpi__label">{label}</span>
      <strong className="lm-kpi__value">{value}</strong>
    </div>
  )
}
