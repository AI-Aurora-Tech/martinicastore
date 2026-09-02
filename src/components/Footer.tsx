import { CLUB, COMPANY } from '../data/products'
import type { LegalSection } from './LegalPage'

export function Footer({ onLegal }: { onLegal: (section: LegalSection) => void }) {
  return (
    <footer className="footer">
      <div className="footer__newsletter">
        <div>
          <h3>Entre para o time do desconto</h3>
          <p>Cadastre seu e-mail e ganhe 10% OFF na primeira compra.</p>
        </div>
        <form className="footer__form" onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="seu@email.com" aria-label="Seu e-mail" required />
          <button className="btn btn--primary" type="submit">
            Quero meu cupom
          </button>
        </form>
      </div>

      <div className="footer__cols">
        <div className="footer__col footer__col--brand">
          <div className="brand brand--footer">
            <span className="brand__mark" aria-hidden="true">M</span>
            <span className="brand__text">
              <strong>MARTINICA</strong>
              <small>STORE OFICIAL</small>
            </span>
          </div>
          <p>
            A loja oficial do {CLUB.name}. Produtos licenciados, entrega para
            todo o Brasil e o carinho de quem também é da torcida.
          </p>
          <div className="footer__social">
            <a href="#" aria-label="Instagram">📷</a>
            <a href="#" aria-label="Facebook">👍</a>
            <a href="#" aria-label="X / Twitter">✖</a>
            <a href="#" aria-label="YouTube">▶</a>
          </div>
        </div>

        <div className="footer__col">
          <h4>Institucional</h4>
          <ul>
            <li><button type="button" className="footer__link" onClick={() => onLegal('empresa')}>Quem somos</button></li>
            <li><button type="button" className="footer__link" onClick={() => onLegal('termos')}>Termos de uso</button></li>
            <li><button type="button" className="footer__link" onClick={() => onLegal('privacidade')}>Política de privacidade</button></li>
          </ul>
        </div>

        <div className="footer__col">
          <h4>Ajuda &amp; Atendimento</h4>
          <ul>
            <li><button type="button" className="footer__link" onClick={() => onLegal('trocas')}>Trocas e devoluções</button></li>
            <li><button type="button" className="footer__link" onClick={() => onLegal('entrega')}>Prazos de entrega</button></li>
            <li>
              <a href={`https://wa.me/${COMPANY.whatsapp}`} target="_blank" rel="noreferrer">
                Fale com o SAC (WhatsApp)
              </a>
            </li>
            <li><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></li>
          </ul>
        </div>

        <div className="footer__col">
          <h4>Pague com</h4>
          <div className="footer__pay">
            <span>Pix</span>
            <span>Visa</span>
            <span>Master</span>
            <span>Elo</span>
            <span>Boleto</span>
          </div>
          <h4 className="footer__seal-title">Segurança</h4>
          <div className="footer__pay">
            <span>🔒 SSL</span>
            <span>✓ Site Oficial</span>
          </div>
        </div>
      </div>

      <div className="footer__legal">
        <p>
          © {new Date().getFullYear()} {COMPANY.legalName} — CNPJ {COMPANY.cnpj}.
          Todos os direitos reservados. Este é um projeto de demonstração inspirado
          em lojas oficiais de clubes.
        </p>
        <p>
          <button type="button" className="footer__link" onClick={() => onLegal('privacidade')}>Política de privacidade</button> ·{' '}
          <button type="button" className="footer__link" onClick={() => onLegal('termos')}>Termos de uso</button> ·{' '}
          <button type="button" className="footer__link" onClick={() => onLegal('trocas')}>Trocas e devoluções</button>
        </p>
      </div>
    </footer>
  )
}
