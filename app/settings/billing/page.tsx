'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  CreditCard,
  Plus,
  Download,
  Mail,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface PaymentMethod {
  id: string
  type: 'CARD'
  last4: string
  brand: string
  expiryMonth: number
  expiryYear: number
  isDefault: boolean
  createdAt: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'FAILED'
  amount: number
  currency: string
  dueDate: string
  paidAt?: string
  createdAt: string
}

interface SubscriptionInfo {
  plan: string
  status: string
  nextBillingDate: string
  amount: number
}

export default function BillingPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // 데이터 로딩
  useEffect(() => {
    loadBillingData()
  }, [])

  const loadBillingData = async () => {
    try {
      setLoading(true)

      const [paymentMethodsRes, invoicesRes, subscriptionRes] = await Promise.all([
        fetch('/api/billing/payment-methods'),
        fetch('/api/billing/invoices'),
        fetch('/api/subscription'),
      ])

      if (paymentMethodsRes.ok) {
        const data = await paymentMethodsRes.json()
        setPaymentMethods(data.data || [])
      }

      if (invoicesRes.ok) {
        const data = await invoicesRes.json()
        setInvoices(data.data || [])
      }

      if (subscriptionRes.ok) {
        const data = await subscriptionRes.json()
        setSubscription(data.data)
      }
    } catch (error) {
      console.error('Failed to load billing data:', error)
      toast({
        title: '오류',
        description: '빌링 정보를 불러오는데 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // 결제 수단 추가
  const addPaymentMethod = async () => {
    try {
      setActionLoading('add-payment')

      // 토스페이먼츠 결제 위젯 연동
      const response = await fetch('/api/billing/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (data.success) {
        // 토스페이먼츠 위젯 URL로 리다이렉트
        window.location.href = data.widgetUrl
      } else {
        toast({
          title: '오류',
          description: data.error || '결제 수단 추가에 실패했습니다.',
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
      setActionLoading(null)
    }
  }

  // 결제 수단 삭제
  const deletePaymentMethod = async (methodId: string) => {
    try {
      setActionLoading(`delete-${methodId}`)

      const response = await fetch(`/api/billing/payment-methods/${methodId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '결제 수단이 삭제되었습니다.',
        })
        loadBillingData()
      } else {
        toast({
          title: '오류',
          description: data.error || '결제 수단 삭제에 실패했습니다.',
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
      setActionLoading(null)
    }
  }

  // 기본 결제 수단 설정
  const setDefaultPaymentMethod = async (methodId: string) => {
    try {
      setActionLoading(`default-${methodId}`)

      const response = await fetch(`/api/billing/payment-methods/${methodId}/default`, {
        method: 'PUT',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '기본 결제 수단이 변경되었습니다.',
        })
        loadBillingData()
      } else {
        toast({
          title: '오류',
          description: data.error || '기본 결제 수단 변경에 실패했습니다.',
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
      setActionLoading(null)
    }
  }

  // 인보이스 다운로드
  const downloadInvoice = async (invoiceId: string) => {
    try {
      setActionLoading(`download-${invoiceId}`)

      const response = await fetch(`/api/invoices/${invoiceId}/download`)

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${invoiceId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        toast({
          title: '오류',
          description: '인보이스 다운로드에 실패했습니다.',
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
      setActionLoading(null)
    }
  }

  // 인보이스 이메일 발송
  const sendInvoiceEmail = async (invoiceId: string) => {
    try {
      setActionLoading(`email-${invoiceId}`)

      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientEmail: user?.email,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '인보이스 이메일이 발송되었습니다.',
        })
      } else {
        toast({
          title: '오류',
          description: data.error || '이메일 발송에 실패했습니다.',
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
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-green-100 text-green-800">결제완료</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800">결제대기</Badge>
      case 'OVERDUE':
        return <Badge className="bg-red-100 text-red-800">연체</Badge>
      case 'FAILED':
        return <Badge className="bg-gray-100 text-gray-800">실패</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'OVERDUE':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

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
          <h1 className="text-lg font-semibold">결제 및 빌링</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {/* 구독 정보 */}
        {subscription && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>현재 구독</CardTitle>
              <CardDescription>현재 이용 중인 플랜 정보입니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{subscription.plan}</p>
                  <p className="text-sm text-muted-foreground">
                    다음 결제일: {subscription.nextBillingDate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">₩{subscription.amount.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">월 결제</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* 결제 수단 관리 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>결제 수단</CardTitle>
                <CardDescription>등록된 결제 수단을 관리하세요</CardDescription>
              </div>
              <Button size="sm" onClick={addPaymentMethod} disabled={!!actionLoading}>
                {actionLoading === 'add-payment' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                추가
              </Button>
            </CardHeader>
            <CardContent>
              {paymentMethods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  등록된 결제 수단이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <CreditCard className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium">
                            •••• •••• •••• {method.last4}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {method.brand} • {method.expiryMonth.toString().padStart(2, '0')}/
                            {method.expiryYear.toString().slice(-2)}
                          </p>
                        </div>
                        {method.isDefault && (
                          <Badge variant="secondary">기본</Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {!method.isDefault && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDefaultPaymentMethod(method.id)}
                            disabled={actionLoading === `default-${method.id}`}
                          >
                            {actionLoading === `default-${method.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              '기본 설정'
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deletePaymentMethod(method.id)}
                          disabled={actionLoading === `delete-${method.id}`}
                        >
                          {actionLoading === `delete-${method.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 최근 인보이스 */}
          <Card>
            <CardHeader>
              <CardTitle>최근 인보이스</CardTitle>
              <CardDescription>최근 결제 내역을 확인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  인보이스가 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {invoices.slice(0, 5).map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(invoice.status)}
                        <div>
                          <p className="font-medium">#{invoice.invoiceNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(invoice.createdAt).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="font-medium">₩{invoice.amount.toLocaleString()}</p>
                          {getStatusBadge(invoice.status)}
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadInvoice(invoice.id)}
                            disabled={actionLoading === `download-${invoice.id}`}
                          >
                            {actionLoading === `download-${invoice.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => sendInvoiceEmail(invoice.id)}
                            disabled={actionLoading === `email-${invoice.id}`}
                          >
                            {actionLoading === `email-${invoice.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {invoices.length > 5 && (
                <div className="text-center mt-4">
                  <Button variant="outline" size="sm">
                    전체 인보이스 보기
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 전체 인보이스 테이블 */}
        {invoices.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>전체 결제 내역</CardTitle>
              <CardDescription>모든 인보이스와 결제 내역입니다</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>인보이스</TableHead>
                    <TableHead>금액</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>발행일</TableHead>
                    <TableHead>만료일</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        #{invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>₩{invoice.amount.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        {new Date(invoice.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.dueDate).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadInvoice(invoice.id)}
                            disabled={actionLoading === `download-${invoice.id}`}
                          >
                            {actionLoading === `download-${invoice.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => sendInvoiceEmail(invoice.id)}
                            disabled={actionLoading === `email-${invoice.id}`}
                          >
                            {actionLoading === `email-${invoice.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}