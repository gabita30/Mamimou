'use client'
import {
  useState, useEffect, useRef, useCallback, Suspense
} from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase, type Profile, type Message, type ConversationWithUser } from '@/lib/supabase'

/* ─────────────────────────────────────────────
   TYPES étendus
───────────────────────────────────────────── */
type MessageStatus = 'sent' | 'delivered' | 'read'

interface ExtMessage extends Message {
  status?: MessageStatus
  edited_at?: string | null
  reply_to_id?: string | null
  reactions?: Record<string, string[]>   // emoji → [userId, ...]
  reply_to?: ExtMessage | null
}

interface UserPresence {
  user_id: string
  last_seen: string
  is_online: boolean
}

/* ─────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────── */
const PAGE_SIZE = 50
const PRESENCE_INTERVAL = 20_000
const ONLINE_THRESHOLD  = 120_000   // 2 min de marge (heartbeat = 20s)

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const fmtDate = (iso: string) => {
  const d     = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return fmt(iso)
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (diff === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

const fmtLastSeen = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)    return "à l'instant"
  if (diff < 3600_000)  return `il y a ${Math.floor(diff / 60_000)} min`
  if (diff < 86400_000) return `il y a ${Math.floor(diff / 3600_000)} h`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

const groupByDay = (msgs: ExtMessage[]) => {
  const groups: { label: string; messages: ExtMessage[] }[] = []
  let current = ''
  msgs.forEach(m => {
    const d     = new Date(m.created_at)
    const today = new Date()
    const yest  = new Date(today); yest.setDate(yest.getDate() - 1)
    let label: string
    if (d.toDateString() === today.toDateString())  label = "Aujourd'hui"
    else if (d.toDateString() === yest.toDateString()) label = 'Hier'
    else label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (label !== current) { groups.push({ label, messages: [] }); current = label }
    groups[groups.length - 1].messages.push(m)
  })
  return groups
}

/* ─────────────────────────────────────────────
   STATUS ICON
───────────────────────────────────────────── */
function StatusIcon({ status }: { status?: MessageStatus }) {
  if (!status || status === 'sent') {
    return (
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ opacity: 0.45 }}>
        <path d="M1 5l3 3 5-7" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (status === 'delivered') {
    return (
      <svg width="18" height="10" viewBox="0 0 18 10" fill="none" style={{ opacity: 0.55 }}>
        <path d="M1 5l3 3 5-7" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 5l3 3 5-7" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
      <path d="M1 5l3 3 5-7" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5l3 3 5-7" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/* ─────────────────────────────────────────────
   TYPING DOTS
───────────────────────────────────────────── */
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '10px 14px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'rgba(255,255,255,0.4)',
          animation: `typing-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/* ─────────────────────────────────────────────
   AVATAR
───────────────────────────────────────────── */
function Avatar({ profile, size, online }: { profile: Profile; size: number; online?: boolean }) {
  const initials = `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(201,168,76,0.25)' }}>
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: size * 0.35, color: 'rgba(255,255,255,0.6)',
          }}>
            {initials || '?'}
          </div>
        )}
      </div>
      {online !== undefined && (
        <div style={{
          position: 'absolute',
          bottom: -1, right: -1,
          width: 13, height: 13,
          borderRadius: '50%',
          background: online ? '#22C55E' : 'rgba(255,255,255,0.18)',
          border: '2.5px solid #0A1535',
          zIndex: 2,
          transition: 'background 0.4s',
          boxShadow: online ? '0 0 0 2px rgba(34,197,94,0.25)' : 'none',
        }} />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   CONV ROW
───────────────────────────────────────────── */
function ConvRow({ conv, active, onClick, online, unread }: {
  conv: ConversationWithUser; active: boolean; onClick: () => void; online?: boolean; unread?: boolean
}) {
  const [hover, setHover] = useState(false)
  const preview = conv.last_message?.image_url ? '📷 Photo' : conv.last_message?.content ?? 'Démarrer la conversation'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        padding: '0.75rem 1.25rem',
        cursor: 'pointer',
        background: active ? 'rgba(201,168,76,0.07)' : hover ? 'rgba(255,255,255,0.025)' : 'transparent',
        transition: 'background 0.15s',
        borderLeft: active ? '3px solid #C9A84C' : '3px solid transparent',
      }}
    >
      <Avatar profile={conv.other_user} size={48} online={online} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
          <span style={{ fontWeight: unread ? 600 : 500, fontSize: '0.88rem', color: unread ? 'white' : 'rgba(255,255,255,0.8)' }}>
            {conv.other_user.first_name} {conv.other_user.last_name}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.63rem', flexShrink: 0, marginLeft: '0.5rem' }}>
            {conv.last_message ? fmtDate(conv.last_message.created_at) : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <p style={{
            color: unread ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.28)',
            fontSize: '0.76rem', margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            flex: 1, fontWeight: unread ? 500 : 400,
          }}>
            {preview}
          </p>
          {unread && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#C9A84C', flexShrink: 0 }} />}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   REPLY PREVIEW BAR
───────────────────────────────────────────── */
function ReplyPreview({ msg, onCancel }: { msg: ExtMessage; onCancel: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.5rem 1rem',
      background: 'rgba(201,168,76,0.04)',
      borderTop: '1px solid rgba(201,168,76,0.12)',
      borderLeft: '3px solid rgba(201,168,76,0.5)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.68rem', color: '#C9A84C', fontWeight: 500, marginBottom: 2 }}>Répondre</p>
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {msg.image_url ? '📷 Photo' : msg.content}
        </p>
      </div>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.9rem', padding: '0.25rem', lineHeight: 1 }}>✕</button>
    </div>
  )
}

