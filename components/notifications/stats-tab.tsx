'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, TrendingUp, TrendingDown, MessageCircle, Send, CheckCircle, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface DailyStats {
  date: string
  sms: number
  kakao: number
  total: number
  success: number
  failed: number
}

interface StatsData {
  period: string
  summary: {
    total: number
    success: number
    failed: number
    pending: number
    successRate: number
  }
  byType: {
    sms: number
    kakaoAlimtalk: number
    kakaoFriendtalk: number
  }
  daily: DailyStats[]
  topCompanies: Array<{
    companyId: string
    companyName: string
    count: number
  }>
}

export function StatsTab() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7days')
  const { toast } = useToast()

  const fetchStats = async (selectedPeriod: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/notifications/stats?period=${selectedPeriod}`)
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      } else {
        toast({
          title: '오류',
          description: data.error || '통계를 불러오는데 실패했습니다.',
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
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats(period)
  }, [period])

  const handlePeriodChange = (value: string) => {
    setPeriod(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        통계 데이터를 불러올 수 없습니다.
      </div>
    )
  }

  const getPeriodLabel = (p: string) => {
    switch (p) {
      case '7days':
        return '최근 7일'
      case '30days':
        return '최근 30일'
      case 'thisMonth':
        return '이번 달'
      default:
        return p
    }
  }

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">발송 통계</h3>
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="기간 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">최근 7일</SelectItem>
            <SelectItem value="30days">최근 30일</SelectItem>
            <SelectItem value="thisMonth">이번 달</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 발송</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.summary.total.toLocaleString()}건</div>
            <p className="text-xs text-muted-foreground">{getPeriodLabel(period)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">성공</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.summary.success.toLocaleString()}건
            </div>
            <p className="text-xs text-muted-foreground">
              성공률 {stats.summary.successRate}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">실패</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.summary.failed.toLocaleString()}건
            </div>
            <p className="text-xs text-muted-foreground">재시도 필요</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">대기중</CardTitle>
            <MessageCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.summary.pending.toLocaleString()}건
            </div>
            <p className="text-xs text-muted-foreground">발송 대기</p>
          </CardContent>
        </Card>
      </div>

      {/* 타입별 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>채널별 발송 현황</CardTitle>
          <CardDescription>{getPeriodLabel(period)} 기준</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">SMS</p>
                <p className="text-2xl font-bold">{stats.byType.sms.toLocaleString()}건</p>
              </div>
              <Badge variant="secondary">SMS</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">카카오 알림톡</p>
                <p className="text-2xl font-bold">{stats.byType.kakaoAlimtalk.toLocaleString()}건</p>
              </div>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">알림톡</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">카카오 친구톡</p>
                <p className="text-2xl font-bold">{stats.byType.kakaoFriendtalk.toLocaleString()}건</p>
              </div>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">친구톡</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 일별 추이 */}
      <Card>
        <CardHeader>
          <CardTitle>일별 발송 추이</CardTitle>
          <CardDescription>일자별 발송 건수</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead className="text-right">SMS</TableHead>
                  <TableHead className="text-right">카카오</TableHead>
                  <TableHead className="text-right">성공</TableHead>
                  <TableHead className="text-right">실패</TableHead>
                  <TableHead className="text-right">합계</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.daily.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      발송 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.daily.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">{day.date}</TableCell>
                      <TableCell className="text-right">{day.sms}</TableCell>
                      <TableCell className="text-right">{day.kakao}</TableCell>
                      <TableCell className="text-right text-green-600">{day.success}</TableCell>
                      <TableCell className="text-right text-red-600">{day.failed}</TableCell>
                      <TableCell className="text-right font-semibold">{day.total}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 업체별 발송 현황 */}
      {stats.topCompanies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>업체별 발송 현황</CardTitle>
            <CardDescription>발송 건수 상위 10개 업체</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>순위</TableHead>
                  <TableHead>업체명</TableHead>
                  <TableHead className="text-right">발송 건수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topCompanies.map((company, index) => (
                  <TableRow key={company.companyId}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{company.companyName}</TableCell>
                    <TableCell className="text-right">{company.count}건</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
