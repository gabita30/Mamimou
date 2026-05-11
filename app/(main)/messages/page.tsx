'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase, type Profile, type Message, type ConversationWithUser } from '@/lib/supabase'

function MessagesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeId = searchParams.get('id')

  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationWithUser[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [view, setView] = useState<'list' | 'chat'>(activeId ? 'chat' : 'list')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /* Current user */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id)
    })
  }, [])

  /* Load conversations */
  useEffect(() => {
    if (!userId) return
    const load = async () => {
      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (!convs?.length) return

      const enriched: ConversationWithUser[] = await Promise.all(
        convs.map(async conv => {
          const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id
          const [{ data: profile }, { data: msgs }] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', otherId).single(),
            supabase.from('messages').select('*').eq('conversation_id', conv.id)
              .order('created_at', { ascending: false }).limit(1),
          ])
          return { ...conv, other_user: profile as Profile, last_message: msgs?.[0] ?? null }
        })
      )
      setConversations(enriched.filter(c => c.other_user))
    }
    load()
  }, [userId])

  /* Load messages for active conversation */
  useEffect(() => {
    if (!activeId) return
    setMessages([])

    const load = async () => {
      const { data } = await supabase
        .from('messages').select('*')
        .eq('conversation_id', activeId)
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
    load()

    const channel = supabase.channel(`conv-${activeId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeId}`,
      }, payload => setMessages(prev => [...prev, payload.new as Message]))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeId])

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendText = async () => {
    if (!text.trim() || !activeId || !userId) return
    setSending(true)
    await supabase.from('messages').insert({
      conversation_id: activeId, sender_id: userId, content: text.trim(),
    })
    setText('')
    setSending(false)
  }

  const sendImage = async (file: File) => {
    if (!activeId || !userId) return
    setUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${activeId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('message-images').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('message-images').getPublicUrl(path)
      await supabase.from('messages').insert({
        conversation_id: activeId, sender_id: userId,
        content: null, image_url: publicUrl,
      })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const openConv = (id: string) => {
    router.push(`/messages?id=${id}`)
    setView('chat')
  }

  const activeConv = conversations.find(c => c.id === activeId)

  /* ── CHAT VIEW ── */
  if (view === 'chat' && activeId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D1B4B' }}>
        {/* Header */}
        <div style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button onClick={() => { setView('list'); router.push('/messages') }} style={{ background: 'none', border: 'none', color: '#C9A84C', cursor: 'pointer', fontSize: '1.4rem', padding: '0.25rem', lineHeight: 1 }}>
            ←
          </button>
          {activeConv ? (
            <>
              <Avatar profile={activeConv.other_user} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeConv.other_user.first_name} {activeConv.other_user.last_name}
                </p>
                {activeConv.other_user.username && (
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>@{activeConv.other_user.username}</p>
                )}
              </div>
            </>
          ) : (
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Conversation</p>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', textAlign: 'center' }}>
                Commencez la conversation 👋
              </p>
            </div>
          )}
          {messages.map(msg => {
            const mine = msg.sender_id === userId
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%',
                  background: mine ? 'linear-gradient(135deg, #C9A84C, #E8C97A)' : 'rgba(255,255,255,0.08)',
                  color: mine ? '#0D1B4B' : 'white',
                  borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: msg.image_url && !msg.content ? '0.3rem' : '0.7rem 1rem',
                  overflow: 'hidden',
                }}>
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="image"
                      onClick={() => window.open(msg.image_url!, '_blank')}
                      style={{ maxWidth: '220px', maxHeight: '220px', objectFit: 'cover', borderRadius: '14px', display: 'block', cursor: 'pointer' }}
                    />
                  )}
                  {msg.content && (
                    <p style={{ margin: msg.image_url ? '0.4rem 0 0' : 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                      {msg.content}
                    </p>
                  )}
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.62rem', opacity: 0.55, textAlign: 'right' }}>
                    {fmt(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: '0.625rem 0.875rem', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,20,55,0.95)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f) }} />

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: uploading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)', cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}
            title="Envoyer une image"
          >
            {uploading ? '⏳' : '📷'}
          </button>

          <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: '21px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', padding: '0 0.4rem 0 1rem', minHeight: '42px' }}>
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }}
              placeholder="Votre message…"
              style={{ flex: 1, background: 'none', border: 'none', color: 'white', fontSize: '0.9rem', outline: 'none', fontFamily: "'Jost', sans-serif", padding: '0.5rem 0' }}
            />
            <button
              onClick={sendText}
              disabled={sending || !text.trim()}
              style={{
                width: '34px', height: '34px', borderRadius: '50%', border: 'none', flexShrink: 0,
                background: text.trim() ? 'linear-gradient(135deg, #C9A84C, #E8C97A)' : 'rgba(255,255,255,0.08)',
                color: text.trim() ? '#0D1B4B' : 'rgba(255,255,255,0.25)',
                cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem', transition: 'all 0.2s',
              }}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── CONVERSATION LIST ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D1B4B' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem 1.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 300, margin: 0, color: '#C9A84C' }}>
          Messages
        </h1>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>💬</span>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontWeight: 300, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              Aucune conversation
            </p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem', margin: 0 }}>
              Découvrez des profils et envoyez le premier message !
            </p>
          </div>
        ) : (
          conversations.map(conv => (
            <ConvRow key={conv.id} conv={conv} active={conv.id === activeId} onClick={() => openConv(conv.id)} />
          ))
        )}
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function Avatar({ profile, size }: { profile: Profile; size: number }) {
  const initials = `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(201,168,76,0.35)', flexShrink: 0 }}>
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: size * 0.35, color: 'rgba(255,255,255,0.5)' }}>
          {initials || '?'}
        </div>
      )}
    </div>
  )
}

function ConvRow({ conv, active, onClick }: { conv: ConversationWithUser; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const preview = conv.last_message?.image_url ? '📷 Image' : conv.last_message?.content ?? 'Démarrer la conversation'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.875rem 1.25rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        background: active ? 'rgba(201,168,76,0.06)' : hover ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <Avatar profile={conv.other_user} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
          <span style={{ fontWeight: 500, fontSize: '0.92rem', color: 'white' }}>
            {conv.other_user.first_name} {conv.other_user.last_name}
          </span>
          {conv.last_message && (
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem', flexShrink: 0, marginLeft: '0.5rem' }}>
              {fmtDate(conv.last_message.created_at)}
            </span>
          )}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {preview}
        </p>
      </div>
    </div>
  )
}

/* ── Helpers ── */
const fmt = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  return d.toDateString() === today.toDateString()
    ? fmt(iso)
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0D1B4B' }}>
        <p style={{ color: '#C9A84C', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem' }}>Chargement…</p>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  )
}
