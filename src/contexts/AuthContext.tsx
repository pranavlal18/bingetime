// ─── Auth Context ───
// Provides Supabase auth state and methods to the entire app

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null; data: { user: User | null } }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    if (__DEV__) console.log('🔐 [AuthContext] Getting initial session...')
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (__DEV__) console.log('🔐 [AuthContext] Initial session:', {
        user: session?.user?.email ?? null,
        session: !!session,
        error: error?.message ?? null,
      })
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(err => {
        console.error('🔐 [AuthContext] getSession failed:', err)
        setLoading(false)
    })

    // Listen for auth changes
    if (__DEV__) console.log('🔐 [AuthContext] Subscribing to auth state changes...')
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (__DEV__) console.log('🔐 [AuthContext] Auth state changed:', {
        event,
        user: session?.user?.email ?? null,
        session: !!session,
      })
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signUp({ email, password })
    return { error, data: { user: data.user } }
  }

  const signOut = async () => {
    queryClient.clear()
    await AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE')
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}