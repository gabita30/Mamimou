'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Profile } from '@/lib/supabase'

const GENDER_OPTIONS = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
  { value: 'trans', label: 'Transgenre' },
  { value: 'non_binary', label: 'Non-binaire' },
  { value: 'other', label: 'Autre' },
]

type Form = {
  username: string
  first_name: string
  last_name: string
  bio: string
  gender: string
  is_public: boolean
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<Form>({ username: '', first_name: '', last_name: '', bio: '', gender: 'female', is_public: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (data) {
        setProfile(data)
        setForm({
          username: data.username ?? '',
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          bio: data.bio ?? '',
          gender: data.gender ?? 'other',
          is_public: data.is_public ?? true,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  const set = (key: keyof Form, val: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    setStatus('idle')

    const { error } = await supabase.from('profiles').update({
      username: form.username.trim() || null,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      bio: form.bio.trim() || null,
      gender: form.gender,
      is_public: form.is_public,
    }).eq('id', profile.id)

    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2500)
    }
    setSaving(false)
  }

  const handleAvatarUpload = async (file: File) => {
    if (!profile) return
    setUploadingAvatar(true)

    // Supprimer l'ancienne photo
    if (profile.avatar_url) {
      const oldPath = profile.avatar_url.split('/avatars/').pop()?.split('?')[0]
      if (oldPath) await supabase.storage.from('avatars').remove([oldPath])
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`

    // Upload via signed URL (pattern Harmonia)
    const { data: signed } = await supabase.storage.from('avatars').createSignedUploadUrl(path)
    if (signed) {
      await fetch(signed.signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const urlWithCache = `${publicUrl}?t=${Date.now()}`

      await supabase.from('profiles').update({ avatar_url: urlWithCache }).eq('id', profile.id)
      setProfile(prev => prev ? { ...prev, avatar_url: urlWithCache } : null)
    }

    setUploadingAvatar(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0D1B4B' }}>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", color: '#C9A84C', fontSize: '1.4rem', fontWeight: 300 }}>Chargement…</p>
    </div>
  )

  const initials = `${form.first_name?.[0] ?? ''}${form.last_name?.[0] ?? ''}`.toUpperCase()

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0D1B4B' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'rgba(13,27,75,0.95)', backdropFilter: 'blur(12px)', zIndex: 10 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 300, margin: 0, color: '#C9A84C' }}>
          Mon profil
        </h1>
        <button
          onClick={handleLogout}
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', borderRadius: '10px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'Jost', sans-serif", letterSpacing: '0.05em' }}
        >
          Déconnexion
        </button>
      </div>

      <div style={{ padding: '1.75rem 1.5rem 2rem' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem', marginBottom: '2.25rem' }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{ width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(201,168,76,0.45)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', color: 'rgba(255,255,255,0.4)' }}>
                {initials || '?'}
              </div>
            )}
            {uploadingAvatar && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
                ⏳
              </div>
            )}
            {/* Camera overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '0.2rem', opacity: 0, transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              <span style={{ fontSize: '1.1rem' }}>📷</span>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }} />
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
            Appuyer pour changer
          </p>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <FormField label="Pseudo" value={form.username} onChange={v => set('username', v)} placeholder="@monpseudo" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Prénom" value={form.first_name} onChange={v => set('first_name', v)} placeholder="Prénom" />
            <FormField label="Nom" value={form.last_name} onChange={v => set('last_name', v)} placeholder="Nom" />
          </div>

          {/* Genre */}
          <div>
            <label style={lbl}>Genre</label>
            <select
              value={form.gender}
              onChange={e => set('gender', e.target.value)}
              style={{ ...inp, appearance: 'none' as any, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(255,255,255,0.4)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
            >
              {GENDER_OPTIONS.map(o => (
                <option key={o.value} value={o.value} style={{ background: '#0D1B4B' }}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Bio */}
          <div>
            <label style={lbl}>Bio</label>
            <textarea
              value={form.bio}
              onChange={e => set('bio', e.target.value)}
              rows={4}
              placeholder="Parlez-nous de vous…"
              style={{ ...inp, resize: 'vertical', fontFamily: "'Jost', sans-serif", lineHeight: 1.6 }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Public toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '1rem 1.125rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>Profil public</p>
              <p style={{ margin: '0.15rem 0 0', color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>
                Visible dans le fil de découverte
              </p>
            </div>
            <Toggle value={form.is_public} onChange={v => set('is_public', v)} />
          </div>

          {/* Status messages */}
          {status === 'error' && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '12px', color: '#fca5a5', fontSize: '0.85rem' }}>
              {errorMsg}
            </div>
          )}
          {status === 'saved' && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '12px', color: '#86efac', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✓</span> Profil sauvegardé
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%',
              background: status === 'saved'
                ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                : 'linear-gradient(135deg, #C9A84C, #E8C97A)',
              color: '#0D1B4B',
              fontWeight: 600,
              padding: '1rem',
              borderRadius: '16px',
              border: 'none',
              cursor: saving ? 'default' : 'pointer',
              fontSize: '0.9rem',
              letterSpacing: '0.06em',
              fontFamily: "'Jost', sans-serif",
              opacity: saving ? 0.7 : 1,
              transition: 'background 0.3s, opacity 0.2s',
              marginTop: '0.25rem',
            }}
          >
            {saving ? 'Sauvegarde…' : status === 'saved' ? '✓ Sauvegardé' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inp}
        onFocus={focusBorder}
        onBlur={blurBorder}
      />
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: '48px', height: '28px', borderRadius: '14px', flexShrink: 0,
        background: value ? 'linear-gradient(135deg, #C9A84C, #E8C97A)' : 'rgba(255,255,255,0.12)',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: '3px',
        left: value ? '23px' : '3px',
        width: '22px', height: '22px', borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}

/* ── Shared styles ── */
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', letterSpacing: '0.18em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
  padding: '0.875rem 1rem', color: 'white', fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box',
  fontFamily: "'Jost', sans-serif", transition: 'border-color 0.2s',
}

const focusBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
  (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)')

const blurBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')
