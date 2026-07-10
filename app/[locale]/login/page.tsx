'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations('Login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err || !data.session) {
      setError(err?.message ?? t('errors.loginFailed'))
      setLoading(false)
      return
    }

    // ── Marquer en ligne via RPC SECURITY DEFINER (droits postgres) ──
    const { error: rpcErr } = await supabase.rpc('set_online', { p_user_id: data.session.user.id })
    if (rpcErr) {
      console.error('[set_online error]', rpcErr.code, rpcErr.message, rpcErr.details, rpcErr.hint)
    } else {
      console.log('[set_online] OK pour', data.session.user.id)
    }

    router.push('/feed')
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(140deg, #0a1535 0%, #0D1B4B 40%, #12204f 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'fixed', top: '8%', right: '8%', width: '320px', height: '320px', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '12%', left: '4%', width: '240px', height: '240px', background: 'radial-gradient(circle, rgba(232,180,192,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3.5rem', fontWeight: 300, color: '#C9A84C', margin: 0, letterSpacing: '0.12em', lineHeight: 1 }}>
            {t('brand')}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: '0.5rem' }}>
            {t('tagline')}
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px', padding: '2.5rem 2rem' }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 300, margin: '0 0 2rem', color: 'rgba(255,255,255,0.9)' }}>
            {t('title')}
          </h2>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>{t('fields.email')}</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder={t('fields.emailPlaceholder')} style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>{t('fields.password')}</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>

            {error && (
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '12px', color: '#fca5a5', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%',
              background: loading ? 'rgba(201,168,76,0.4)' : 'linear-gradient(135deg, #C9A84C 0%, #E8C97A 100%)',
              color: '#0D1B4B', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.06em',
              padding: '0.9rem', borderRadius: '14px', border: 'none',
              cursor: loading ? 'default' : 'pointer', transition: 'opacity 0.2s',
              fontFamily: "'Jost', sans-serif",
            }}>
              {loading ? t('connecting') : t('loginCta')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.75rem', color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>
            {t('notMember')}{' '}
            <Link href="/signup" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 500 }}>{t('join')}</Link>
          </p>
        </div>
      </div>
    </main>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', letterSpacing: '0.18em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
  padding: '0.875rem 1rem', color: 'white', fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box', fontFamily: "'Jost', sans-serif",
  transition: 'border-color 0.2s',
}
