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
            <a className="footer__social--ig" href={COMPANY.social.instagram} target="_blank" rel="noreferrer noopener" aria-label="Instagram" title="Instagram">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.35 2.67.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.47 1.38 2.13.66.66 1.34 1.07 2.13 1.38.76.3 1.63.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0m0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84M12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4m6.41-10.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44"/>
              </svg>
            </a>
            <a className="footer__social--fb" href={COMPANY.social.facebook} target="_blank" rel="noreferrer noopener" aria-label="Facebook" title="Facebook">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.49 0-1.96.93-1.96 1.87v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07"/>
              </svg>
            </a>
            <a className="footer__social--yt" href={COMPANY.social.youtube} target="_blank" rel="noreferrer noopener" aria-label="YouTube" title="YouTube">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81M9.55 15.57V8.43L15.82 12z"/>
              </svg>
            </a>
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
