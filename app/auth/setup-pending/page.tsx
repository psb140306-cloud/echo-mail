'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { WordMarkLink } from '@/components/ui/wordmark-link'
import { useRouter } from 'next/navigation'

type SetupStatus = 'checking' | 'creating' | 'ready' | 'failed' | 'timeout'

interface SetupProgress {
  status: SetupStatus
  progress: number
  message: string
  step: string
}

export default function SetupPendingPage() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [setupProgress, setSetupProgress] = useState<SetupProgress>({
    status: 'checking',
    progress: 10,
    message: '계정 상태를 확인하고 있습니다...',
    step: '초기화',
  })
  const [attempts, setAttempts] = useState(0)
  const [isManualSetup, setIsManualSetup] = useState(false)

  const maxAttempts = 30 // 30초 (1초마다 폴링)
  const pollInterval = 1000 // 1초

  // Tenant 상태 체크
  const checkTenantStatus = async () => {
    try {
      const response = await fetch('/api/auth/check-tenant-status')
      const result = await response.json()

      if (result.success && result.data) {
        if (result.data.isReady && result.data.hasTenant) {
          // ✅ Tenant 준비 완료
          setSetupProgress({
            status: 'ready',
            progress: 100,
            message: '준비 완료! 대시보드로 이동합니다...',
            step: '완료',
          })

          // 대시보드로 리다이렉트
          setTimeout(() => {
            router.push('/dashboard')
          }, 1000)

          return true
        } else {
          // ⏳ 아직 준비 중
          const currentProgress = Math.min(10 + (attempts * 3), 90)
          setSetupProgress({
            status: 'creating',
            progress: currentProgress,
            message: result.data.message || '작업 공간을 준비하고 있습니다...',
            step: '진행 중',
          })

          return false
        }
      } else {
        throw new Error(result.error || 'Status check failed')
      }
    } catch (error) {
      console.error('Failed to check tenant status:', error)
      return false
    }
  }

  // 수동 설정 실행
  const handleManualSetup = async () => {
    setIsManualSetup(true)
    setSetupProgress({
      status: 'creating',
      progress: 30,
      message: '작업 공간을 수동으로 생성하고 있습니다...',
      step: '수동 생성',
    })

    try {
      const response = await fetch('/api/auth/setup-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: user?.email?.split('@')[0] + '의 회사',
          ownerName: user?.email?.split('@')[0] || '사용자',
          subscriptionPlan: 'FREE_TRIAL',
          subdomain: user?.email?.split('@')[0]?.replace(/[^a-zA-Z0-9-]/g, '') || 'my-company',
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '작업 공간 생성 완료',
          description: '대시보드로 이동합니다.',
        })

        setSetupProgress({
          status: 'ready',
          progress: 100,
          message: '완료! 대시보드로 이동합니다...',
          step: '완료',
        })

        setTimeout(() => {
          router.push('/dashboard')
        }, 1000)
      } else {
        throw new Error(result.message || 'Setup failed')
      }
    } catch (error) {
      console.error('Manual setup failed:', error)

      setSetupProgress({
        status: 'failed',
        progress: 0,
        message: '작업 공간 생성에 실패했습니다.',
        step: '실패',
      })

      toast({
        title: '설정 실패',
        description: error instanceof Error ? error.message : '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setIsManualSetup(false)
    }
  }

  // 로그아웃 처리
  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  // 자동 테넌트 생성 및 폴링
  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    let isMounted = true

    const initSetup = async () => {
      // 1. 먼저 테넌트가 이미 있는지 확인
      const isReady = await checkTenantStatus()
      if (isReady || !isMounted) return

      // 2. 테넌트가 없으면 자동 생성 시도
      setSetupProgress({
        status: 'creating',
        progress: 30,
        message: '작업 공간을 자동으로 생성하고 있습니다...',
        step: '생성 중',
      })

      try {
        const response = await fetch('/api/auth/setup-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: user.email?.split('@')[0] + '의 회사',
            ownerName: user.email?.split('@')[0] || '사용자',
            subscriptionPlan: 'FREE_TRIAL',
            subdomain: user.email?.split('@')[0]?.replace(/[^a-zA-Z0-9-]/g, '') || 'my-company',
          }),
        })

        if (!isMounted) return

        const result = await response.json()

        if (result.success) {
          setSetupProgress({
            status: 'ready',
            progress: 100,
            message: '완료! 대시보드로 이동합니다...',
            step: '완료',
          })

          setTimeout(() => {
            if (isMounted) router.push('/dashboard')
          }, 1000)
          return
        } else {
          throw new Error(result.message || 'Setup failed')
        }
      } catch (error) {
        console.error('Auto setup failed:', error)
        if (!isMounted) return

        // 자동 생성 실패 시 폴링으로 전환
        setSetupProgress({
          status: 'creating',
          progress: 40,
          message: '작업 공간을 확인하고 있습니다...',
          step: '확인 중',
        })
      }
    }

    initSetup()

    // 주기적 폴링 (자동 생성 후 확인용)
    const interval = setInterval(async () => {
      if (!isMounted) return

      const ready = await checkTenantStatus()

      if (ready) {
        clearInterval(interval)
        return
      }

      setAttempts((prev) => {
        const newAttempts = prev + 1

        // 타임아웃 체크
        if (newAttempts >= maxAttempts) {
          clearInterval(interval)
          setSetupProgress({
            status: 'timeout',
            progress: 0,
            message: '작업 공간 생성이 지연되고 있습니다.',
            step: '타임아웃',
          })
        }

        return newAttempts
      })
    }, pollInterval)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [user, router])

  if (!user) {
    return null // 로그인 페이지로 리다이렉트 중
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">작업 공간 준비 중</CardTitle>
          <CardDescription className="text-base">
            {user.email}님의 작업 공간을 설정하고 있습니다
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 진행 상황 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{setupProgress.step}</span>
              <span className="text-muted-foreground">{setupProgress.progress}%</span>
            </div>

            <Progress value={setupProgress.progress} className="h-2" />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {setupProgress.status === 'checking' || setupProgress.status === 'creating' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{setupProgress.message}</span>
                </>
              ) : setupProgress.status === 'ready' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>{setupProgress.message}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>{setupProgress.message}</span>
                </>
              )}
            </div>
          </div>

          {/* 타임아웃 또는 실패 시 */}
          {(setupProgress.status === 'timeout' || setupProgress.status === 'failed') && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                자동 설정이 지연되고 있습니다. 수동으로 완료하거나 고객 지원팀에 문의해주세요.
              </AlertDescription>
            </Alert>
          )}

          {/* 액션 버튼 */}
          <div className="space-y-2">
            {setupProgress.status === 'timeout' || setupProgress.status === 'failed' ? (
              <>
                <Button
                  onClick={handleManualSetup}
                  disabled={isManualSetup}
                  className="w-full"
                >
                  {isManualSetup ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      수동으로 완료하기
                    </>
                  )}
                </Button>

                <Button onClick={handleSignOut} variant="outline" className="w-full">
                  로그아웃
                </Button>
              </>
            ) : (
              <Button onClick={handleSignOut} variant="ghost" className="w-full">
                취소
              </Button>
            )}
          </div>

          {/* 시간 경과 표시 */}
          <div className="text-center text-xs text-muted-foreground">
            경과 시간: {attempts}초 / {maxAttempts}초
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
