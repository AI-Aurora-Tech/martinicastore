import { COMPANY } from '../data/products'
import type { LegalSection } from './LegalPage'

export function Footer({ onLegal }: { onLegal: (section: LegalSection) => void }) {
  return (
    <footer className="footer">
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
            A loja oficial do Grêmio Recreativo Martinica, entrega para todo o
            Brasil e o carinho de quem também é da torcida.
          </p>
          <div className="footer__social">
            <a href={COMPANY.social.instagram} target="_blank" rel="noreferrer noopener" aria-label="Instagram" title="Instagram">📷</a>
            <a href={COMPANY.social.facebook} target="_blank" rel="noreferrer noopener" aria-label="Facebook" title="Facebook">👍</a>
            <a href={COMPANY.social.youtube} target="_blank" rel="noreferrer noopener" aria-label="YouTube" title="YouTube">▶</a>
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
          <button type="button" className="footer__link" onClick={() => onLegal('trocas')}>Trocas e devoluções</button> ·{' '}
          <a className="footer__link footer__staff" href="/gestao">Área da equipe</a>
        </p>
      </div>
    </footer>
  )
}