/* ─────────────────────────────────────────────
   MESSAGE BUBBLE
───────────────────────────────────────────── */
const REACTIONS_LIST = ['👍', '❤️', '😂', '😮', '😢']

function MessageBubble({ msg, mine, onReply, onReact }: {
  msg: ExtMessage; mine: boolean
  onReply: (m: ExtMessage) => void
  onReact: (id: string, emoji: string) => void
}) {
  const [showActions, setShowActions] = useState(false)
  const isOptimistic = msg.id.toString().startsWith('optimistic-')

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: '2px' }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Quoted message */}
      {msg.reply_to && (
        <div style={{
          maxWidth: '65%',
          background: mine ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.04)',
          borderRadius: '10px',
          borderLeft: '3px solid rgba(201,168,76,0.4)',
          padding: '0.3rem 0.6rem',
          marginBottom: '2px',
        }}>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>
            {msg.reply_to.image_url ? '📷 Photo' : msg.reply_to.content}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', flexDirection: mine ? 'row-reverse' : 'row' }}>

        {/* Hover actions */}
        {showActions && !isOptimistic && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            background: 'rgba(15,25,60,0.96)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px', padding: '4px 8px',
            backdropFilter: 'blur(8px)',
          }}>
            {REACTIONS_LIST.map(e => (
              <button key={e} onClick={() => onReact(msg.id, e)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', padding: '2px', lineHeight: 1,
                transition: 'transform 0.15s',
              }}
                onMouseEnter={ev => { (ev.currentTarget as HTMLButtonElement).style.transform = 'scale(1.35)' }}
                onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
              >{e}</button>
            ))}
            <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
            <button onClick={() => onReply(msg)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem',
              padding: '2px 4px', lineHeight: 1,
            }}>↩</button>
          </div>
        )}

        {/* Bubble */}
        <div style={{
          maxWidth: '68%',
          background: mine ? 'linear-gradient(145deg, #C9A84C, #E8C97A)' : 'rgba(255,255,255,0.07)',
          color: mine ? '#0D1B4B' : 'rgba(255,255,255,0.9)',
          borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          padding: msg.image_url && !msg.content ? '0.3rem' : '0.55rem 0.85rem 0.45rem',
          overflow: 'hidden',
          opacity: isOptimistic ? 0.6 : 1,
          transition: 'opacity 0.2s',
          boxShadow: mine ? '0 2px 10px rgba(201,168,76,0.12)' : '0 2px 6px rgba(0,0,0,0.12)',
        }}>
          {msg.image_url && (
            <img
              src={msg.image_url} alt="photo"
              onClick={() => window.open(msg.image_url!, '_blank')}
              style={{ maxWidth: '240px', maxHeight: '240px', objectFit: 'cover', borderRadius: '12px', display: 'block', cursor: 'pointer' }}
            />
          )}
          {/* Texte + timestamp : layout identique à WhatsApp/iMessage */}
          {msg.content && (
            <div style={{ margin: msg.image_url ? '0.4rem 0 0' : 0, lineHeight: 1.55 }}>
              <span style={{ fontSize: '0.88rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </span>
              {/* Fantôme invisible qui réserve la place du timestamp sur la dernière ligne */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                visibility: 'hidden', fontSize: '0.6rem',
                marginLeft: '6px', verticalAlign: 'bottom',
                userSelect: 'none', pointerEvents: 'none',
              }} aria-hidden>
                00:00{mine && !isOptimistic && <StatusIcon status={msg.status} />}
              </span>
              {/* Vrai timestamp positionné en bas à droite par float */}
              <span style={{
                float: 'right',
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                marginLeft: '4px', marginTop: '2px',
                verticalAlign: 'bottom', lineHeight: 1,
                clear: 'none',
              }}>
                {msg.edited_at && <span style={{ fontSize: '0.55rem', opacity: 0.4, color: mine ? '#0D1B4B' : 'inherit' }}>modifié</span>}
                <span style={{ fontSize: '0.6rem', opacity: 0.5, whiteSpace: 'nowrap' }}>
                  {isOptimistic ? '…' : fmt(msg.created_at)}
                </span>
                {mine && !isOptimistic && <StatusIcon status={msg.status} />}
              </span>
            </div>
          )}
          {/* Image sans texte : timestamp en dessous */}
          {msg.image_url && !msg.content && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '3px', alignItems: 'center', padding: '4px 2px 2px' }}>
              <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>{isOptimistic ? '…' : fmt(msg.created_at)}</span>
              {mine && !isOptimistic && <StatusIcon status={msg.status} />}
            </div>
          )}
        </div>
      </div>

      {/* Reactions */}
      {msg.reactions && Object.values(msg.reactions).some(u => u.length > 0) && (
        <div style={{ display: 'flex', gap: '4px', marginLeft: mine ? undefined : '0.4rem', marginRight: mine ? '0.4rem' : undefined }}>
          {Object.entries(msg.reactions).map(([emoji, users]) =>
            users.length > 0 ? (
              <div key={emoji} style={{
                background: 'rgba(255,255,255,0.07)',
                borderRadius: '12px', padding: '2px 7px',
                fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                {emoji}
                {users.length > 1 && <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.62rem' }}>{users.length}</span>}
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
function MessagesContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const activeId     = searchParams.get('id')

  const [userId,        setUserId]        = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationWithUser[]>([])
  const [messages,      setMessages]      = useState<ExtMessage[]>([])
  const [text,          setText]          = useState('')
  const [sending,       setSending]       = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [view,          setView]          = useState<'list' | 'chat'>(activeId ? 'chat' : 'list')
  const [hasMore,       setHasMore]       = useState(false)
  const [loadingMore,   setLoadingMore]   = useState(false)
  const [presence,      setPresence]      = useState<Record<string, UserPresence>>({})
  const [onlineUsers,   setOnlineUsers]   = useState<Set<string>>(new Set())
  const [replyTo,       setReplyTo]       = useState<ExtMessage | null>(null)
  const [isTyping,      setIsTyping]      = useState(false)
  const [otherTyping,   setOtherTyping]   = useState(false)

  const bottomRef        = useRef<HTMLDivElement>(null)
  const messagesRef      = useRef<HTMLDivElement>(null)
  const fileRef          = useRef<HTMLInputElement>(null)
  const userIdRef        = useRef<string | null>(null)
  const typingTimer      = useRef<NodeJS.Timeout | null>(null)
  const typingChannel    = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const scrolledToBottom = useRef(true)

  /* ── Auth ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setUserId(session.user.id); userIdRef.current = session.user.id }
    })
  }, [])

  /* ── Presence : Supabase Realtime Presence (WebSocket natif, instantané) ── */
  useEffect(() => {
    if (!userId) return

    const presenceChannel = supabase.channel('global-presence', {
      config: { presence: { key: userId } },
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<{ user_id: string }>()
        const online = new Set<string>()
        Object.values(state).forEach(presences => {
          presences.forEach((p: { user_id: string }) => online.add(p.user_id))
        })
        setOnlineUsers(online)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev)
          newPresences.forEach((p: { user_id: string }) => next.add(p.user_id))
          return next
        })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev)
          leftPresences.forEach((p: { user_id: string }) => next.delete(p.user_id))
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: userId })
        }
      })

    // Garder aussi le heartbeat postgres pour last_seen
    const upsert = async () => {
      const { error } = await supabase.from('user_presence')
        .upsert(
          { user_id: userId, is_online: true, last_seen: new Date().toISOString() },
          { onConflict: 'user_id' }   // clé primaire explicite pour le upsert
        )
      if (error) console.error('[Presence upsert error]', error)
    }
    upsert()
    const interval = setInterval(upsert, PRESENCE_INTERVAL)
    const handleUnload = () => {
      presenceChannel.untrack()
      supabase.from('user_presence').upsert(
        { user_id: userId, is_online: false, last_seen: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleUnload)
      presenceChannel.untrack()
      supabase.removeChannel(presenceChannel)
    }
  }, [userId])

  /* ── Load conversations ── */
  const loadConversations = useCallback(async () => {
    const uid = userIdRef.current
    if (!uid) return
    const { data: convs } = await supabase
      .from('conversations').select('*')
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .order('created_at', { ascending: false })
    if (!convs?.length) return
    const enriched: ConversationWithUser[] = await Promise.all(
      convs.map(async conv => {
        const otherId = conv.user1_id === uid ? conv.user2_id : conv.user1_id
        const [{ data: profile }, { data: msgs }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', otherId).single(),
          supabase.from('messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1),
        ])
        return { ...conv, other_user: profile as Profile, last_message: msgs?.[0] ?? null }
      })
    )
    setConversations(enriched.filter(c => c.other_user))
  }, [])

  useEffect(() => { if (userId) loadConversations() }, [userId, loadConversations])

  /* ── Realtime : conv list ── */
  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel('conv-list-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadConversations())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId, loadConversations])

  /* ── Presence : chargement initial + realtime ── */
  useEffect(() => {
    if (!userId) return

    // 1. Charger toutes les présences existantes immédiatement
    const loadPresence = async () => {
      const { data } = await supabase.from('user_presence').select('*')
      if (data) {
        const map: Record<string, UserPresence> = {}
        data.forEach(p => {
          map[p.user_id] = {
            ...p,
            is_online: p.is_online === true || (p.is_online as unknown) === 'true',
          }
        })
        setPresence(map)
      }
    }
    loadPresence()

    // 2. Écouter les changements en temps réel
    const ch = supabase.channel('presence-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, payload => {
        const rec = payload.new as UserPresence
        if (rec) {
          const normalized: UserPresence = {
            ...rec,
            is_online: rec.is_online === true || (rec.is_online as unknown) === 'true',
          }
          setPresence(prev => ({ ...prev, [rec.user_id]: normalized }))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [userId])

  /* ── Load messages ── */
  useEffect(() => {
    if (!activeId) return
    setMessages([]); setHasMore(false)
    const load = async () => {
      const { data, count } = await supabase
        .from('messages').select('*', { count: 'exact' })
        .eq('conversation_id', activeId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)
      if (data) {
        setMessages([...data].reverse() as ExtMessage[])
        setHasMore((count ?? 0) > PAGE_SIZE)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50)
      }
    }
    load()
    supabase.from('messages').update({ status: 'delivered' })
      .eq('conversation_id', activeId).neq('sender_id', userIdRef.current ?? '').eq('status', 'sent').then(() => {})
  }, [activeId])

  /* ── markAllRead : récepteur → signal read vers expéditeur via UPDATE realtime ── */
  const markAllRead = useCallback(async () => {
    if (!activeId || !userId) return
    await supabase.from('messages')
      .update({ status: 'read' })
      .eq('conversation_id', activeId)
      .neq('sender_id', userId)
      .in('status', ['sent', 'delivered'])
  }, [activeId, userId])

  /* ── Realtime : chat messages ── */
  useEffect(() => {
    if (!activeId || !userId) return
    const ch = supabase.channel(`chat-${activeId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeId}`,
      }, payload => {
        const newMsg = payload.new as ExtMessage
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          if (scrolledToBottom.current)
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          return [...prev, newMsg]
        })
        // Récepteur : marquer lu immédiatement → l'expéditeur voit ✓✓ en temps réel
        if (newMsg.sender_id !== userId) {
          supabase.from('messages').update({ status: 'read' }).eq('id', newMsg.id).then(() => {})
        }
        loadConversations()
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeId}`,
      }, payload => {
        // Expéditeur : bulle passe instantanément en "lu"
        const updated = payload.new as ExtMessage
        setMessages(prev =>
          prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m)
        )
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeId, userId, loadConversations])

  /* ── Typing broadcast ── */
  useEffect(() => {
    if (!activeId || !userId) return
    typingChannel.current = supabase.channel(`typing-${activeId}`, {
      config: { broadcast: { self: false } },
    })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.user_id !== userId) {
          setOtherTyping(true)
          setTimeout(() => setOtherTyping(false), 3000)
        }
      })
      .subscribe()
    return () => { if (typingChannel.current) supabase.removeChannel(typingChannel.current) }
  }, [activeId, userId])

  /* ── Mark read dès l'entrée dans la conv ── */
  useEffect(() => {
    if (!activeId || !userId) return
    const t = setTimeout(() => markAllRead(), 300)
    return () => clearTimeout(t)
  }, [activeId, userId, markAllRead])

  /* ── Mark read quand l'onglet reprend le focus ── */
  useEffect(() => {
    if (!activeId || !userId) return
    const onFocus = () => markAllRead()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [activeId, userId, markAllRead])

  /* ── Scroll tracker ── */
  const handleScroll = useCallback(() => {
    const el = messagesRef.current
    if (!el) return
    scrolledToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  /* ── Load more ── */
  const loadMore = useCallback(async () => {
    if (!activeId || !hasMore || loadingMore || !messages[0]) return
    setLoadingMore(true)
    const { data } = await supabase.from('messages').select('*')
      .eq('conversation_id', activeId)
      .lt('created_at', messages[0].created_at)
      .order('created_at', { ascending: false }).limit(PAGE_SIZE)
    if (data?.length) {
      setMessages(prev => [...([...data].reverse() as ExtMessage[]), ...prev])
      setHasMore(data.length === PAGE_SIZE)
    } else setHasMore(false)
    setLoadingMore(false)
  }, [activeId, hasMore, loadingMore, messages])

  /* ── Send text ── */
  const sendText = async () => {
    if (!text.trim() || !activeId || !userId) return
    const content = text.trim()
    setText(''); setReplyTo(null); setSending(true)
    const optimisticMsg: ExtMessage = {
      id: `optimistic-${Date.now()}`, conversation_id: activeId,
      sender_id: userId, content, image_url: null,
      created_at: new Date().toISOString(), status: 'sent',
      reply_to_id: replyTo?.id ?? null, reply_to: replyTo ?? null,
    }
    setMessages(prev => [...prev, optimisticMsg])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30)
    const { data: inserted } = await supabase.from('messages')
      .insert({ conversation_id: activeId, sender_id: userId, content, status: 'sent', reply_to_id: replyTo?.id ?? null })
      .select().single()
    if (inserted) setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...inserted, reply_to: replyTo } as ExtMessage : m))
    setSending(false)
  }

  /* ── Send image ── */
  const sendImage = async (file: File) => {
    if (!activeId || !userId) return
    setUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${activeId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('message-images').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('message-images').getPublicUrl(path)
      await supabase.from('messages').insert({ conversation_id: activeId, sender_id: userId, content: null, image_url: publicUrl, status: 'sent' })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  /* ── Typing ── */
  const handleTyping = (val: string) => {
    setText(val)
    if (!isTyping && typingChannel.current) {
      setIsTyping(true)
      typingChannel.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: userId } })
    }
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => setIsTyping(false), 2500)
  }

  /* ── Reactions ── */
  const handleReact = async (msgId: string, emoji: string) => {
    if (!userId) return
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const reactions = { ...(msg.reactions ?? {}) }
    const users: string[] = reactions[emoji] ?? []
    reactions[emoji] = users.includes(userId) ? users.filter(u => u !== userId) : [...users, userId]
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m))
    await supabase.from('messages').update({ reactions }).eq('id', msgId)
  }

  const openConv = (id: string) => { router.push(`/messages?id=${id}`); setView('chat') }
  const activeConv    = conversations.find(c => c.id === activeId)
  const otherUser     = activeConv?.other_user
  const otherPresence = otherUser ? presence[otherUser.id] : undefined
  // onlineUsers = source WebSocket temps réel (prioritaire)
  // otherPresence = fallback postgres pour last_seen
  const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false
  const grouped       = groupByDay(messages)

  /* ══════ CHAT VIEW ══════ */
  if (view === 'chat' && activeId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0A1535', fontFamily: "'Jost', sans-serif" }}>

        {/* Header */}
        <div style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <button onClick={() => { setView('list'); router.push('/messages') }} style={{ background: 'none', border: 'none', color: '#C9A84C', cursor: 'pointer', fontSize: '1.3rem', padding: '0.25rem', lineHeight: 1, opacity: 0.8 }}>←</button>
          {otherUser ? (
            <>
              <Avatar profile={otherUser} size={40} online={isOnline} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, fontSize: '0.92rem', color: 'white' }}>{otherUser.first_name} {otherUser.last_name}</p>
                <p style={{ margin: 0, fontSize: '0.68rem', color: isOnline ? '#22C55E' : 'rgba(255,255,255,0.28)', transition: 'color 0.3s' }}>
                  {isOnline ? 'En ligne' : otherPresence ? `Vu ${fmtLastSeen(otherPresence.last_seen)}` : otherUser.username ? `@${otherUser.username}` : ''}
                </p>
              </div>
            </>
          ) : (
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Conversation</p>
          )}
        </div>

        {/* Messages */}
        <div ref={messagesRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent' }}>

          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <button onClick={loadMore} disabled={loadingMore} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', fontSize: '0.73rem', borderRadius: '20px', padding: '0.35rem 1rem', cursor: loadingMore ? 'default' : 'pointer' }}>
                {loadingMore ? 'Chargement…' : 'Messages précédents'}
              </button>
            </div>
          )}

          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', opacity: 0.35 }}>
              <span style={{ fontSize: '2rem' }}>💬</span>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Commencez la conversation</p>
            </div>
          )}

          {grouped.map(group => (
            <div key={group.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{group.label}</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {group.messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} mine={msg.sender_id === userId} onReply={setReplyTo} onReact={handleReact} />
                ))}
              </div>
            </div>
          ))}

          {otherTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '18px 18px 18px 4px', overflow: 'hidden' }}>
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Reply bar */}
        {replyTo && <ReplyPreview msg={replyTo} onCancel={() => setReplyTo(null)} />}

        {/* Input */}
        <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,14,40,0.98)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f) }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: uploading ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)', cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
            {uploading ? '⏳' : '📎'}
          </button>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', padding: '0 0.4rem 0 1rem', minHeight: '42px' }}>
            <input
              type="text" value={text}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }}
              placeholder="Message…"
              style={{ flex: 1, background: 'none', border: 'none', color: 'rgba(255,255,255,0.9)', fontSize: '0.88rem', outline: 'none', fontFamily: "'Jost', sans-serif", padding: '0.5rem 0' }}
            />
            <button onClick={sendText} disabled={sending || !text.trim()} style={{
              width: '32px', height: '32px', borderRadius: '50%', border: 'none', flexShrink: 0,
              background: text.trim() ? 'linear-gradient(135deg, #C9A84C, #E8C97A)' : 'rgba(255,255,255,0.05)',
              color: text.trim() ? '#0D1B4B' : 'rgba(255,255,255,0.2)',
              cursor: text.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', transition: 'all 0.2s',
            }}>➤</button>
          </div>
        </div>
      </div>
    )
  }

  /* ══════ LIST VIEW ══════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0A1535', fontFamily: "'Jost', sans-serif" }}>
      <div style={{ padding: '1.5rem 1.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', fontWeight: 300, margin: 0, color: '#C9A84C', letterSpacing: '0.02em' }}>Messages</h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.22)' }}>
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
        {conversations.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.875rem', padding: '2rem', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>💬</div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 300, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Aucune conversation</p>
            <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.76rem', margin: 0, maxWidth: 200, lineHeight: 1.5 }}>Découvrez des profils et envoyez le premier message</p>
          </div>
        ) : (
          conversations.map(conv => {
            const pres   = conv.other_user ? presence[conv.other_user.id] : undefined
            // Source WebSocket temps réel
            const online = conv.other_user ? onlineUsers.has(conv.other_user.id) : false
            return <ConvRow key={conv.id} conv={conv} active={conv.id === activeId} onClick={() => openConv(conv.id)} online={online} />
          })
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   PAGE EXPORT
───────────────────────────────────────────── */
export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0A1535' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(201,168,76,0.25)', borderTopColor: '#C9A84C', margin: '0 auto 1rem', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'Jost', sans-serif", fontSize: '0.82rem', margin: 0 }}>Chargement…</p>
        </div>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  )
}
