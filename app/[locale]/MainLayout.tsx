'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname, Link } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('MainLayout')
  const [ready, setReady] = useState(false)

  const NAV = [
    {
      href: '/feed',
      label: t('nav.discover'),
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? '#C9A84C' : 'none'} stroke={active ? '#C9A84C' : 'rgba(255,255,255,0.4)'} strokeWidth="1.5">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ),
    },
    {
      href: '/messages',
      label: t('nav.messages'),
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? '#C9A84C' : 'none'} stroke={active ? '#C9A84C' : 'rgba(255,255,255,0.4)'} strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      href: '/profile',
      label: t('nav.profile'),
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? '#C9A84C' : 'none'} stroke={active ? '#C9A84C' : 'rgba(255,255,255,0.4)'} strokeWidth="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setReady(true)
      }
    })
  }, [router])

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0D1B4B' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', fontWeight: 300, color: '#C9A84C', margin: 0, letterSpacing: '0.1em' }}>
            {t('brand')}
          </p>
          <div style={{ width: '40px', height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: '480px', margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
      {/* Page content
          minHeight: 0 est indispensable ici : dans un flex-column, un enfant
          (FeedPage, MessagesPage, etc.) peut sinon forcer <main> à dépasser
          l'espace réellement disponible (100dvh - hauteur de la nav du bas),
          ce qui pousse la nav hors écran ou fait déborder le contenu par-dessus. */}
      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>

      {/* Bottom navigation */}
      <nav style={{
        flexShrink: 0,
        background: 'rgba(10,20,55,0.97)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '0.6rem 0 calc(0.6rem + env(safe-area-inset-bottom, 0px))',
        zIndex: 50,
      }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.25rem 1.5rem',
                textDecoration: 'none',
              }}
            >
              {icon(active)}
              <span style={{
                fontSize: '0.6rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: active ? '#C9A84C' : 'rgba(255,255,255,0.3)',
                transition: 'color 0.2s',
                fontFamily: "'Jost', sans-serif",
              }}>
                {label}
              </span>
              {active && (
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#C9A84C', marginTop: '-0.1rem' }} />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
        }
