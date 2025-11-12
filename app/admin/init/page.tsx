'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function AdminInitPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  const initializeSubscription = async (plan: 'FREE_TRIAL' | 'STARTER') => {
    try {
      setLoading(true)
      setResult(null)

      const response = await fetch('/api/admin/init-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'cmhn51bs10000upmjuafsfl2n',
          plan,
        }),
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        toast({
          title: '성공',
          description: `${plan} 구독이 생성되었습니다.`,
        })
      } else {
        toast({
          title: '실패',
          description: data.error || '구독 생성에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Init subscription failed:', error)
      toast({
        title: '오류',
        description: '구독 초기화 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>구독 초기화</CardTitle>
          <CardDescription>park8374@naver.com 계정의 구독을 생성합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => initializeSubscription('FREE_TRIAL')}
              disabled={loading}
              variant="outline"
            >
              {loading ? '처리 중...' : 'FREE_TRIAL (100건)'}
            </Button>
            <Button
              onClick={() => initializeSubscription('STARTER')}
              disabled={loading}
            >
              {loading ? '처리 중...' : 'STARTER (500건)'}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>• FREE_TRIAL: 이메일 100건, 알림 100건 (SMS 불가)</p>
            <p>• STARTER: 이메일 500건, 알림 500건 (SMS/카카오 가능)</p>
          </div>

          {result && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">결과:</h3>
              <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
