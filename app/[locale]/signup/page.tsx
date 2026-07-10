'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const t = useTranslations('Signup')
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const GENDER_OPTIONS = [
    { value: 'male', label: t('genders.male') },
    { value: 'female', label: t('genders.female') },
    { value: 'trans', label: t('genders.trans') },
    { value: 'non_binary', label: t('genders.nonBinary') },
    { value: 'other', label: t('genders.other') },
  ]

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    username: '', first_name: '', last_name: '',
    gender: 'female', bio: '', is_public: true, adult: false,
  })

  const set = (key: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError(t('errors.passwordMismatch'))
      return
    }
    if (!form.adult) {
      setError(t('errors.mustBeAdult'))
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? t('errors.signupFailed'))
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      username: form.username.trim() || null,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      gender: form.gender,
      bio: form.bio.trim() || null,
      is_public: form.is_public,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    // ── Trigger SQL s'en charge automatiquement à l'INSERT profiles ──
    // Mais on force aussi via RPC au cas où la session est disponible
    if (data.session) {
      const { error: rpcErr } = await supabase.rpc('set_online', { p_user_id: data.user.id })
      if (rpcErr) {
        console.error('[set_online error]', rpcErr.code, rpcErr.message, rpcErr.details, rpcErr.hint)
      } else {
        console.log('[set_online] OK pour', data.user.id)
      }
    }

    router.push('/feed')
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(140deg, #0a1535 0%, #0D1B4B 40%, #12204f 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'fixed', top: '5%', left: '10%', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(232,180,192,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '8%', right: '5%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', fontWeight: 300, color: '#C9A84C', margin: 0, letterSpacing: '0.12em' }}>
            {t('brand')}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: '0.4rem' }}>
            {t('createAccount')}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {[1, 2].map(s => (
            <div key={s} style={{ width: s === step ? '32px' : '8px', height: '8px', borderRadius: '4px', background: s === step ? '#C9A84C' : s < step ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.15)', transition: 'all 0.3s' }} />
          ))}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px', padding: '2.5rem 2rem' }}>
          <form onSubmit={step === 1
            ? (e) => { e.preventDefault(); setError(''); if (form.password !== form.confirmPassword) { setError(t('errors.passwordDifferent')); return } setStep(2) }
            : handleSignup
          }>
            {step === 1 && (
              <>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 300, margin: '0 0 2rem', color: 'rgba(255,255,255,0.9)' }}>
                  {t('step1.title')}
                </h2>
                <Field label={t('fields.email')} value={form.email} onChange={v => set('email', v)} type="email" placeholder={t('fields.emailPlaceholder')} required />
                <Field label={t('fields.password')} value={form.password} onChange={v => set('password', v)} type="password" placeholder={t('fields.passwordPlaceholder')} required />
                <Field label={t('fields.confirmPassword')} value={form.confirmPassword} onChange={v => set('confirmPassword', v)} type="password" placeholder="••••••••" required />
                {error && <ErrorBox msg={error} />}
                <button type="submit" style={btnGold}>{t('continueCta')}</button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 300, margin: '0 0 2rem', color: 'rgba(255,255,255,0.9)' }}>
                  {t('step2.title')}
                </h2>
                <Field label={t('fields.username')} value={form.username} onChange={v => set('username', v)} placeholder={t('fields.usernamePlaceholder')} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={lbl}>{t('fields.firstName')}</label>
                    <input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder={t('fields.firstName')} style={inp} onFocus={focusBorder} onBlur={blurBorder} />
                  </div>
                  <div>
                    <label style={lbl}>{t('fields.lastName')}</label>
                    <input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder={t('fields.lastName')} style={inp} onFocus={focusBorder} onBlur={blurBorder} />
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={lbl}>{t('fields.gender')}</label>
                  <select value={form.gender} onChange={e => set('gender', e.target.value)} style={{ ...inp, appearance: 'none' as any }}>
                    {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0D1B4B' }}>{o.label}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={lbl}>{t('fields.bio')}</label>
                  <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} placeholder={t('fields.bioPlaceholder')} style={{ ...inp, resize: 'vertical', fontFamily: "'Jost', sans-serif" }} onFocus={focusBorder} onBlur={blurBorder} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{t('fields.publicProfile')}</span>
                  <Toggle value={form.is_public} onChange={v => set('is_public', v)} />
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.adult} onChange={e => set('adult', e.target.checked)} style={{ marginTop: '2px', accentColor: '#C9A84C', width: '16px', height: '16px', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                    {t.rich('ageConfirmation', {
                      strong: (chunks) => <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{chunks}</strong>,
                    })}
                  </span>
                </label>

                {error && <ErrorBox msg={error} />}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setStep(1)} style={{ ...btnGhost, flex: '0 0 auto' }}>←</button>
                  <button type="submit" disabled={loading} style={{ ...btnGold, flex: 1 }}>
                    {loading ? t('creating') : t('joinCta')}
                  </button>
                </div>
              </>
            )}
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
            {t('alreadyMember')}{' '}
            <Link href="/login" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 500 }}>{t('login')}</Link>
          </p>
        </div>
      </div>
    </main>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        style={inp} onFocus={focusBorder} onBlur={blurBorder} />
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: '44px', height: '26px', borderRadius: '13px', background: value ? 'linear-gradient(135deg, #C9A84C, #E8C97A)' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '3px', left: value ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '12px', color: '#fca5a5', fontSize: '0.85rem' }}>
      {msg}
    </div>
  )
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', letterSpacing: '0.18em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
  padding: '0.875rem 1rem', color: 'white', fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box', fontFamily: "'Jost', sans-serif",
  transition: 'border-color 0.2s',
}

const focusBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
  (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)')

const blurBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')

const btnGold: React.CSSProperties = {
  width: '100%', background: 'linear-gradient(135deg, #C9A84C 0%, #E8C97A 100%)',
  color: '#0D1B4B', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.06em',
  padding: '0.9rem', borderRadius: '14px', border: 'none', cursor: 'pointer',
  fontFamily: "'Jost', sans-serif",
}

const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
  color: 'white', fontWeight: 500, fontSize: '1rem', padding: '0.9rem 1.25rem',
  borderRadius: '14px', cursor: 'pointer', fontFamily: "'Jost', sans-serif",
}
