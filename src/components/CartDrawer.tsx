import { useCart } from '../context/CartContext'
import { BRL } from '../data/products'
import { ProductImage } from './ProductImage'

interface Props {
  /** Abre a tela de checkout (identificação + entrega + pagamento). */
  onCheckout: () => void
}

export function CartDrawer({ onCheckout }: Props) {
  const { items, isOpen, closeCart, removeItem, setQuantity, subtotal, count } = useCart()

  function goCheckout() {
    closeCart()
    onCheckout()
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

        {items.length === 0 ? (
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
              <p className="drawer__pix">Frete calculado no checkout pelo seu CEP.</p>
              <button className="btn btn--primary btn--block" onClick={goCheckout}>
                Finalizar compra
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
