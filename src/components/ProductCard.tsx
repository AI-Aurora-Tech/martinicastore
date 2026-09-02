import { useState } from 'react'
import type { Product } from '../types'
import { BRL } from '../data/products'
import { useCart } from '../context/CartContext'
import { ProductImage } from './ProductImage'
import { StarRating } from './StarRating'

interface Props {
  product: Product
  onOpen?: (product: Product) => void
}

export function ProductCard({ product, onOpen }: Props) {
  const { addItem } = useCart()
  const [size, setSize] = useState<string | undefined>(product.sizes?.[0])
  const [added, setAdded] = useState(false)

  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0

  const installment = product.price / 10
  const soldOut = product.stock != null && product.stock <= 0
  const lowStock =
    product.stock != null && product.stock > 0 && product.stock <= 5

  function handleAdd() {
    if (soldOut) return
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
        <p className="card__installment">
          ou 10x de {BRL.format(installment)} sem juros
        </p>
        {lowStock && (
          <p className="card__lowstock">🔥 Últimas {product.stock} unidades!</p>
        )}

        {product.sizes && (
          <div className="card__sizes" role="group" aria-label="Escolha o tamanho">
            {product.sizes.map((s) => (
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
        )}

        <button
          type="button"
          className={`btn btn--primary card__add ${added ? 'card__add--done' : ''}`}
          onClick={handleAdd}
          disabled={soldOut}
        >
          {soldOut ? 'Esgotado' : added ? '✓ Adicionado' : 'Adicionar à sacola'}
        </button>
      </div>
    </article>
  )
}
