import { useState } from 'react'
import { CLUB, COMPANY } from '../data/products'

export type LegalSection = 'trocas' | 'privacidade' | 'termos' | 'entrega' | 'empresa'

const TABS: { id: LegalSection; label: string }[] = [
  { id: 'trocas', label: 'Trocas e Devoluções' },
  { id: 'entrega', label: 'Entrega e Frete' },
  { id: 'privacidade', label: 'Privacidade (LGPD)' },
  { id: 'termos', label: 'Termos de Uso' },
  { id: 'empresa', label: 'Quem Somos' },
]

const addr = COMPANY.address
const fullAddress =
  `${addr.street}, ${addr.number}${addr.complement ? ` – ${addr.complement}` : ''} – ` +
  `${addr.neighborhood}, ${addr.city}-${addr.uf}, CEP ${addr.cep}`

export function LegalPage({
  initial = 'trocas',
  onExit,
}: {
  initial?: LegalSection
  onExit: () => void
}) {
  const [tab, setTab] = useState<LegalSection>(initial)

  return (
    <div className="legal">
      <header className="legal__top">
        <button className="legal__back" onClick={onExit} aria-label="Voltar à loja">
          ← Voltar à loja
        </button>
        <div className="brand brand--footer">
          <span className="brand__mark" aria-hidden="true">M</span>
          <span className="brand__text">
            <strong>MARTINICA</strong>
            <small>STORE OFICIAL</small>
          </span>
        </div>
      </header>

      <nav className="legal__tabs" aria-label="Páginas institucionais">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`legal__tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <article className="legal__content">
        {tab === 'trocas' && (
          <section>
            <h1>Trocas e Devoluções</h1>
            <p>
              Queremos que você fique 100% satisfeito com a sua compra na{' '}
              {COMPANY.tradeName}. Por isso seguimos o Código de Defesa do
              Consumidor (CDC).
            </p>
            <h2>Direito de arrependimento (compra online)</h2>
            <p>
              Nas compras feitas pela internet, você pode desistir da compra em
              até <strong>7 (sete) dias corridos</strong> a partir do recebimento
              do produto (CDC, art. 49), sem necessidade de justificativa. Nesse
              caso, devolvemos o valor pago, incluindo o frete.
            </p>
            <h2>Troca por defeito</h2>
            <p>
              Produtos com defeito de fabricação podem ser trocados em até{' '}
              <strong>30 dias</strong> (produtos não duráveis) ou{' '}
              <strong>90 dias</strong> (produtos duráveis), conforme o art. 26 do
              CDC.
            </p>
            <h2>Troca por tamanho ou modelo</h2>
            <p>
              Aceitamos a primeira troca por tamanho/modelo em até{' '}
              <strong>30 dias</strong>, desde que o produto esteja sem uso, com a
              etiqueta e na embalagem original.
            </p>
            <h2>Como solicitar</h2>
            <p>
              Fale com nosso SAC pelo WhatsApp{' '}
              <a href={`https://wa.me/${COMPANY.whatsapp}`} target="_blank" rel="noreferrer">
                {COMPANY.whatsappLabel}
              </a>{' '}
              ou pelo e-mail{' '}
              <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> informando o
              número do pedido. Após a aprovação, enviaremos as instruções de
              postagem.
            </p>
          </section>
        )}

        {tab === 'entrega' && (
          <section>
            <h1>Entrega e Frete</h1>
            <p>
              Entregamos para todo o Brasil via Correios (PAC e SEDEX). O valor e o
              prazo são calculados no carrinho, a partir do seu CEP e do peso dos
              produtos.
            </p>
            <h2>Prazos</h2>
            <ul>
              <li>O prazo começa a contar após a confirmação do pagamento.</li>
              <li>
                O prazo estimado de cada modalidade (PAC/SEDEX) é exibido antes de
                você finalizar a compra.
              </li>
              <li>
                Pedidos com pagamento por Pix ou cartão aprovado costumam ser
                despachados em até 2 dias úteis.
              </li>
            </ul>
            <h2>Frete grátis</h2>
            <p>
              Compras acima de <strong>R$ 299,00</strong> têm frete PAC grátis para
              todo o Brasil.
            </p>
            <h2>Acompanhamento</h2>
            <p>
              Assim que o pedido for enviado, você recebe o código de rastreio pelo
              WhatsApp cadastrado.
            </p>
          </section>
        )}

        {tab === 'privacidade' && (
          <section>
            <h1>Política de Privacidade (LGPD)</h1>
            <p>
              A {COMPANY.legalName} respeita a sua privacidade e trata seus dados de
              acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 –
              LGPD).
            </p>
            <h2>Quais dados coletamos</h2>
            <ul>
              <li>Cadastro: nome, e-mail e telefone/WhatsApp.</li>
              <li>Entrega: endereço e CEP.</li>
              <li>Pedido: itens, valores e histórico de compras.</li>
            </ul>
            <h2>Para que usamos</h2>
            <ul>
              <li>Processar e entregar seus pedidos.</li>
              <li>Enviar avisos do pedido (confirmação, pagamento e envio) por WhatsApp.</li>
              <li>Prestar atendimento e cumprir obrigações legais e fiscais.</li>
            </ul>
            <h2>Pagamentos</h2>
            <p>
              Os pagamentos são processados pelo <strong>Mercado Pago</strong>. Não
              armazenamos os dados do seu cartão em nossos servidores.
            </p>
            <h2>Seus direitos</h2>
            <p>
              Você pode solicitar acesso, correção ou exclusão dos seus dados a
              qualquer momento pelo e-mail{' '}
              <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
            </p>
          </section>
        )}

        {tab === 'termos' && (
          <section>
            <h1>Termos de Uso</h1>
            <p>
              Ao utilizar a loja {COMPANY.tradeName}, você concorda com os termos
              abaixo.
            </p>
            <h2>Produtos e preços</h2>
            <p>
              As imagens são ilustrativas. Preços e disponibilidade de estoque podem
              mudar sem aviso prévio. O preço válido é o exibido no momento da
              finalização do pedido.
            </p>
            <h2>Pedidos e pagamento</h2>
            <p>
              O pedido só é confirmado após a aprovação do pagamento. Reservamo-nos o
              direito de cancelar pedidos com suspeita de fraude ou erro de preço.
            </p>
            <h2>Propriedade intelectual</h2>
            <p>
              As marcas, textos e imagens deste site são protegidos. É vedada a
              reprodução sem autorização.
            </p>
            <p className="legal__note">
              Este site é um projeto de demonstração inspirado em lojas oficiais de
              clubes de futebol. {CLUB.name} é um clube fictício.
            </p>
          </section>
        )}

        {tab === 'empresa' && (
          <section>
            <h1>Quem Somos</h1>
            <p>
              A {COMPANY.tradeName} é a loja oficial do {CLUB.name}, com produtos
              licenciados e entrega para todo o Brasil.
            </p>
            <h2>Dados da empresa</h2>
            <ul className="legal__company">
              <li><strong>Razão social:</strong> {COMPANY.legalName}</li>
              <li><strong>Nome fantasia:</strong> {COMPANY.tradeName}</li>
              <li><strong>CNPJ:</strong> {COMPANY.cnpj}</li>
              <li><strong>Inscrição estadual:</strong> {COMPANY.stateRegistration}</li>
              <li><strong>Endereço:</strong> {fullAddress}</li>
            </ul>
            <h2>Atendimento (SAC)</h2>
            <ul className="legal__company">
              <li>
                <strong>WhatsApp:</strong>{' '}
                <a href={`https://wa.me/${COMPANY.whatsapp}`} target="_blank" rel="noreferrer">
                  {COMPANY.whatsappLabel}
                </a>
              </li>
              <li>
                <strong>E-mail:</strong>{' '}
                <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              </li>
              <li><strong>Horário:</strong> {COMPANY.hours}</li>
            </ul>
          </section>
        )}
      </article>
    </div>
  )
}
