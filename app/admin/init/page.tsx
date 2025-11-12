'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function AdminInitPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  const initializeSubscription = async () => {
    try {
      setLoading(true)
      setResult(null)

      const response = await fetch('/api/admin/init-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'cmhn51bs10000upmjuafsfl2n' }),
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        toast({
          title: '성공',
          description: 'FREE_TRIAL 구독이 생성되었습니다.',
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
          <CardDescription>FREE_TRIAL 구독을 생성합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={initializeSubscription} disabled={loading} className="w-full">
            {loading ? '처리 중...' : 'FREE_TRIAL 구독 생성'}
          </Button>

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
