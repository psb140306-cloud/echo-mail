'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'

interface AdminAccessState {
  isAdmin: boolean
  isLoading: boolean
  error: string | null
}

export function useAdminAccess() {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<AdminAccessState>({
    isAdmin: false,
    isLoading: true,
    error: null
  })

  useEffect(() => {
    const checkAdminAccess = async () => {
      // 인증 로딩 중이면 대기
      if (authLoading) {
        return
      }

      // 로그인하지 않았으면 false
      if (!user) {
        setState({
          isAdmin: false,
          isLoading: false,
          error: null
        })
        return
      }

      try {
        // API를 통해 권한 확인
        const response = await fetch('/api/admin/check-access')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check admin access')
        }

        setState({
          isAdmin: data.isAdmin,
          isLoading: false,
          error: null
        })

        console.log('[useAdminAccess] Access check result:', {
          email: user.email,
          isAdmin: data.isAdmin
        })
      } catch (error) {
        console.error('[useAdminAccess] Error checking admin access:', error)
        setState({
          isAdmin: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    checkAdminAccess()
  }, [user, authLoading])

  return {
    ...state,
    isCheckingAccess: authLoading || state.isLoading,
    user
  }
}