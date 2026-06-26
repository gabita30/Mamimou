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
const PRESENCE_INTERVAL = 20_000   // 20 s
const ONLINE_THRESHOLD  = 60_000   // 60 s → considéré hors-ligne

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
  const d    = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000)    return 'À l\'instant'
  if (diff < 3600_000)  return `Il y a ${Math.floor(diff / 60_000)} min`
  if (diff < 86400_000) return `Il y a ${Math.floor(diff / 3600_000)} h`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

const groupByDay = (msgs: ExtMessage[]) => {
  const groups: { label: string; messages: ExtMessage[] }[] = []
  let current = ''
  msgs.forEach(m => {
    const d = new Date(m.created_at)
    const today = new Date()
    let label: string
    if (d.toDateString() === today.toDateString()) label = "Aujourd'hui"
    else {
      const yest = new Date(today)
      yest.setDate(yest.getDate() - 1)
      label = d.toDateString() === yest.toDateString()
        ? 'Hier'
        : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    }
    if (label !== current) {
      groups.push({ label, messages: [] })
      current = label
    }
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
  // read
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
      <path d="M1 5l3 3 5-7" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5l3 3 5-7" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/* ─────────────────────────────────────────────
   TYPING INDICATOR
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
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        border: '2px solid rgba(201,168,76,0.3)',
      }}>
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
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.25, height: size * 0.25,
          borderRadius: '50%',
          background: online ? '#22C55E' : 'rgba(255,255,255,0.2)',
          border: '2px solid #0D1B4B',
          transition: 'background 0.3s',
        }} />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   CONVERSATION ROW
───────────────────────────────────────────── */
function ConvRow({
  conv, active, onClick, online, unread,
}: {
  conv: ConversationWithUser
  active: boolean
  onClick: () => void
  online?: boolean
  unread?: boolean
}) {
  const [hover, setHover] = useState(false)
  const preview = conv.last_message?.image_url
    ? '📷 Photo'
    : conv.last_message?.content ?? 'Démarrer la conversation'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        padding: '0.75rem 1.25rem',
        cursor: 'pointer',
        background: active
          ? 'rgba(201,168,76,0.08)'
          : hover ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'background 0.15s',
        borderLeft: active ? '3px solid #C9A84C' : '3px solid transparent',
      }}
    >
      <Avatar profile={conv.other_user} size={48} online={online} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
          <span style={{
            fontWeight: unread ? 600 : 500,
            fontSize: '0.9rem',
            color: unread ? 'white' : 'rgba(255,255,255,0.85)',
          }}>
            {conv.other_user.first_name} {conv.other_user.last_name}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', flexShrink: 0, marginLeft: '0.5rem' }}>
            {conv.last_message ? fmtDate(conv.last_message.created_at) : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <p style={{
            color: unread ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)',
            fontSize: '0.78rem', margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            flex: 1,
            fontWeight: unread ? 500 : 400,
          }}>
            {preview}
          </p>
          {unread && (
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#C9A84C', flexShrink: 0,
            }} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   REPLY PREVIEW
───────────────────────────────────────────── */
function ReplyPreview({ msg, onCancel }: { msg: ExtMessage; onCancel: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.5rem 1rem',
      background: 'rgba(201,168,76,0.05)',
      borderTop: '1px solid rgba(201,168,76,0.15)',
      borderLeft: '3px solid #C9A84C',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#C9A84C', fontWeight: 500, marginBottom: 2 }}>
          Répondre
        </p>
        <p style={{
          margin: 0, fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.5)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {msg.image_url ? '📷 Photo' : msg.content}
        </p>
      </div>
      <button onClick={onCancel} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
        cursor: 'pointer', fontSize: '1rem', padding: '0.25rem', lineHeight: 1,
        flexShrink: 0,
      }}>✕</button>
    </div>
  )
}

