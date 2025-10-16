'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Session } from '@supabase/supabase-js'
import { logger } from '@/lib/utils/logger'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithGitHub: () => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // 초기 세션 확인
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          logger.error('Failed to get initial session', { error: error.message })
        } else {
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (error) {
        logger.error('Auth initialization error', { error })
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Auth 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug('Auth state changed', { event, userId: session?.user?.id })

      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      // 로그인/로그아웃 시에만 리다이렉트 (새로고침 대신)
      if (event === 'SIGNED_IN') {
        // 현재 페이지가 인증 페이지인 경우에만 대시보드로 리다이렉트
        if (window.location.pathname.startsWith('/auth/')) {
          window.location.href = '/dashboard'
        }
      } else if (event === 'SIGNED_OUT') {
        // 로그아웃 시 로그인 페이지로 리다이렉트
        if (!window.location.pathname.startsWith('/auth/')) {
          window.location.href = '/auth/login'
        }
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [supabase])

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata || {},
        },
      })

      if (error) {
        logger.error('Sign up failed', { error: error.message, email })
        return { error }
      }

      logger.info('User signed up successfully', { email })
      return { error: null }
    } catch (error) {
      const authError = error as Error
      logger.error('Sign up error', { error: authError.message, email })
      return { error: authError }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        logger.error('Sign in failed', { error: error.message, email })
        return { error }
      }

      logger.info('User signed in successfully', { email })
      return { error: null }
    } catch (error) {
      const authError = error as Error
      logger.error('Sign in error', { error: authError.message, email })
      return { error: authError }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()

      if (error) {
        logger.error('Sign out failed', { error: error.message })
        return { error }
      }

      logger.info('User signed out successfully')
      return { error: null }
    } catch (error) {
      const authError = error as Error
      logger.error('Sign out error', { error: authError.message })
      return { error: authError }
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        logger.error('Password reset failed', { error: error.message, email })
        return { error }
      }

      logger.info('Password reset email sent', { email })
      return { error: null }
    } catch (error) {
      const authError = error as Error
      logger.error('Password reset error', { error: authError.message, email })
      return { error: authError }
    }
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Auth 상태에 따른 조건부 렌더링 컴포넌트들
export function AuthGuard({
  children,
  fallback = null,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">로딩중...</div>
  }

  if (!user) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export function GuestGuard({
  children,
  fallback = null,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">로딩중...</div>
  }

  if (user) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
