'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  MapPin,
  Clock,
  ArrowLeft,
  Loader2,
  Calendar,
  Calculator,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface DeliveryRule {
  id: string
  region: string
  morningCutoff: string
  afternoonCutoff: string
  morningDeliveryDays: number
  afternoonDeliveryDays: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface DeliveryCalculation {
  region: string
  orderDateTime: string
}

export default function DeliveryRulesPage() {
  const [deliveryRules, setDeliveryRules] = useState<DeliveryRule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deletingRule, setDeletingRule] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showCalculatorDialog, setShowCalculatorDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<DeliveryRule | null>(null)
  const [calculationResult, setCalculationResult] = useState<any>(null)
  const { toast } = useToast()

  // 폼 상태
  const [formData, setFormData] = useState({
    region: '',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 1,
    afternoonDeliveryDays: 1,
    isActive: true,
  })

  // 납품일 계산 폼
  const [calculationForm, setCalculationForm] = useState({
    region: '',
    orderDateTime: new Date().toISOString().slice(0, 16),
  })

  // 배송 규칙 목록 조회
  const fetchDeliveryRules = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.append('region', searchTerm)

      const response = await fetch(`/api/delivery-rules?${params}`)
      const data = await response.json()

      if (data.success) {
        setDeliveryRules(data.data)
      } else {
        toast({
          title: '오류',
          description: data.error || '배송 규칙을 불러오는데 실패했습니다.',
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

  // 배송 규칙 생성/수정
  const saveDeliveryRule = async () => {
    try {
      const url = editingRule ? `/api/delivery-rules/${editingRule.id}` : '/api/delivery-rules'

      const method = editingRule ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: data.message,
        })

        setShowCreateDialog(false)
        setEditingRule(null)
        resetForm()
        fetchDeliveryRules()
      } else {
        toast({
          title: '오류',
          description: data.error || '배송 규칙 저장에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 배송 규칙 삭제
  const deleteDeliveryRule = async (ruleId: string) => {
    try {
      setDeletingRule(ruleId)

      const response = await fetch(`/api/delivery-rules/${ruleId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: data.message,
        })
        fetchDeliveryRules()
      } else {
        toast({
          title: '오류',
          description: data.error || '배송 규칙 삭제에 실패했습니다.',
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
      setDeletingRule(null)
    }
  }

  // 납품일 계산
  const calculateDeliveryDate = async () => {
    try {
      const response = await fetch('/api/delivery/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(calculationForm),
      })

      const data = await response.json()

      if (data.success) {
        setCalculationResult(data.data)
      } else {
        toast({
          title: '오류',
          description: data.error || '납품일 계산에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setFormData({
      region: '',
      morningCutoff: '12:00',
      afternoonCutoff: '18:00',
      morningDeliveryDays: 1,
      afternoonDeliveryDays: 1,
      isActive: true,
    })
  }

  const openEditDialog = (rule: DeliveryRule) => {
    setEditingRule(rule)
    setFormData({
      region: rule.region,
      morningCutoff: rule.morningCutoff,
      afternoonCutoff: rule.afternoonCutoff,
      morningDeliveryDays: rule.morningDeliveryDays,
      afternoonDeliveryDays: rule.afternoonDeliveryDays,
      isActive: rule.isActive,
    })
    setShowCreateDialog(true)
  }

  // 검색 적용
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDeliveryRules()
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // 초기 데이터 로드
  useEffect(() => {
    fetchDeliveryRules()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">대시보드</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2">
            <h1 className="text-lg font-semibold">배송 규칙 관리</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCalculatorDialog(true)}>
                <Calculator className="mr-2 h-4 w-4" />
                납품일 계산
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />새 규칙 추가
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 규칙</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deliveryRules.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">활성 규칙</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {deliveryRules.filter((r) => r.isActive).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">평균 배송일</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {deliveryRules.length > 0
                  ? Math.round(
                      (deliveryRules.reduce(
                        (sum, r) => sum + (r.morningDeliveryDays + r.afternoonDeliveryDays) / 2,
                        0
                      ) /
                        deliveryRules.length) *
                        10
                    ) / 10
                  : 0}
                일
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>배송 규칙 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="지역으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Delivery Rules Table */}
        <Card>
          <CardHeader>
            <CardTitle>배송 규칙 목록</CardTitle>
            <CardDescription>지역별 배송 규칙을 관리하세요</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : deliveryRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                등록된 배송 규칙이 없습니다.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>지역</TableHead>
                      <TableHead>오전 마감</TableHead>
                      <TableHead>오후 마감</TableHead>
                      <TableHead>오전 배송일</TableHead>
                      <TableHead>오후 배송일</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>등록일</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {rule.region}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.morningCutoff}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.afternoonCutoff}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{rule.morningDeliveryDays}일 후</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{rule.afternoonDeliveryDays}일 후</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(rule.createdAt).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>작업</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEditDialog(rule)}>
                                <Edit className="mr-2 h-4 w-4" />
                                수정
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    삭제
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>배송 규칙 삭제</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      &apos;{rule.region}&apos; 지역의 배송 규칙을 삭제하시겠습니까?
                                      <br />이 작업은 되돌릴 수 없습니다.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteDeliveryRule(rule.id)}
                                      disabled={deletingRule === rule.id}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {deletingRule === rule.id ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="mr-2 h-4 w-4" />
                                      )}
                                      삭제
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingRule ? '배송 규칙 수정' : '새 배송 규칙 추가'}</DialogTitle>
            <DialogDescription>지역별 배송 마감시간과 배송일을 설정하세요</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="region" className="text-right">
                지역
              </Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="col-span-3"
                placeholder="예: 서울"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="morningCutoff" className="text-right">
                오전 마감
              </Label>
              <Input
                id="morningCutoff"
                type="time"
                value={formData.morningCutoff}
                onChange={(e) => setFormData({ ...formData, morningCutoff: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="afternoonCutoff" className="text-right">
                오후 마감
              </Label>
              <Input
                id="afternoonCutoff"
                type="time"
                value={formData.afternoonCutoff}
                onChange={(e) => setFormData({ ...formData, afternoonCutoff: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="morningDeliveryDays" className="text-right">
                오전 배송일
              </Label>
              <Input
                id="morningDeliveryDays"
                type="number"
                min="0"
                max="14"
                value={formData.morningDeliveryDays}
                onChange={(e) =>
                  setFormData({ ...formData, morningDeliveryDays: parseInt(e.target.value) })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="afternoonDeliveryDays" className="text-right">
                오후 배송일
              </Label>
              <Input
                id="afternoonDeliveryDays"
                type="number"
                min="0"
                max="14"
                value={formData.afternoonDeliveryDays}
                onChange={(e) =>
                  setFormData({ ...formData, afternoonDeliveryDays: parseInt(e.target.value) })
                }
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setEditingRule(null)
                resetForm()
              }}
            >
              취소
            </Button>
            <Button onClick={saveDeliveryRule}>{editingRule ? '수정' : '생성'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Calculator Dialog */}
      <Dialog open={showCalculatorDialog} onOpenChange={setShowCalculatorDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>납품일 계산기</DialogTitle>
            <DialogDescription>주문 정보를 입력하여 정확한 납품일을 계산하세요</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="calcRegion" className="text-right">
                지역
              </Label>
              <select
                id="calcRegion"
                value={calculationForm.region}
                onChange={(e) => setCalculationForm({ ...calculationForm, region: e.target.value })}
                className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="">지역 선택</option>
                {deliveryRules
                  .filter((r) => r.isActive)
                  .map((rule) => (
                    <option key={rule.id} value={rule.region}>
                      {rule.region}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="orderDateTime" className="text-right">
                주문일시
              </Label>
              <Input
                id="orderDateTime"
                type="datetime-local"
                value={calculationForm.orderDateTime}
                onChange={(e) =>
                  setCalculationForm({ ...calculationForm, orderDateTime: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="flex justify-center pt-2">
              <Button onClick={calculateDeliveryDate} disabled={!calculationForm.region}>
                <Calculator className="mr-2 h-4 w-4" />
                계산하기
              </Button>
            </div>

            {calculationResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">계산 결과</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">납품일:</span> {calculationResult.deliveryDateKR}
                  </p>
                  <p>
                    <span className="font-medium">배송시간:</span>{' '}
                    {calculationResult.deliveryTimeKR}
                  </p>
                  <p>
                    <span className="font-medium">소요일:</span>{' '}
                    {calculationResult.businessDaysUsed}영업일
                  </p>
                  <p>
                    <span className="font-medium">지역:</span> {calculationResult.rule.region}
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCalculatorDialog(false)
                setCalculationResult(null)
              }}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
