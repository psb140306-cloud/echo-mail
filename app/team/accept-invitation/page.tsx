'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

interface InvitationData {
  id: string
  email: string
  role: string
  tenantName: string
  inviterName: string
  expiresAt: string
}

export default function AcceptInvitationPage() {
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setError('유효하지 않은 초대 링크입니다.')
      setLoading(false)
      return
    }

    fetchInvitation()
  }, [token])

  const fetchInvitation = async () => {
    try {
      const response = await fetch(`/api/team/invitations/validate?token=${token}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '초대 정보를 불러올 수 없습니다.')
      }

      setInvitation(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대 정보를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const acceptInvitation = async () => {
    if (!token) return

    setAccepting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // 로그인이 필요한 경우
        router.push(`/auth/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      }

      const response = await fetch('/api/team/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '초대 수락 중 오류가 발생했습니다.')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대 수락 중 오류가 발생했습니다.')
    } finally {
      setAccepting(false)
    }
  }

  const declineInvitation = async () => {
    if (!token) return

    try {
      const response = await fetch('/api/team/invitations/decline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      if (response.ok) {
        router.push('/')
      }
    } catch (err) {
      console.error('초대 거절 중 오류:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">초대 정보를 확인하고 있습니다...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle>초대 수락 완료!</CardTitle>
            <CardDescription>
              팀에 성공적으로 참여했습니다. 대시보드로 이동합니다...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle>초대 확인 실패</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => router.push('/')} variant="outline">
              홈으로 돌아가기
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const roleNames: Record<string, string> = {
    ADMIN: '관리자',
    MANAGER: '매니저',
    OPERATOR: '운영자',
    VIEWER: '뷰어',
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>팀 초대</CardTitle>
          <CardDescription>
            {invitation.tenantName} 팀에서 초대했습니다
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">초대받은 이메일:</span>
              <span>{invitation.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">역할:</span>
              <span className="font-medium text-blue-600">
                {roleNames[invitation.role] || invitation.role}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">초대자:</span>
              <span>{invitation.inviterName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">만료일:</span>
              <span>{new Date(invitation.expiresAt).toLocaleDateString('ko-KR')}</span>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <h4 className="font-medium mb-2">역할 권한:</h4>
            <ul className="space-y-1 text-sm">
              {invitation.role === 'ADMIN' && (
                <>
                  <li>• 모든 설정 관리</li>
                  <li>• 팀 멤버 관리</li>
                  <li>• 결제 및 구독 관리</li>
                </>
              )}
              {invitation.role === 'MANAGER' && (
                <>
                  <li>• 이메일 관리</li>
                  <li>• 알림 설정</li>
                  <li>• 보고서 조회</li>
                </>
              )}
              {invitation.role === 'OPERATOR' && (
                <>
                  <li>• 이메일 처리</li>
                  <li>• 기본 설정 관리</li>
                </>
              )}
              {invitation.role === 'VIEWER' && (
                <>
                  <li>• 대시보드 조회</li>
                  <li>• 보고서 조회</li>
                </>
              )}
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            onClick={declineInvitation}
            variant="outline"
            className="flex-1"
          >
            거절
          </Button>
          <Button
            onClick={acceptInvitation}
            disabled={accepting}
            className="flex-1"
          >
            {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            수락
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}