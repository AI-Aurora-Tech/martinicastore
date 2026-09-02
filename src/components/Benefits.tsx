const items = [
  { icon: '🚚', title: 'Entrega para todo o Brasil', text: 'Enviamos via Correios (PAC e SEDEX)' },
  { icon: '🔄', title: 'Troca fácil', text: '30 dias para trocar direto pelo app' },
  { icon: '🛡️', title: 'Compra segura', text: 'Site oficial com selo de segurança' },
]

export function Benefits() {
  return (
    <section className="benefits" aria-label="Vantagens">
      {items.map((i) => (
        <div key={i.title} className="benefits__item">
          <span className="benefits__icon" aria-hidden="true">{i.icon}</span>
          <div>
            <strong>{i.title}</strong>
            <p>{i.text}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
