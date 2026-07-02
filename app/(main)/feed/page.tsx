'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Profile } from '@/lib/supabase'
import { useNotificationPrompt } from './hooks/useNotificationPrompt'

const SWIPE_THRESHOLD = 90

export default function FeedPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [animOut, setAnimOut] = useState<null | 'left' | 'right'>(null)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const startPos = useRef({ x: 0, y: 0 })

  const { isSubscribable, isSubscribed, isLoading: notifLoading, promptSubscribe } = useNotificationPrompt()

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user.id ?? null
      setCurrentUserId(uid)

      // ── Marquer en ligne dès l'arrivée sur le feed ──
      if (uid) {
        const { error } = await supabase.rpc('set_online', { p_user_id: uid })
        if (error) console.warn('[set_online]', error.message)
      }

      const query = supabase.from('feed_public').select('*').limit(30)
      if (uid) query.neq('id', uid)

      const { data } = await query
      if (data) setProfiles(data)
      setLoading(false)
    }
    init()
  }, [])

  const advance = useCallback((dir: 'left' | 'right') => {
    setAnimOut(dir)
    setTimeout(() => {
      setCurrentIndex(i => i + 1)
      setAnimOut(null)
      setDragX(0)
      setDragY(0)
    }, 320)
  }, [])

  const onDragStart = (x: number, y: number) => {
    if (animOut) return
    startPos.current = { x, y }
    setIsDragging(true)
  }

  const onDragMove = useCallback((x: number, y: number) => {
    if (!isDragging || animOut) return
    setDragX(x - startPos.current.x)
    setDragY(y - startPos.current.y)
  }, [isDragging, animOut])

  const onDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragX > SWIPE_THRESHOLD) advance('right')
    else if (dragX < -SWIPE_THRESHOLD) advance('left')
    else { setDragX(0); setDragY(0) }
  }, [isDragging, dragX, advance])

  const handleMessage = async (profileId: string) => {
    if (!currentUserId) return
    const uid = currentUserId

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(user1_id.eq.${uid},user2_id.eq.${profileId}),and(user1_id.eq.${profileId},user2_id.eq.${uid})`)
      .maybeSingle()

    let convId = existing?.id
    if (!convId) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ user1_id: uid, user2_id: profileId })
        .select('id')
        .single()
      convId = newConv?.id
    }
    if (convId) router.push(`/messages?id=${convId}`)
  }

  const current = profiles[currentIndex]
  const next = profiles[currentIndex + 1]
  const afterNext = profiles[currentIndex + 2]

  const likeOpacity = Math.max(0, Math.min(1, dragX / 70))
  const passOpacity = Math.max(0, Math.min(1, -dragX / 70))

  let cardTransform = `translateX(${dragX}px) translateY(${dragY * 0.15}px) rotate(${dragX * 0.038}deg)`
  let cardTransition = isDragging ? 'none' : 'transform 0.3s cubic-bezier(.25,.8,.25,1)'

  if (animOut === 'right') {
    cardTransform = 'translateX(130vw) rotate(22deg)'
    cardTransition = 'transform 0.32s cubic-bezier(.55,0,1,.45)'
  } else if (animOut === 'left') {
    cardTransform = 'translateX(-130vw) rotate(-22deg)'
    cardTransition = 'transform 0.32s cubic-bezier(.55,0,1,.45)'
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0D1B4B' }}>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", color: '#C9A84C', fontSize: '1.4rem', fontWeight: 300 }}>Chargement…</p>
    </div>
  )

  if (!current) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.25rem', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3.5rem' }}>✨</div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 300, color: 'rgba(255,255,255,0.8)', margin: 0 }}>
        Vous avez tout exploré
      </p>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', margin: 0 }}>
        Revenez plus tard pour découvrir de nouveaux profils.
      </p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D1B4B', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1.25rem 1.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 300, color: '#C9A84C', margin: 0, letterSpacing: '0.05em' }}>
          Désirs
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isSubscribed ? (
            <span title="Notifications activées" style={{ fontSize: '1.1rem', color: '#C9A84C', opacity: 0.7 }}>🔔</span>
          ) : isSubscribable ? (
            <button
              onClick={promptSubscribe}
              disabled={notifLoading}
              title="Activer les notifications"
              style={{
                background: 'rgba(201,168,76,0.12)',
                border: '1px solid rgba(201,168,76,0.4)',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                cursor: notifLoading ? 'default' : 'pointer',
                opacity: notifLoading ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              🔔
            </button>
          ) : null}
          <span style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
            {profiles.length - currentIndex} profils
          </span>
        </div>
      </div>

      {/* Card stack */}
      <div style={{ flex: 1, position: 'relative', padding: '0 1rem', minHeight: 0 }}>
        {afterNext && (
          <div style={{ position: 'absolute', inset: '0 1rem', transform: 'scale(0.88) translateY(10%)', transformOrigin: 'center bottom', borderRadius: '26px', overflow: 'hidden', zIndex: 1 }}>
            <ProfileCard profile={afterNext} />
          </div>
        )}
        {next && (
          <div style={{ position: 'absolute', inset: '0 1rem', transform: 'scale(0.94) translateY(5%)', transformOrigin: 'center bottom', borderRadius: '26px', overflow: 'hidden', zIndex: 2 }}>
            <ProfileCard profile={next} />
          </div>
        )}
        <div
          style={{ position: 'absolute', inset: '0 1rem', transform: cardTransform, transition: cardTransition, borderRadius: '26px', overflow: 'hidden', zIndex: 10, cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', willChange: 'transform' }}
          onMouseDown={e => onDragStart(e.clientX, e.clientY)}
          onMouseMove={e => onDragMove(e.clientX, e.clientY)}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          onTouchStart={e => onDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={e => { e.preventDefault(); onDragMove(e.touches[0].clientX, e.touches[0].clientY) }}
          onTouchEnd={onDragEnd}
        >
          <ProfileCard profile={current} />
          <div style={{ position: 'absolute', top: '1.75rem', left: '1.25rem', opacity: likeOpacity, border: '2.5px solid #4ade80', borderRadius: '10px', padding: '0.2rem 0.75rem', color: '#4ade80', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.08em', transform: 'rotate(-12deg)', fontFamily: "'Jost', sans-serif" }}>J'AIME</div>
          <div style={{ position: 'absolute', top: '1.75rem', right: '1.25rem', opacity: passOpacity, border: '2.5px solid #f87171', borderRadius: '10px', padding: '0.2rem 0.75rem', color: '#f87171', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.08em', transform: 'rotate(12deg)', fontFamily: "'Jost', sans-serif" }}>PASS</div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0.875rem 1.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <button onClick={() => advance('left')} style={roundBtn('#f87171', 0.15)} title="Passer">✕</button>
        <button onClick={() => setSelectedProfile(current)} style={{ flex: 1, height: '50px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '25px', color: 'white', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Voir le profil</button>
        <button onClick={() => handleMessage(current.id)} style={{ flex: 1, height: '50px', background: 'linear-gradient(135deg, #C9A84C, #E8C97A)', border: 'none', borderRadius: '25px', color: '#0D1B4B', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, fontFamily: "'Jost', sans-serif" }}>Message</button>
        <button onClick={() => advance('right')} style={roundBtn('#4ade80', 0.15)} title="J'aime">♥</button>
      </div>

      {selectedProfile && (
        <ProfileModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} onMessage={id => { handleMessage(id); setSelectedProfile(null) }} />
      )}
    </div>
  )
}

function ProfileCard({ profile }: { profile: Profile }) {
  const initials = `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(150deg, #1c3070, #0D1B4B)', position: 'relative' }}>
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt="" draggable={false} style={{ width: '100%', height: '68%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
      ) : (
        <div style={{ width: '100%', height: '68%', background: 'linear-gradient(135deg, #1c3070, #2a4080)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '5rem', color: 'rgba(255,255,255,0.15)', fontWeight: 300 }}>{initials || '?'}</span>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', background: 'linear-gradient(to top, rgba(10,20,55,1) 0%, rgba(10,20,55,0.7) 50%, transparent 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', right: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 400, margin: 0, lineHeight: 1.1 }}>{profile.first_name} {profile.last_name}</h2>
          {profile.username && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>@{profile.username}</span>}
        </div>
        <div style={{ marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.35)', color: '#C9A84C', borderRadius: '100px', padding: '0.22rem 0.7rem' }}>{genderLabel(profile.gender)}</span>
        </div>
        {profile.bio && <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem', lineHeight: 1.55, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{profile.bio}</p>}
      </div>
    </div>
  )
}

function ProfileModal({ profile, onClose, onMessage }: { profile: Profile; onClose: () => void; onMessage: (id: string) => void }) {
  const initials = `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: '480px', margin: '0 auto', background: 'linear-gradient(170deg, #1c3070 0%, #0D1B4B 100%)', borderRadius: '28px 28px 0 0', padding: '2rem', maxHeight: '80dvh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none' }}>
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '-0.5rem auto 1.75rem' }} />
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(201,168,76,0.4)', flexShrink: 0 }}>
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: 'rgba(255,255,255,0.5)' }}>{initials || '?'}</div>}
          </div>
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 400, margin: '0 0 0.2rem' }}>{profile.first_name} {profile.last_name}</h2>
            {profile.username && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>@{profile.username}</p>}
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.35)', color: '#C9A84C', borderRadius: '100px', padding: '0.22rem 0.7rem' }}>{genderLabel(profile.gender)}</span>
          </div>
        </div>
        {profile.bio && (
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '0.6rem' }}>À propos</p>
            <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, fontSize: '0.9rem', margin: 0 }}>{profile.bio}</p>
          </div>
        )}
        <button onClick={() => onMessage(profile.id)} style={{ width: '100%', background: 'linear-gradient(135deg, #C9A84C, #E8C97A)', color: '#0D1B4B', fontWeight: 600, padding: '1rem', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', letterSpacing: '0.05em', fontFamily: "'Jost', sans-serif" }}>Envoyer un message</button>
      </div>
    </div>
  )
}

function genderLabel(gender: string) {
  const map: Record<string, string> = { male: 'Homme', female: 'Femme', trans: 'Trans', non_binary: 'Non-binaire', other: 'Autre' }
  return map[gender] ?? gender
}

function roundBtn(color: string, alpha: number): React.CSSProperties {
  return { width: '50px', height: '50px', borderRadius: '50%', flexShrink: 0, background: `rgba(${color === '#f87171' ? '248,113,113' : '74,222,128'},${alpha})`, border: `1.5px solid ${color}55`, color, fontSize: '1.3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s' }
}
