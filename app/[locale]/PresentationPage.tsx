'use client'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function PresentationPage() {
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt()
  const t = useTranslations('Presentation')

  return (
    <main className="page">
      {/* HERO */}
      <section className="hero">
        <nav className="nav">
          <span className="brand">Cosmos</span>
          <div className="nav-actions">
            {isInstalled ? (
              <span className="install-badge">✓ {t('nav.installed')}</span>
            ) : isInstallable ? (
              <button onClick={promptInstall} className="install-btn">
                {t('nav.installApp')}
              </button>
            ) : null}
            <LanguageSwitcher />
            <Link href="/login" className="nav-link">{t('nav.login')}</Link>
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-text">
            <p className="eyebrow">{t('hero.eyebrow')}</p>
            <h1>
              {t('hero.titleLine1')}
              <br />
              <span className="italic">{t('hero.titleLine2')}</span>
            </h1>
            <p className="hero-sub">{t('hero.subtitle')}</p>
            <div className="hero-actions">
              <Link href="/login?mode=signup" className="btn-primary">
                {t('hero.joinCta')}
              </Link>
              <Link href="/login" className="btn-ghost">
                {t('hero.loginCta')}
              </Link>
            </div>
            <p className="age-notice">{t('hero.ageNotice')}</p>
          </div>

          <div className="hero-visual">
            <div className="halo" aria-hidden="true" />
            <Image
              src="/cosmosnumber.png"
              alt="Cosmos"
              width={420}
              height={420}
              className="hero-image"
              priority
            />
          </div>
        </div>
      </section>

      {/* VALEURS */}
      <section className="values">
        <p className="section-eyebrow">{t('values.eyebrow')}</p>
        <h2>{t('values.title')}</h2>

        <div className="values-grid">
          <div className="value-card">
            <h3>{t('values.card1.title')}</h3>
            <p>{t('values.card1.text')}</p>
          </div>
          <div className="value-card">
            <h3>{t('values.card2.title')}</h3>
            <p>{t('values.card2.text')}</p>
          </div>
          <div className="value-card">
            <h3>{t('values.card3.title')}</h3>
            <p>{t('values.card3.text')}</p>
          </div>
          <div className="value-card">
            <h3>{t('values.card4.title')}</h3>
            <p>{t('values.card4.text')}</p>
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="how">
        <p className="section-eyebrow">{t('how.eyebrow')}</p>
        <h2>{t('how.title')}</h2>

        <ol className="steps">
          <li>
            <span className="step-number">01</span>
            <div>
              <h3>{t('how.step1.title')}</h3>
              <p>{t('how.step1.text')}</p>
            </div>
          </li>
          <li>
            <span className="step-number">02</span>
            <div>
              <h3>{t('how.step2.title')}</h3>
              <p>{t('how.step2.text')}</p>
            </div>
          </li>
          <li>
            <span className="step-number">03</span>
            <div>
              <h3>{t('how.step3.title')}</h3>
              <p>{t('how.step3.text')}</p>
            </div>
          </li>
        </ol>
      </section>

      {/* CTA FINAL */}
      <section className="final-cta">
        <h2>
          {t('finalCta.titleLine1')}
          <br />
          <span className="italic">{t('finalCta.titleLine2')}</span>
        </h2>
        <Link href="/login?mode=signup" className="btn-primary large">
          {t('finalCta.cta')}
        </Link>
      </section>

      <footer className="footer">
        <span>Cosmos</span>
        <span>© {new Date().getFullYear()} — {t('footer.ageNotice')}</span>
      </footer>

      <style jsx>{`
        :global(body) {
          background: #0d1b4b;
        }

        .page {
          background: #0d1b4b;
          color: #f5efe0;
          font-family: 'Jost', -apple-system, sans-serif;
          overflow-x: hidden;
        }

        h1, h2, h3 {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 400;
          letter-spacing: 0.01em;
        }

        .italic {
          font-style: italic;
          color: #c9a84c;
        }

        /* NAV */
        .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 6vw 0;
        }
        .brand {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.6rem;
          letter-spacing: 0.15em;
          color: #c9a84c;
        }
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .nav-link {
          color: #f5efe0;
          text-decoration: none;
          font-size: 0.95rem;
          border: 1px solid #3a4784;
          padding: 8px 20px;
          border-radius: 999px;
          transition: border-color 0.2s ease, color 0.2s ease;
        }
        .nav-link:hover {
          border-color: #c9a84c;
          color: #c9a84c;
        }
        .install-btn {
          background: transparent;
          color: #c9a84c;
          border: 1px solid #c9a84c;
          padding: 8px 20px;
          border-radius: 999px;
          font-size: 0.95rem;
          font-family: 'Jost', sans-serif;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .install-btn:hover {
          background: #c9a84c;
          color: #0d1b4b;
        }
        .install-badge {
          font-size: 0.85rem;
          color: #8a93b8;
          border: 1px solid #3a4784;
          padding: 8px 16px;
          border-radius: 999px;
          white-space: nowrap;
        }

        /* HERO */
        .hero {
          padding-bottom: 80px;
        }
        .hero-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 40px;
          max-width: 1200px;
          margin: 0 auto;
          padding: 60px 6vw 20px;
          flex-wrap: wrap;
        }
        .hero-text {
          max-width: 560px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 0.78rem;
          color: #8a93b8;
          margin-bottom: 18px;
        }
        h1 {
          font-size: clamp(2.4rem, 5vw, 3.6rem);
          line-height: 1.15;
          margin: 0 0 24px;
          color: #f5efe0;
        }
        .hero-sub {
          font-size: 1.05rem;
          line-height: 1.7;
          color: #c3c8e0;
          margin-bottom: 34px;
        }
        .hero-actions {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .btn-primary {
          background: #c9a84c;
          color: #0d1b4b;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.98rem;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(201, 168, 76, 0.25);
        }
        .btn-primary.large {
          padding: 18px 44px;
          font-size: 1.05rem;
        }
        .btn-ghost {
          color: #f5efe0;
          text-decoration: none;
          padding: 14px 28px;
          border: 1px solid #3a4784;
          border-radius: 999px;
          font-size: 0.98rem;
          transition: border-color 0.2s ease;
        }
        .btn-ghost:hover {
          border-color: #c9a84c;
        }
        .age-notice {
          font-size: 0.82rem;
          color: #6b7399;
        }

        /* HERO VISUAL */
        .hero-visual {
          position: relative;
          flex: 1 1 320px;
          display: flex;
          justify-content: center;
          min-width: 280px;
        }
        .halo {
          position: absolute;
          width: 380px;
          height: 380px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(201, 168, 76, 0.35) 0%, rgba(201, 168, 76, 0) 70%);
          filter: blur(10px);
        }
        .hero-image {
          position: relative;
          border-radius: 50%;
          object-fit: cover;
          max-width: 100%;
          height: auto;
        }

        /* VALUES */
        .values {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 6vw 100px;
        }
        .section-eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 0.78rem;
          color: #8a93b8;
          margin-bottom: 12px;
        }
        .values h2, .how h2 {
          font-size: clamp(1.8rem, 3.5vw, 2.4rem);
          margin: 0 0 48px;
          max-width: 620px;
        }
        .values-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 28px;
        }
        .value-card {
          background: #12224f;
          border: 1px solid #1e2c5c;
          border-radius: 16px;
          padding: 32px 26px;
        }
        .value-card h3 {
          font-size: 1.3rem;
          color: #c9a84c;
          margin: 0 0 12px;
        }
        .value-card p {
          font-size: 0.95rem;
          line-height: 1.65;
          color: #b8bfdb;
          margin: 0;
        }

        /* HOW */
        .how {
          max-width: 900px;
          margin: 0 auto;
          padding: 40px 6vw 110px;
        }
        .steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 36px;
        }
        .steps li {
          display: flex;
          align-items: baseline;
          gap: 28px;
          border-bottom: 1px solid #1e2c5c;
          padding-bottom: 32px;
        }
        .steps li:last-child {
          border-bottom: none;
        }
        .step-number {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.2rem;
          color: #3a4784;
          min-width: 64px;
        }
        .steps h3 {
          font-size: 1.35rem;
          margin: 0 0 8px;
          color: #f5efe0;
        }
        .steps p {
          color: #b8bfdb;
          margin: 0;
          line-height: 1.6;
        }

        /* FINAL CTA */
        .final-cta {
          text-align: center;
          padding: 100px 6vw 120px;
          background: linear-gradient(180deg, #0d1b4b 0%, #12224f 100%);
        }
        .final-cta h2 {
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          margin: 0 0 40px;
          line-height: 1.3;
        }

        /* FOOTER */
        .footer {
          display: flex;
          justify-content: space-between;
          padding: 32px 6vw;
          border-top: 1px solid #1e2c5c;
          font-size: 0.82rem;
          color: #6b7399;
          flex-wrap: wrap;
          gap: 10px;
        }

        @media (max-width: 640px) {
          .hero-content {
            padding-top: 30px;
          }
          .hero-actions {
            flex-direction: column;
          }
          .btn-primary, .btn-ghost {
            text-align: center;
          }
          .steps li {
            gap: 18px;
          }
          .nav-actions {
            gap: 8px;
          }
          .install-btn, .install-badge {
            padding: 6px 12px;
            font-size: 0.82rem;
          }
        }
      `}</style>
    </main>
  )
}
