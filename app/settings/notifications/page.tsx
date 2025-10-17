'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft,
  Phone,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Shield,
  Info,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface SenderPhoneStatus {
  phoneNumber: string | null
  verified: boolean
  verifiedAt: string | null
  status?: string
}

export default function NotificationsSettingsPage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [status, setStatus] = useState<SenderPhoneStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [checking, setChecking] = useState(false)
  const { toast } = useToast()

  // 발신번호 상태 조회
  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/sender-phone')
      const data = await response.json()

      if (data.success && data.data.senderPhone) {
        setStatus({
          phoneNumber: data.data.senderPhone,
          verified: data.data.senderVerified,
          verifiedAt: data.data.senderVerifiedAt,
        })
        setPhoneNumber(data.data.senderPhone)
      }
    } catch (error) {
      console.error('발신번호 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  // 발신번호 등록
  const handleRegister = async () => {
    if (!phoneNumber) {
      toast({
        title: '입력 오류',
        description: '전화번호를 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    // 전화번호 형식 검증
    const normalizedPhone = phoneNumber.replace(/-/g, '')
    if (!/^01[0-9]{8,9}$/.test(normalizedPhone)) {
      toast({
        title: '입력 오류',
        description: '올바른 휴대폰 번호 형식이 아닙니다. (010-XXXX-XXXX)',
        variant: 'destructive',
      })
      return
    }

    try {
      setRegistering(true)

      const response = await fetch('/api/settings/sender-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '등록 성공',
          description: data.message || '발신번호가 등록되었습니다.',
        })

        // 상태 다시 조회
        await fetchStatus()
      } else {
        toast({
          title: '등록 실패',
          description: data.error || '발신번호 등록에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setRegistering(false)
    }
  }

  // 인증 상태 확인
  const handleCheckStatus = async () => {
    try {
      setChecking(true)

      const response = await fetch('/api/settings/sender-phone?action=check')
      const data = await response.json()

      if (data.success) {
        setStatus({
          phoneNumber: data.data.phoneNumber,
          verified: data.data.verified,
          verifiedAt: null,
          status: data.data.status,
        })

        if (data.data.verified) {
          toast({
            title: '인증 완료',
            description: '발신번호가 승인되었습니다!',
          })
        } else {
          toast({
            title: '승인 대기 중',
            description: `현재 상태: ${data.data.status}`,
          })
        }
      } else {
        toast({
          title: '조회 실패',
          description: data.error || '상태 확인에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/40 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/settings" className="mr-6 flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">설정</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2">
            <h1 className="text-lg font-semibold">알림 설정</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-3xl py-6 space-y-6">
        {/* 발신번호 등록 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  SMS 발신번호 등록
                </CardTitle>
                <CardDescription className="mt-2">
                  SMS 알림을 발송할 때 사용할 발신번호를 등록하세요.
                  <br />
                  등록 후 NCP에서 승인이 필요합니다.
                </CardDescription>
              </div>
              {status?.verified && (
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  인증 완료
                </Badge>
              )}
              {status?.phoneNumber && !status?.verified && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  승인 대기
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 현재 등록된 발신번호 */}
            {status?.phoneNumber && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">현재 등록된 발신번호: {status.phoneNumber}</p>
                    {status.verified ? (
                      <p className="text-sm text-muted-foreground">
                        ✅ 인증 완료 - SMS 발송 가능
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        ⏳ NCP 승인 대기 중 - 승인 후 SMS 발송 가능
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* 발신번호 입력 */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">
                발신번호 <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="010-1234-5678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={registering}
                />
                <Button onClick={handleRegister} disabled={registering || !phoneNumber}>
                  {registering ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      등록
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                본인 명의의 휴대폰 번호를 입력하세요. NCP에서 본인 인증이 필요합니다.
              </p>
            </div>

            {/* 인증 상태 확인 */}
            {status?.phoneNumber && !status?.verified && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCheckStatus}
                  disabled={checking}
                  className="w-full"
                >
                  {checking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      확인 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      승인 상태 확인
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  NCP 콘솔에서 발신번호를 승인한 후 이 버튼을 클릭하세요.
                </p>
              </div>
            )}

            {/* 안내사항 */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">📋 발신번호 등록 절차</p>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>본인 명의의 휴대폰 번호 입력 후 &quot;등록&quot; 클릭</li>
                  <li>NCP 콘솔 &gt; SMS &gt; 발신번호 메뉴 접속</li>
                  <li>등록된 번호에 대해 본인 인증 (ARS 또는 SMS)</li>
                  <li>승인 완료 후 &quot;승인 상태 확인&quot; 버튼 클릭</li>
                  <li>인증 완료되면 SMS 발송 가능</li>
                </ol>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* 알림 발송 테스트 (향후 추가 예정) */}
        <Card>
          <CardHeader>
            <CardTitle>알림 발송 테스트</CardTitle>
            <CardDescription>설정된 발신번호로 테스트 SMS를 발송해보세요</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <p className="text-sm">
                  🚧 이 기능은 곧 추가될 예정입니다.
                  <br />
                  발신번호 인증이 완료되면 테스트 SMS를 발송할 수 있습니다.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
