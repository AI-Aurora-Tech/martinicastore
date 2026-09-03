import { useState } from 'react'
import { FoodImage } from '../components/FoodImage'
import { money, qty as fmtQty } from '../format'
import { parseNumber } from './PdvScreen'
import { productAvailability, productCost, uid, useStore } from '../store'
import {
  CATEGORY_LABEL,
  FOOD_KIND_LABEL,
  type FoodKind,
  type Product,
  type ProductCategory,
  type RecipeItem,
} from '../types'

function blankProduct(): Product {
  return {
    id: uid('prod'),
    name: '',
    description: '',
    category: 'lanches',
    price: 0,
    kind: 'burger',
    active: true,
    recipe: [],
  }
}

/** Cadastro dos itens de venda e da ficha técnica que liga cada um ao estoque. */
export function ProductsScreen() {
  const { products, ingredients, saveProduct, removeProduct } = useStore()
  const [editing, setEditing] = useState<Product | null>(null)

  return (
    <div className="lm-stack">
      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Produtos de venda</h2>
          <button
            type="button"
            className="lm-btn lm-btn--primary lm-btn--sm"
            onClick={() => setEditing(blankProduct())}
          >
            + Novo produto
          </button>
        </header>
        <div className="lm-tableWrap">
          <table className="lm-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Custo</th>
                <th>Margem</th>
                <th>Disponível</th>
                <th>Situação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const cost = productCost(p, ingredients)
                const portions = productAvailability(p, ingredients)
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="lm-productCell">
                        <span className="lm-thumb">
                          <FoodImage kind={p.kind} image={p.image} alt={p.name} />
                        </span>
                        <span>
                          {p.name}
                          <span className="lm-sub">{p.description}</span>
                        </span>
                      </div>
                    </td>
                    <td>{CATEGORY_LABEL[p.category]}</td>
                    <td>{money(p.price)}</td>
                    <td>{money(cost)}</td>
                    <td>
                      {p.price > 0 ? `${Math.round(((p.price - cost) / p.price) * 100)}%` : '—'}
                    </td>
                    <td>{portions == null ? 'Sob demanda' : `${portions}`}</td>
                    <td>
                      <span className={`lm-tag lm-tag--${p.active ? 'entregue' : 'cancelado'}`}>
                        {p.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="lm-actions">
                      <button
                        type="button"
                        className="lm-btn lm-btn--ghost lm-btn--sm"
                        onClick={() => setEditing({ ...p, recipe: p.recipe.map((r) => ({ ...r })) })}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="lm-btn lm-btn--danger lm-btn--sm"
                        onClick={() => {
                          if (confirm(`Excluir o produto "${p.name}"?`)) removeProduct(p.id)
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

      {editing && (
        <ProductDialog
          product={editing}
          onCancel={() => setEditing(null)}
          onSave={(p) => {
            saveProduct(p)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function ProductDialog({
  product,
  onSave,
  onCancel,
}: {
  product: Product
  onSave: (p: Product) => void
  onCancel: () => void
}) {
  const { ingredients } = useStore()
  const [draft, setDraft] = useState<Product>(product)
  const [price, setPrice] = useState(
    product.price > 0 ? product.price.toFixed(2).replace('.', ',') : '',
  )
  const [error, setError] = useState('')

  function patch(p: Partial<Product>) {
    setDraft((prev) => ({ ...prev, ...p }))
  }

  function setRecipe(recipe: RecipeItem[]) {
    patch({ recipe })
  }

  const cost = productCost({ ...draft, price: parseNumber(price) }, ingredients)

  return (
    <div className="lm-modal" role="dialog" aria-modal="true" aria-label="Produto">
      <div className="lm-modal__box lm-modal__box--wide">
        <h2>{product.name ? 'Editar produto' : 'Novo produto'}</h2>

        <div className="lm-productEdit">
          <div className="lm-productEdit__preview">
            <span className="lm-thumb lm-thumb--lg">
              <FoodImage kind={draft.kind} image={draft.image} alt={draft.name} />
            </span>
            <span className="lm-productEdit__price">{money(parseNumber(price))}</span>
          </div>

          <div className="lm-form lm-form--2">
            <label className="lm-span2">
              Nome
              <input
                className="lm-input"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <label className="lm-span2">
              Descrição
              <input
                className="lm-input"
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <label>
              Categoria
              <select
                className="lm-input"
                value={draft.category}
                onChange={(e) => patch({ category: e.target.value as ProductCategory })}
              >
                {(Object.keys(CATEGORY_LABEL) as ProductCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Preço de venda (R$)
              <input
                className="lm-input"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label>
              Ilustração
              <select
                className="lm-input"
                value={draft.kind}
                onChange={(e) => patch({ kind: e.target.value as FoodKind })}
              >
                {(Object.keys(FOOD_KIND_LABEL) as FoodKind[]).map((k) => (
                  <option key={k} value={k}>
                    {FOOD_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Foto (URL) — opcional
              <input
                className="lm-input"
                value={draft.image ?? ''}
                onChange={(e) => patch({ image: e.target.value.trim() || undefined })}
                placeholder="https://…"
              />
            </label>
            <label className="lm-check lm-span2">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => patch({ active: e.target.checked })}
              />
              Item ativo (aparece na vitrine do PDV)
            </label>
          </div>
        </div>

        <section className="lm-recipe">
          <header>
            <h3>Ficha técnica</h3>
            <span>Quanto de cada insumo sai do estoque a cada porção vendida</span>
          </header>
          {draft.recipe.length === 0 && (
            <p className="lm-empty">
              Sem ficha técnica: o item não baixa estoque e aparece como “sob demanda”.
            </p>
          )}
          <ul>
            {draft.recipe.map((line, i) => {
              const ing = ingredients.find((x) => x.id === line.ingredientId)
              return (
                <li key={i}>
                  <select
                    className="lm-input"
                    value={line.ingredientId}
                    onChange={(e) =>
                      setRecipe(
                        draft.recipe.map((r, j) =>
                          j === i ? { ...r, ingredientId: e.target.value } : r,
                        ),
                      )
                    }
                    aria-label="Insumo"
                  >
                    <option value="">Selecione…</option>
                    {ingredients.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} ({x.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    className="lm-input lm-input--small"
                    inputMode="decimal"
                    value={String(line.qty)}
                    onChange={(e) =>
                      setRecipe(
                        draft.recipe.map((r, j) =>
                          j === i ? { ...r, qty: parseNumber(e.target.value) } : r,
                        ),
                      )
                    }
                    aria-label="Quantidade por porção"
                  />
                  <span className="lm-recipe__unit">{ing?.unit ?? '—'}</span>
                  <span className="lm-recipe__cost">
                    {ing ? money(ing.avgCost * line.qty) : money(0)}
                  </span>
                  <button
                    type="button"
                    className="lm-btn lm-btn--ghost lm-btn--sm"
                    onClick={() => setRecipe(draft.recipe.filter((_, j) => j !== i))}
                  >
                    Remover
                  </button>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            className="lm-btn lm-btn--ghost lm-btn--sm"
            onClick={() => setRecipe([...draft.recipe, { ingredientId: '', qty: 0 }])}
          >
            + Adicionar insumo
          </button>
          <p className="lm-note">
            Custo da ficha: <strong>{money(cost)}</strong>
            {parseNumber(price) > 0 && (
              <>
                {' '}
                · margem{' '}
                <strong>
                  {Math.round(((parseNumber(price) - cost) / parseNumber(price)) * 100)}%
                </strong>
              </>
            )}
          </p>
          <p className="lm-note lm-note--muted">
            Exemplo: uma porção de batata usa <strong>0,5 kg</strong>. Com{' '}
            <strong>{fmtQty(5)} kg</strong> comprados, o estoque passa a ter{' '}
            <strong>10 porções</strong> para venda.
          </p>
        </section>

        {error && <p className="lm-alert">{error}</p>}
        <div className="lm-modal__actions">
          <button type="button" className="lm-btn lm-btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="lm-btn lm-btn--primary"
            onClick={() => {
              if (!draft.name.trim()) {
                setError('Informe o nome do produto.')
                return
              }
              if (parseNumber(price) <= 0) {
                setError('Informe um preço de venda maior que zero.')
                return
              }
              onSave({
                ...draft,
                name: draft.name.trim(),
                price: parseNumber(price),
                recipe: draft.recipe.filter((r) => r.ingredientId && r.qty > 0),
              })
            }}
          >
            Salvar produto
          </button>
        </div>
      </div>
    </div>
  )
}
