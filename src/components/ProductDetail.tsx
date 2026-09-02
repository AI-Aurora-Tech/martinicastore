import { useState } from 'react'
import type { Product } from '../types'
import { BRL } from '../data/products'
import { useCart } from '../context/CartContext'
import { useCatalog } from '../context/CatalogContext'
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
  const [size, setSize] = useState<string | undefined>(product.sizes?.[0])
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0
  const installment = product.price / 10
  const soldOut = product.stock != null && product.stock <= 0
  const lowStock = product.stock != null && product.stock > 0 && product.stock <= 5
  const needsSize = !!product.sizes?.length
  const categoryLabel = categories.find((c) => c.id === product.category)?.label ?? product.category

  function add(goToCheckout: boolean) {
    if (soldOut) return
    if (needsSize && !size) return
    for (let i = 0; i < qty; i++) addItem(product, size)
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
          <p className="pdp__installment">ou 10x de {BRL.format(installment)} sem juros</p>

          {soldOut ? (
            <p className="pdp__stock pdp__stock--out">Produto esgotado no momento.</p>
          ) : lowStock ? (
            <p className="pdp__stock pdp__stock--low">🔥 Últimas {product.stock} unidades!</p>
          ) : null}

          {needsSize && (
            <div className="pdp__block">
              <span className="pdp__label">Tamanho{size ? `: ${size}` : ''}</span>
              <div className="pdp__sizes" role="group" aria-label="Escolha o tamanho">
                {product.sizes!.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`chip ${size === s ? 'chip--active' : ''}`}
                    onClick={() => setSize(s)}
                    aria-pressed={size === s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pdp__block">
            <span className="pdp__label">Quantidade</span>
            <div className="pdp__qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} aria-label="Aumentar">+</button>
            </div>
          </div>

          <div className="pdp__actions">
            <button
              className={`btn btn--primary pdp__add ${added ? 'card__add--done' : ''}`}
              onClick={() => add(false)}
              disabled={soldOut || (needsSize && !size)}
            >
              {soldOut ? 'Esgotado' : added ? '✓ Adicionado' : 'Adicionar à sacola'}
            </button>
            <button
              className="btn btn--dark pdp__buy"
              onClick={() => add(true)}
              disabled={soldOut || (needsSize && !size)}
            >
              Comprar agora
            </button>
          </div>
          {needsSize && !size && <p className="pdp__hint">Selecione um tamanho para continuar.</p>}

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
              {product.sizes?.length ? <div><dt>Tamanhos</dt><dd>{product.sizes.join(', ')}</dd></div> : null}
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
