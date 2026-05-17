import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

interface UserProfile {
  user_id: string
  email: string
  full_name: string
  username: string
  role: 'choreographer' | 'dancer'
  created_at: string
}

interface AuthContextValue {
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  profileError: string | null
  signUp: (email: string, password: string, fullName: string, username: string, role: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  async function fetchProfile() {
    try {
      const res = await api.get('/users/me')
      setProfile(res.data)
      setProfileError(null)
    } catch (err: unknown) {
      setProfile(null)
      const msg = err instanceof Error ? err.message : String(err)
      // Extract the detail from axios error response
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setProfileError(detail || msg || 'Could not load profile')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) fetchProfile().finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) fetchProfile()
      else { setProfile(null); setProfileError(null) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string, fullName: string, username: string, role: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, username, role } },
    })
    if (error) throw error

    // Explicitly create the profile via the API — reliable regardless of trigger state.
    // The backend upserts, so it's safe to call even if the trigger already ran.
    if (data.user) {
      await api.post('/users', {
        user_id: data.user.id,
        email,
        full_name: fullName,
        username,
        role,
      })
    }

    await fetchProfile()
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    // Try to fetch the profile; if it's missing (404), create it from auth metadata
    try {
      const res = await api.get('/users/me')
      setProfile(res.data)
      setProfileError(null)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404 && data.user) {
        const meta = data.user.user_metadata ?? {}
        await api.post('/users', {
          user_id: data.user.id,
          email: data.user.email,
          full_name: meta.full_name ?? '',
          username: meta.username ?? '',
          role: meta.role ?? 'dancer',
        })
        await fetchProfile()
      } else {
        throw err
      }
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
    setProfileError(null)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, profileError, signUp, signIn, signOut, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