/* ─────────────────────────────────────────────
   MESSAGE BUBBLE
───────────────────────────────────────────── */
function MessageBubble({
  msg, mine, onReply, onReact,
}: {
  msg: ExtMessage
  mine: boolean
  onReply: (m: ExtMessage) => void
  onReact: (id: string, emoji: string) => void
}) {
  const [showActions, setShowActions] = useState(false)
  const isOptimistic = msg.id.toString().startsWith('optimistic-')
  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢']

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: mine ? 'flex-end' : 'flex-start',
        gap: '2px',
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Replied-to preview */}
      {msg.reply_to && (
        <div style={{
          maxWidth: '65%',
          background: mine ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.04)',
          borderRadius: '10px',
          borderLeft: '3px solid rgba(201,168,76,0.5)',
          padding: '0.35rem 0.65rem',
          marginBottom: '2px',
          marginRight: mine ? '0' : undefined,
          marginLeft: mine ? undefined : '0',
        }}>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
            {msg.reply_to.image_url ? '📷 Photo' : msg.reply_to.content}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flexDirection: mine ? 'row-reverse' : 'row' }}>
        {/* Actions hover */}
        {showActions && !isOptimistic && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'rgba(20,30,70,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '4px 8px',
            backdropFilter: 'blur(8px)',
          }}>
            {REACTIONS.map(e => (
              <button key={e} onClick={() => onReact(msg.id, e)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.9rem', padding: '2px', lineHeight: 1,
                opacity: 0.8, transition: 'opacity 0.15s, transform 0.15s',
              }}
                onMouseEnter={ev => { (ev.currentTarget as HTMLButtonElement).style.transform = 'scale(1.3)' }}
                onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
              >{e}</button>
            ))}
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
            <button onClick={() => onReply(msg)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem',
              padding: '2px 4px', lineHeight: 1,
            }}>↩</button>
          </div>
        )}

        {/* Bubble */}
        <div style={{
          maxWidth: '68%',
          background: mine
            ? 'linear-gradient(145deg, #C9A84C, #E8C97A)'
            : 'rgba(255,255,255,0.07)',
          color: mine ? '#0D1B4B' : 'rgba(255,255,255,0.9)',
          borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          padding: msg.image_url && !msg.content ? '0.3rem' : '0.65rem 0.95rem',
          overflow: 'hidden',
          opacity: isOptimistic ? 0.65 : 1,
          transition: 'opacity 0.2s',
          boxShadow: mine
            ? '0 2px 12px rgba(201,168,76,0.15)'
            : '0 2px 8px rgba(0,0,0,0.15)',
          position: 'relative',
        }}>
          {msg.image_url && (
            <img
              src={msg.image_url}
              alt="photo"
              onClick={() => window.open(msg.image_url!, '_blank')}
              style={{
                maxWidth: '240px', maxHeight: '240px',
                objectFit: 'cover', borderRadius: '12px',
                display: 'block', cursor: 'pointer',
              }}
            />
          )}
          {msg.content && (
            <p style={{
              margin: msg.image_url ? '0.4rem 0 0' : 0,
              fontSize: '0.88rem', lineHeight: 1.55,
              wordBreak: 'break-word',
            }}>
              {msg.content}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
            {msg.edited_at && (
              <span style={{ fontSize: '0.6rem', opacity: 0.45 }}>modifié</span>
            )}
            <span style={{ fontSize: '0.62rem', opacity: 0.5 }}>
              {isOptimistic ? '…' : fmt(msg.created_at)}
            </span>
            {mine && !isOptimistic && <StatusIcon status={msg.status} />}
          </div>
        </div>
      </div>

      {/* Reactions */}
      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
        <div style={{
          display: 'flex', gap: '4px',
          marginLeft: mine ? undefined : '0.5rem',
          marginRight: mine ? '0.5rem' : undefined,
        }}>
          {Object.entries(msg.reactions).map(([emoji, users]) =>
            users.length > 0 ? (
              <div key={emoji} style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '12px', padding: '2px 7px',
                fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                {emoji}
                {users.length > 1 && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>{users.length}</span>
                )}
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
  const [replyTo,       setReplyTo]       = useState<ExtMessage | null>(null)
  const [isTyping,      setIsTyping]      = useState(false)
  const [otherTyping,   setOtherTyping]   = useState(false)

  const bottomRef     = useRef<HTMLDivElement>(null)
  const messagesRef   = useRef<HTMLDivElement>(null)
  const fileRef       = useRef<HTMLInputElement>(null)
  const userIdRef     = useRef<string | null>(null)
  const typingTimer   = useRef<NodeJS.Timeout | null>(null)
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const scrolledToBottom = useRef(true)

  /* ── Auth ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
        userIdRef.current = session.user.id
      }
    })
  }, [])

  /* ── Presence : heartbeat ── */
  useEffect(() => {
    if (!userId) return
    const upsert = () =>
      supabase.from('user_presence').upsert({ user_id: userId, is_online: true, last_seen: new Date().toISOString() })
    upsert()
    const interval = setInterval(upsert, PRESENCE_INTERVAL)

    // Offline on unload
    const handleUnload = () =>
      supabase.from('user_presence').upsert({ user_id: userId, is_online: false, last_seen: new Date().toISOString() })
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleUnload)
      handleUnload()
    }
  }, [userId])

  /* ── Load conversations ── */
  const loadConversations = useCallback(async () => {
    const uid = userIdRef.current
    if (!uid) return
    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .order('created_at', { ascending: false })

    if (!convs?.length) return

    const enriched: ConversationWithUser[] = await Promise.all(
      convs.map(async conv => {
        const otherId = conv.user1_id === uid ? conv.user2_id : conv.user1_id
        const [{ data: profile }, { data: msgs }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', otherId).single(),
          supabase.from('messages').select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false }).limit(1),
        ])
        return { ...conv, other_user: profile as Profile, last_message: msgs?.[0] ?? null }
      })
    )
    setConversations(enriched.filter(c => c.other_user))
  }, [])

  useEffect(() => {
    if (!userId) return
    loadConversations()
  }, [userId, loadConversations])

  /* ── Realtime : liste conversations ── */
  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel('conv-list-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadConversations()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId, loadConversations])

  /* ── Realtime : présence ── */
  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel('presence-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'user_presence',
      }, payload => {
        const rec = payload.new as UserPresence
        if (!rec) return
        setPresence(prev => ({ ...prev, [rec.user_id]: rec }))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  /* ── Load messages (derniers PAGE_SIZE) ── */
  useEffect(() => {
    if (!activeId) return
    setMessages([])
    setHasMore(false)

    const load = async () => {
      const { data, count } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('conversation_id', activeId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (data) {
        const sorted = [...data].reverse() as ExtMessage[]
        setMessages(sorted)
        setHasMore((count ?? 0) > PAGE_SIZE)
        // Scroll to bottom
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50)
      }
    }
    load()

    // Marquer les messages reçus comme "delivered"
    const markDelivered = async () => {
      await supabase.from('messages')
        .update({ status: 'delivered' })
        .eq('conversation_id', activeId)
        .neq('sender_id', userIdRef.current ?? '')
        .eq('status', 'sent')
    }
    markDelivered()
  }, [activeId])

  /* ── Realtime : messages du chat actif ── */
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
          const updated = [...prev, newMsg]
          // Scroll auto si on est en bas
          if (scrolledToBottom.current) {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
          return updated
        })
        // Marquer comme lu si on est dans la conv
        if (newMsg.sender_id !== userId) {
          supabase.from('messages').update({ status: 'read' }).eq('id', newMsg.id)
        }
        loadConversations()
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeId}`,
      }, payload => {
        const updated = payload.new as ExtMessage
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [activeId, userId, loadConversations])

  /* ── Typing channel (Broadcast) ── */
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

    return () => {
      if (typingChannel.current) supabase.removeChannel(typingChannel.current)
    }
  }, [activeId, userId])

  /* ── Marquer "lu" quand on entre dans la conv ── */
  useEffect(() => {
    if (!activeId || !userId) return
    supabase.from('messages')
      .update({ status: 'read' })
      .eq('conversation_id', activeId)
      .neq('sender_id', userId)
      .in('status', ['sent', 'delivered'])
      .then(() => {})
  }, [activeId, userId])

  /* ── Scroll tracker ── */
  const handleScroll = useCallback(() => {
    const el = messagesRef.current
    if (!el) return
    scrolledToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  /* ── Load more (pagination) ── */
  const loadMore = useCallback(async () => {
    if (!activeId || !hasMore || loadingMore) return
    setLoadingMore(true)
    const oldest = messages[0]?.created_at
    const { data } = await supabase
      .from('messages').select('*')
      .eq('conversation_id', activeId)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (data?.length) {
      const sorted = [...data].reverse() as ExtMessage[]
      setMessages(prev => [...sorted, ...prev])
      setHasMore(data.length === PAGE_SIZE)
    } else {
      setHasMore(false)
    }
    setLoadingMore(false)
  }, [activeId, hasMore, loadingMore, messages])

  /* ── Send text ── */
  const sendText = async () => {
    if (!text.trim() || !activeId || !userId) return
    const content = text.trim()
    setText('')
    setReplyTo(null)
    setSending(true)

    const optimisticMsg: ExtMessage = {
      id: `optimistic-${Date.now()}`,
      conversation_id: activeId,
      sender_id: userId,
      content,
      image_url: null,
      created_at: new Date().toISOString(),
      status: 'sent',
      reply_to_id: replyTo?.id ?? null,
      reply_to: replyTo ?? null,
    }
    setMessages(prev => [...prev, optimisticMsg])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30)

    const { data: inserted } = await supabase.from('messages')
      .insert({
        conversation_id: activeId,
        sender_id: userId,
        content,
        status: 'sent',
        reply_to_id: replyTo?.id ?? null,
      })
      .select().single()

    if (inserted) {
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...inserted, reply_to: replyTo } as ExtMessage : m))
    }
    setSending(false)
  }

  /* ── Send image ── */
  const sendImage = async (file: File) => {
    if (!activeId || !userId) return
    setUploading(true)
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${activeId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('message-images').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('message-images').getPublicUrl(path)
      await supabase.from('messages').insert({
        conversation_id: activeId, sender_id: userId,
        content: null, image_url: publicUrl, status: 'sent',
      })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  /* ── Typing broadcast ── */
  const handleTyping = (val: string) => {
    setText(val)
    if (!isTyping && typingChannel.current) {
      setIsTyping(true)
      typingChannel.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: userId } })
    }
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => setIsTyping(false), 2500)
  }

  /* ── React to message ── */
  const handleReact = async (msgId: string, emoji: string) => {
    if (!userId) return
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const reactions = { ...(msg.reactions ?? {}) }
    const users: string[] = reactions[emoji] ?? []
    if (users.includes(userId)) {
      reactions[emoji] = users.filter(u => u !== userId)
    } else {
      reactions[emoji] = [...users, userId]
    }
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m))
    await supabase.from('messages').update({ reactions }).eq('id', msgId)
  }

  const openConv = (id: string) => {
    router.push(`/messages?id=${id}`)
    setView('chat')
  }

  const activeConv    = conversations.find(c => c.id === activeId)
  const otherUser     = activeConv?.other_user
  const otherPresence = otherUser ? presence[otherUser.id] : undefined
  const isOnline      = otherPresence?.is_online &&
    (Date.now() - new Date(otherPresence.last_seen).getTime()) < ONLINE_THRESHOLD

  const grouped = groupByDay(messages)

  /* ══════════════════════════════════
     CHAT VIEW
  ══════════════════════════════════ */
  if (view === 'chat' && activeId) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: '#0A1535',
        fontFamily: "'Jost', sans-serif",
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '0.75rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.875rem',
          background: 'rgba(255,255,255,0.025)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          backdropFilter: 'blur(10px)',
        }}>
          <button
            onClick={() => { setView('list'); router.push('/messages') }}
            style={{
              background: 'none', border: 'none', color: '#C9A84C',
              cursor: 'pointer', fontSize: '1.3rem', padding: '0.25rem',
              lineHeight: 1, opacity: 0.8,
            }}
          >←</button>

          {otherUser ? (
            <>
              <Avatar profile={otherUser} size={40} online={isOnline} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, fontSize: '0.92rem', color: 'white' }}>
                  {otherUser.first_name} {otherUser.last_name}
                </p>
                <p style={{ margin: 0, fontSize: '0.68rem', color: isOnline ? '#22C55E' : 'rgba(255,255,255,0.3)' }}>
                  {isOnline
                    ? 'En ligne'
                    : otherPresence
                      ? `Vu ${fmtLastSeen(otherPresence.last_seen)}`
                      : otherUser.username ? `@${otherUser.username}` : ''}
                </p>
              </div>
            </>
          ) : (
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Conversation</p>
          )}
        </div>

        {/* ── Messages ── */}
        <div
          ref={messagesRef}
          onScroll={handleScroll}
          style={{
            flex: 1, overflowY: 'auto', padding: '1rem 1.25rem',
            display: 'flex', flexDirection: 'column', gap: '0.4rem',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.08) transparent',
          }}
        >
          {/* Load more */}
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <button onClick={loadMore} disabled={loadingMore} style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem',
                borderRadius: '20px', padding: '0.4rem 1rem',
                cursor: loadingMore ? 'default' : 'pointer',
              }}>
                {loadingMore ? 'Chargement…' : 'Voir plus'}
              </button>
            </div>
          )}

          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', opacity: 0.4 }}>
              <span style={{ fontSize: '2rem' }}>💬</span>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                Commencez la conversation
              </p>
            </div>
          )}

          {grouped.map(group => (
            <div key={group.label}>
              {/* Day separator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {group.label}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {group.messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    mine={msg.sender_id === userId}
                    onReply={setReplyTo}
                    onReact={handleReact}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {otherTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: 'rgba(255,255,255,0.07)',
                borderRadius: '18px 18px 18px 4px',
                overflow: 'hidden',
              }}>
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Reply preview ── */}
        {replyTo && (
          <ReplyPreview msg={replyTo} onCancel={() => setReplyTo(null)} />
        )}

        {/* ── Input bar ── */}
        <div style={{
          padding: '0.6rem 1rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(8,16,45,0.97)',
          display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
          flexShrink: 0,
        }}>
          <input
            ref={fileRef} type="file" accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f) }}
          />

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: uploading ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.45)',
              cursor: uploading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', flexShrink: 0, transition: 'all 0.2s',
            }}
            title="Envoyer une photo"
          >
            {uploading ? '⏳' : '📎'}
          </button>

          <div style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '22px',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center',
            padding: '0 0.4rem 0 1rem',
            minHeight: '42px',
            transition: 'border-color 0.2s',
          }}>
            <input
              type="text"
              value={text}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }}
              placeholder="Message…"
              style={{
                flex: 1, background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.9)', fontSize: '0.88rem',
                outline: 'none', fontFamily: "'Jost', sans-serif",
                padding: '0.5rem 0',
              }}
            />
            <button
              onClick={sendText}
              disabled={sending || !text.trim()}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                border: 'none', flexShrink: 0,
                background: text.trim()
                  ? 'linear-gradient(135deg, #C9A84C, #E8C97A)'
                  : 'rgba(255,255,255,0.06)',
                color: text.trim() ? '#0D1B4B' : 'rgba(255,255,255,0.2)',
                cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', transition: 'all 0.2s',
              }}
            >➤</button>
          </div>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════
     CONVERSATION LIST
  ══════════════════════════════════ */
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#0A1535', fontFamily: "'Jost', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 1.5rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '1.75rem', fontWeight: 300, margin: 0,
          color: '#C9A84C', letterSpacing: '0.02em',
        }}>
          Messages
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
        {conversations.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: '0.875rem',
            padding: '2rem', textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(201,168,76,0.08)',
              border: '1px solid rgba(201,168,76,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.75rem',
            }}>💬</div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 300, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              Aucune conversation
            </p>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem', margin: 0, maxWidth: 200, lineHeight: 1.5 }}>
              Découvrez des profils et envoyez le premier message
            </p>
          </div>
        ) : (
          conversations.map(conv => {
            const otherId = conv.other_user?.id
            const pres    = otherId ? presence[otherId] : undefined
            const online  = pres?.is_online && (Date.now() - new Date(pres.last_seen).getTime()) < ONLINE_THRESHOLD
            return (
              <ConvRow
                key={conv.id}
                conv={conv}
                active={conv.id === activeId}
                onClick={() => openConv(conv.id)}
                online={online}
              />
            )
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: '#0A1535',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '2px solid rgba(201,168,76,0.3)',
            borderTopColor: '#C9A84C',
            margin: '0 auto 1rem',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'Jost', sans-serif", fontSize: '0.85rem', margin: 0 }}>
            Chargement…
          </p>
        </div>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  )
}
