import { useState } from 'react'
import type { Product } from '../types'
import { BRL } from '../data/products'
import { useCart } from '../context/CartContext'
import { hasVariants, variantStock } from '../services/variants'
import { ProductImage } from './ProductImage'
import { StarRating } from './StarRating'

interface Props {
  product: Product
  onOpen?: (product: Product) => void
}

export function ProductCard({ product, onOpen }: Props) {
  const { addItem } = useCart()
  const variantMode = hasVariants(product)
  const options = variantMode ? product.variants!.map((v) => v.label) : (product.sizes ?? [])
  const firstInStock = variantMode
    ? product.variants!.find((v) => v.stock > 0)?.label
    : options[0]
  const [size, setSize] = useState<string | undefined>(firstInStock ?? options[0])
  const [added, setAdded] = useState(false)

  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0

  const soldOut = product.stock != null && product.stock <= 0
  const chosenOut = variantMode && !!size && variantStock(product, size) <= 0
  const lowStock =
    product.stock != null && product.stock > 0 && product.stock <= 5

  function handleAdd() {
    if (soldOut || chosenOut) return
    if (options.length && !size) return
    addItem(product, size)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1200)
  }

  return (
    <article className={`card ${soldOut ? 'card--out' : ''}`}>
      <button
        type="button"
        className="card__media card__media--btn"
        style={{ background: `${product.colors[0]}14` }}
        onClick={() => onOpen?.(product)}
        aria-label={`Ver detalhes de ${product.name}`}
      >
        {product.badge && !soldOut && <span className="card__badge">{product.badge}</span>}
        {discount > 0 && !soldOut && <span className="card__discount">-{discount}%</span>}
        {soldOut && <span className="card__soldout">Esgotado</span>}
        <ProductImage
          kind={product.kind}
          colors={product.colors}
          image={product.image}
          alt={product.name}
          className="card__img"
        />
      </button>

      <div className="card__body">
        <h3 className="card__name">
          <button type="button" className="card__name-btn" onClick={() => onOpen?.(product)}>
            {product.name}
          </button>
        </h3>
        <StarRating rating={product.rating} reviews={product.reviews} />

        <div className="card__prices">
          {product.oldPrice && (
            <span className="card__old">{BRL.format(product.oldPrice)}</span>
          )}
          <span className="card__price">{BRL.format(product.price)}</span>
        </div>
        {lowStock && (
          <p className="card__lowstock">🔥 Últimas {product.stock} unidades!</p>
        )}

        {options.length > 0 && (
          <div className="card__sizes" role="group" aria-label="Escolha a variação">
            {options.map((s) => {
              const out = variantMode && variantStock(product, s) <= 0
              return (
                <button
                  key={s}
                  type="button"
                  className={`chip ${size === s ? 'chip--active' : ''} ${out ? 'chip--out' : ''}`}
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  disabled={out}
                  title={out ? 'Esgotado' : undefined}
                >
                  {s}
                </button>
              )
            })}
          </div>
        )}

        <button
          type="button"
          className={`btn btn--primary card__add ${added ? 'card__add--done' : ''}`}
          onClick={handleAdd}
          disabled={soldOut || chosenOut}
        >
          {soldOut ? 'Esgotado' : chosenOut ? 'Variação esgotada' : added ? '✓ Adicionado' : 'Adicionar à sacola'}
        </button>
      </div>
    </article>
  )
}
