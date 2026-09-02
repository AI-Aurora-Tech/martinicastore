import { useState } from 'react'
import type { Product } from '../types'
import { BRL } from '../data/products'
import { useCart } from '../context/CartContext'
import { useCatalog } from '../context/CatalogContext'
import { availableFor, hasVariants, variantStock } from '../services/variants'
import { ProductImage } from './ProductImage'
import { StarRating } from './StarRating'

interface Props {
  product: Product
  onExit: () => void
  onGoCheckout: () => void
}

/** Página de detalhes do produto. As informações vêm do cadastro no painel. */
export function ProductDetail({ product, onExit, onGoCheckout }: Props) {
  const { addItem } = useCart()
  const { categories } = useCatalog()

  const variantMode = hasVariants(product)
  // Opções selecionáveis: variações (com estoque) ou tamanhos simples.
  const options = variantMode ? product.variants!.map((v) => v.label) : (product.sizes ?? [])
  const needsChoice = options.length > 0
  const firstInStock = variantMode
    ? product.variants!.find((v) => v.stock > 0)?.label
    : options[0]
  const [size, setSize] = useState<string | undefined>(firstInStock ?? options[0])
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0
  const soldOut = product.stock != null && product.stock <= 0
  // Estoque da opção escolhida (variação) — ou do produto quando não há variação.
  const chosenStock = availableFor(product, size)
  const chosenOut = needsChoice && variantMode ? chosenStock <= 0 : soldOut
  const lowStock = !chosenOut && chosenStock > 0 && chosenStock <= 5
  const maxQty = variantMode && size ? Math.max(1, chosenStock) : Infinity
  const categoryLabel = categories.find((c) => c.id === product.category)?.label ?? product.category

  function add(goToCheckout: boolean) {
    if (soldOut || chosenOut) return
    if (needsChoice && !size) return
    const n = variantMode ? Math.min(qty, chosenStock) : qty
    for (let i = 0; i < n; i++) addItem(product, size)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1400)
    if (goToCheckout) onGoCheckout()
  }

  return (
    <div className="pdp">
      <header className="pdp__top">
        <button className="pdp__back" onClick={onExit}>← Voltar à loja</button>
      </header>

      <div className="pdp__body">
        <div className="pdp__media" style={{ background: `${product.colors[0]}14` }}>
          {product.badge && !soldOut && <span className="card__badge">{product.badge}</span>}
          {discount > 0 && !soldOut && <span className="card__discount">-{discount}%</span>}
          {soldOut && <span className="card__soldout">Esgotado</span>}
          <ProductImage
            kind={product.kind}
            colors={product.colors}
            image={product.image}
            alt={product.name}
            className="pdp__img"
          />
        </div>

        <div className="pdp__info">
          <span className="pdp__cat">{categoryLabel}</span>
          <h1 className="pdp__name">{product.name}</h1>
          <StarRating rating={product.rating} reviews={product.reviews} />

          <div className="pdp__prices">
            {product.oldPrice && <span className="pdp__old">{BRL.format(product.oldPrice)}</span>}
            <span className="pdp__price">{BRL.format(product.price)}</span>
            {discount > 0 && <span className="pdp__off">-{discount}%</span>}
          </div>
          <p className="pdp__installment">à vista no Pix ou cartão de crédito</p>

          {soldOut ? (
            <p className="pdp__stock pdp__stock--out">Produto esgotado no momento.</p>
          ) : chosenOut ? (
            <p className="pdp__stock pdp__stock--out">Variação esgotada. Escolha outra opção.</p>
          ) : lowStock ? (
            <p className="pdp__stock pdp__stock--low">🔥 Últimas {chosenStock} unidades!</p>
          ) : null}

          {needsChoice && (
            <div className="pdp__block">
              <span className="pdp__label">
                {variantMode ? 'Variação' : 'Tamanho'}{size ? `: ${size}` : ''}
              </span>
              <div className="pdp__sizes" role="group" aria-label="Escolha a variação">
                {options.map((s) => {
                  const out = variantMode && variantStock(product, s) <= 0
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${size === s ? 'chip--active' : ''} ${out ? 'chip--out' : ''}`}
                      onClick={() => { setSize(s); setQty(1) }}
                      aria-pressed={size === s}
                      disabled={out}
                      title={out ? 'Esgotado' : undefined}
                    >
                      {s}{out ? ' (esgotado)' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="pdp__block">
            <span className="pdp__label">Quantidade</span>
            <div className="pdp__qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Aumentar">+</button>
            </div>
          </div>

          <div className="pdp__actions">
            <button
              className={`btn btn--primary pdp__add ${added ? 'card__add--done' : ''}`}
              onClick={() => add(false)}
              disabled={soldOut || chosenOut || (needsChoice && !size)}
            >
              {soldOut || chosenOut ? 'Esgotado' : added ? '✓ Adicionado' : 'Adicionar à sacola'}
            </button>
            <button
              className="btn btn--dark pdp__buy"
              onClick={() => add(true)}
              disabled={soldOut || chosenOut || (needsChoice && !size)}
            >
              Comprar agora
            </button>
          </div>
          {needsChoice && !size && <p className="pdp__hint">Selecione uma opção para continuar.</p>}

          {product.description && (
            <div className="pdp__desc">
              <h2>Descrição</h2>
              <p>{product.description}</p>
            </div>
          )}

          <div className="pdp__specs">
            <h2>Ficha técnica</h2>
            <dl>
              <div><dt>Categoria</dt><dd>{categoryLabel}</dd></div>
              <div><dt>Código</dt><dd>{product.id}</dd></div>
              {variantMode ? (
                <div><dt>Variações</dt><dd>{product.variants!.map((v) => v.label).join(', ')}</dd></div>
              ) : product.sizes?.length ? (
                <div><dt>Tamanhos</dt><dd>{product.sizes.join(', ')}</dd></div>
              ) : null}
              {product.weight ? <div><dt>Peso</dt><dd>{(product.weight / 1000).toFixed(2)} kg</dd></div> : null}
            </dl>
          </div>
        </div>
      </div>

      {onGoCheckout && added && (
        <div className="pdp__toast" role="status">
          Produto adicionado à sacola.{' '}
          <button className="pdp__toast-link" onClick={onGoCheckout}>Finalizar compra →</button>
        </div>
      )}
    </div>
  )
}
