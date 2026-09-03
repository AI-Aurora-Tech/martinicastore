import { money, dateTime } from '../format'
import { CHANNEL_LABEL, PAYMENT_LABEL, type Order } from '../types'

/**
 * Comprovante não fiscal do pedido. Fica escondido na tela e só aparece na
 * impressão (ver `.lm-print` em lanchonete.css).
 */
export function Receipt({ order }: { order: Order }) {
  return (
    <div className="lm-print" aria-hidden="true">
      <div className="lm-print__head">
        <strong>LANCHONETE MARTINICA</strong>
        <span>Comprovante não fiscal</span>
      </div>
      <div className="lm-print__meta">
        <div>
          <span>Pedido</span>
          <strong>#{String(order.number).padStart(4, '0')}</strong>
        </div>
        <div>
          <span>Data</span>
          <strong>{dateTime(order.createdAt)}</strong>
        </div>
        <div>
          <span>Atendimento</span>
          <strong>
            {order.channel === 'mesa' && order.table
              ? `Mesa ${order.table}`
              : CHANNEL_LABEL[order.channel]}
          </strong>
        </div>
        {order.customer && (
          <div>
            <span>Cliente</span>
            <strong>{order.customer}</strong>
          </div>
        )}
        <div>
          <span>Operador</span>
          <strong>{order.operator}</strong>
        </div>
      </div>

      <table className="lm-print__items">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qtd</th>
            <th>Unit.</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={`${item.productId}-${i}`}>
              <td>
                {item.name}
                {item.notes ? <em> ({item.notes})</em> : null}
              </td>
              <td>{item.qty}</td>
              <td>{money(item.unitPrice)}</td>
              <td>{money(item.unitPrice * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="lm-print__totals">
        <div>
          <span>Subtotal</span>
          <span>{money(order.subtotal)}</span>
        </div>
        {order.discount > 0 && (
          <div>
            <span>Desconto</span>
            <span>- {money(order.discount)}</span>
          </div>
        )}
        <div className="lm-print__grand">
          <span>TOTAL</span>
          <span>{money(order.total)}</span>
        </div>
        <div>
          <span>Pagamento</span>
          <span>{PAYMENT_LABEL[order.payment]}</span>
        </div>
        {order.payment === 'dinheiro' && order.cashReceived != null && (
          <>
            <div>
              <span>Recebido</span>
              <span>{money(order.cashReceived)}</span>
            </div>
            <div>
              <span>Troco</span>
              <span>{money(order.change ?? 0)}</span>
            </div>
          </>
        )}
      </div>

      <p className="lm-print__foot">
        Pedido enviado para a cozinha. Obrigado pela preferência!
        <br />
        Documento sem valor fiscal.
      </p>
    </div>
  )
}

/**
 * Dispara a impressão do comprovante já montado na página.
 * O `setTimeout` dá um respiro para o React pintar o DOM antes do diálogo.
 */
export function printReceipt() {
  window.setTimeout(() => window.print(), 60)
}
