import { useState } from 'react'
import { useCart } from '../context/CartContext'
import { useCatalog } from '../context/CatalogContext'
import { BRL } from '../data/products'
import { ProductImage } from './ProductImage'
import { createOrder } from '../services/orders'

const FREE_SHIPPING = 299

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, setQuantity, subtotal, count, clear } =
    useCart()
  const { decrementStockLocal } = useCatalog()
  const [done, setDone] = useState(false)
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [placing, setPlacing] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  const missing = Math.max(0, FREE_SHIPPING - subtotal)
  const progress = Math.min(100, (subtotal / FREE_SHIPPING) * 100)
  const shipping = subtotal >= FREE_SHIPPING || subtotal === 0 ? 0 : 29.9

  async function checkout() {
    if (placing) return
    setPlacing(true)
    setOrderError(null)

    const { number, error } = await createOrder({
      subtotal,
      discount: 0,
      shipping,
      total: subtotal + shipping,
      payment: 'pix',
      items,
    })

    setPlacing(false)

    if (error) {
      setOrderError(error)
      return
    }

    decrementStockLocal(
      items.map((i) => ({ id: i.product.id, quantity: i.quantity })),
    )
    setOrderNumber(number)
    setDone(true)
    clear()
  }

  return (
    <>
      <div
        className={`overlay ${isOpen ? 'overlay--show' : ''}`}
        onClick={closeCart}
        aria-hidden={!isOpen}
      />
      <aside
        className={`drawer ${isOpen ? 'drawer--open' : ''}`}
        aria-label="Sacola de compras"
        aria-hidden={!isOpen}
      >
        <header className="drawer__head">
          <h2>Minha sacola {count > 0 && <span>({count})</span>}</h2>
          <button className="drawer__close" onClick={closeCart} aria-label="Fechar sacola">
            ✕
          </button>
        </header>

        {done ? (
          <div className="drawer__empty">
            <span className="drawer__empty-icon">🎉</span>
            <h3>Pedido confirmado!</h3>
            {orderNumber != null && (
              <p className="drawer__ordernum">
                Pedido nº <strong>{String(orderNumber).padStart(6, '0')}</strong>
              </p>
            )}
            <p>
              Obrigado por torcer com a gente. Você receberá o código de
              rastreio por e-mail em instantes.
            </p>
            <button
              className="btn btn--primary"
              onClick={() => {
                setDone(false)
                setOrderNumber(null)
                closeCart()
              }}
            >
              Continuar comprando
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="drawer__empty">
            <span className="drawer__empty-icon">🛍️</span>
            <h3>Sua sacola está vazia</h3>
            <p>Que tal levar a nova camisa oficial para casa?</p>
            <button className="btn btn--primary" onClick={closeCart}>
              Ver produtos
            </button>
          </div>
        ) : (
          <>
            <div className="drawer__shipping">
              {missing > 0 ? (
                <p>
                  Faltam <strong>{BRL.format(missing)}</strong> para o{' '}
                  <strong>frete grátis</strong>!
                </p>
              ) : (
                <p>🎉 Você ganhou <strong>frete grátis</strong>!</p>
              )}
              <div className="drawer__bar">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>

            <ul className="drawer__list">
              {items.map((item) => {
                const key = `${item.product.id}-${item.size ?? ''}`
                return (
                  <li key={key} className="drawer__item">
                    <div
                      className="drawer__thumb"
                      style={{ background: `${item.product.colors[0]}14` }}
                    >
                      <ProductImage
                        kind={item.product.kind}
                        colors={item.product.colors}
                        image={item.product.image}
                        alt={item.product.name}
                      />
                    </div>
                    <div className="drawer__info">
                      <p className="drawer__item-name">{item.product.name}</p>
                      {item.size && <span className="drawer__size">Tam: {item.size}</span>}
                      <div className="drawer__qty">
                        <button
                          onClick={() =>
                            setQuantity(item.product.id, item.size, item.quantity - 1)
                          }
                          aria-label="Diminuir quantidade"
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() =>
                            setQuantity(item.product.id, item.size, item.quantity + 1)
                          }
                          aria-label="Aumentar quantidade"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="drawer__right">
                      <strong>{BRL.format(item.product.price * item.quantity)}</strong>
                      <button
                        className="drawer__remove"
                        onClick={() => removeItem(item.product.id, item.size)}
                        aria-label={`Remover ${item.product.name}`}
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            <footer className="drawer__foot">
              <div className="drawer__total">
                <span>Subtotal</span>
                <strong>{BRL.format(subtotal)}</strong>
              </div>
              <p className="drawer__pix">
                ou {BRL.format(subtotal * 0.95)} à vista no Pix (5% off)
              </p>
              {orderError && (
                <p className="drawer__ordererror" role="alert">
                  ⚠️ {orderError}
                </p>
              )}
              <button
                className="btn btn--primary btn--block"
                onClick={checkout}
                disabled={placing}
              >
                {placing ? 'Processando…' : 'Finalizar compra'}
              </button>
              <button className="drawer__continue" onClick={closeCart}>
                Continuar comprando
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
