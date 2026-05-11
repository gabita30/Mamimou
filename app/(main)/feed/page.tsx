'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? '/feed' : '/login')
    })
  }, [router])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0D1B4B' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', fontWeight: 300, color: '#C9A84C', letterSpacing: '0.1em' }}>
        Désirs
      </h1>
    </div>
  )
}
