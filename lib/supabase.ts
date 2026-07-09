import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jkrlhdqalajqmvpaxsis.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_OODH-xqo-A_420my-_RU2Q_6lmD0-qS'

// ⚠️ En production, déplacer dans .env.local :
// NEXT_PUBLIC_SUPABASE_URL=...
// NEXT_PUBLIC_SUPABASE_ANON_KEY=...

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type Profile = {
  id: string
  username: string | null
  first_name: string | null
  last_name: string | null
  bio: string | null
  gender: string
  is_public: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
  // Calculé côté vue (feed_public/feed_male/feed_female) : indique si
  // l'utilisateur connecté (auth.uid()) a déjà liké ce profil.
  is_liked: boolean
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  image_url: string | null
  created_at: string
}

export type Conversation = {
  id: string
  user1_id: string
  user2_id: string
  created_at: string
}

export type ConversationWithUser = Conversation & {
  other_user: Profile
  last_message: Message | null
}
