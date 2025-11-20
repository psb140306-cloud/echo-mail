'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  HelpCircle,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DeliveryRule {
  id: string
  region: string
  cutoffTime: string
  beforeCutoffDays: number
  afterCutoffDays: number
  beforeCutoffDeliveryTime: string
  afterCutoffDeliveryTime: string
  workingDays: string[]
  customClosedDates: string[]
  excludeHolidays: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface DeliveryCalculation {
  region: string
  orderDateTime: string
}

// 기본 지역 목록
const DEFAULT_REGIONS = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
] as const

export default function DeliveryRulesPage() {
  const [deliveryRules, setDeliveryRules] = useState<DeliveryRule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deletingRule, setDeletingRule] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showCalculatorDialog, setShowCalculatorDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<DeliveryRule | null>(null)
  const [calculationResult, setCalculationResult] = useState<any>(null)
  const [generatingSampleData, setGeneratingSampleData] = useState(false)
  const [isCustomRegion, setIsCustomRegion] = useState(false) // 커스텀 지역 입력 여부
  const [allRegions, setAllRegions] = useState<string[]>([...DEFAULT_REGIONS]) // 기본 + 커스텀 지역
  const { toast } = useToast()

  // 폼 상태
  const [formData, setFormData] = useState({
    region: '',
    cutoffTime: '12:00',
    beforeCutoffDays: 1,
    afterCutoffDays: 2,
    beforeCutoffDeliveryTime: '오전',
    afterCutoffDeliveryTime: '오후',
    workingDays: ['1', '2', '3', '4', '5'], // 월~금 기본값
    customClosedDates: [] as string[],
    excludeHolidays: true,
    isActive: true,
  })

  // 커스텀 휴무일 입력 (임시)
  const [newClosedDate, setNewClosedDate] = useState('')

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
      cutoffTime: '12:00',
      beforeCutoffDays: 1,
      afterCutoffDays: 2,
      beforeCutoffDeliveryTime: '오전',
      afterCutoffDeliveryTime: '오후',
      workingDays: ['1', '2', '3', '4', '5'],
      customClosedDates: [],
      excludeHolidays: true,
      isActive: true,
    })
    setNewClosedDate('')
    setIsCustomRegion(false) // 커스텀 입력 모드 해제
  }

  const openEditDialog = (rule: DeliveryRule) => {
    setEditingRule(rule)
    setFormData({
      region: rule.region,
      cutoffTime: rule.cutoffTime,
      beforeCutoffDays: rule.beforeCutoffDays,
      afterCutoffDays: rule.afterCutoffDays,
      beforeCutoffDeliveryTime: rule.beforeCutoffDeliveryTime || '오전',
      afterCutoffDeliveryTime: rule.afterCutoffDeliveryTime || '오후',
      workingDays: rule.workingDays || ['1', '2', '3', '4', '5'],
      customClosedDates: rule.customClosedDates || [],
      excludeHolidays: rule.excludeHolidays ?? true,
      isActive: rule.isActive,
    })
    // 수정 시에는 기존 지역이 목록에 없으면 커스텀으로 간주
    const isCustom = !allRegions.includes(rule.region)
    setIsCustomRegion(isCustom)
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
    fetchRegions()
  }, [])

  // 지역 목록 조회
  const fetchRegions = async () => {
    try {
      const response = await fetch('/api/regions')
      const data = await response.json()
      if (data.success) {
        setAllRegions(data.data.allRegions)
      }
    } catch (error) {
      console.error('Failed to fetch regions:', error)
    }
  }

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
            <TooltipProvider>
              <div className="flex gap-2">
                <div className="flex items-center gap-1">
                  <Button variant="outline" onClick={() => setShowCalculatorDialog(true)}>
                    <Calculator className="mr-2 h-4 w-4" />
                    납품일 계산
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground">
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">📋 납품일 계산기 사용 방법</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>먼저 배송 규칙을 등록하세요</li>
                          <li>등록된 지역이 자동으로 선택 가능합니다</li>
                          <li>지역과 주문일시를 입력하여 정확한 납품일을 계산합니다</li>
                        </ol>
                        <p className="text-xs text-muted-foreground">✅ 활성 상태의 배송 규칙만 표시됩니다</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-1">
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />새 규칙 추가
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground">
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">📦 배송 규칙 등록 방법</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>배송할 지역명을 입력하세요</li>
                          <li>오전/오후 주문 마감 시간을 설정하세요</li>
                          <li>각 시간대별 배송 소요일을 입력하세요</li>
                        </ol>
                        <p className="text-xs text-muted-foreground">💡 등록된 규칙은 납품일 계산기에서 사용됩니다</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </TooltipProvider>
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
                        (sum, r) => sum + (r.beforeCutoffDays + r.afterCutoffDays) / 2,
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
              <div className="text-center py-12 px-4">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="flex justify-center">
                    <div className="rounded-full bg-blue-50 p-3">
                      <MapPin className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">배송 규칙이 없습니다</h3>
                    <p className="text-sm text-muted-foreground">
                      배송 규칙을 등록하면 지역별 납품일을 자동으로 계산할 수 있습니다.
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-left">
                    <p className="text-sm font-medium text-blue-900">시작하는 방법:</p>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>우측 상단의 &quot;새 규칙 추가&quot; 버튼을 클릭하세요</li>
                      <li>배송할 지역명을 입력하세요 (예: 서울, 경기, 부산)</li>
                      <li>오전/오후 주문 마감 시간을 설정하세요</li>
                      <li>각 시간대별 배송 소요일을 입력하세요</li>
                    </ol>
                  </div>
                  <div className="flex justify-center gap-2 pt-2">
                    <Button onClick={() => setShowCreateDialog(true)} size="lg">
                      <Plus className="mr-2 h-4 w-4" />
                      첫 배송 규칙 만들기
                    </Button>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                      빠른 시작을 위한 샘플 데이터를 생성하시겠습니까?
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={generatingSampleData}
                      onClick={async () => {
                        try {
                          setGeneratingSampleData(true)
                          const response = await fetch('/api/delivery-rules/seed', {
                            method: 'POST',
                          })
                          const data = await response.json()

                          if (data.success) {
                            toast({
                              title: '성공',
                              description: data.message,
                            })
                            fetchDeliveryRules() // 목록 새로고침
                          } else {
                            toast({
                              title: '오류',
                              description: data.error || '샘플 데이터 생성에 실패했습니다.',
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
                          setGeneratingSampleData(false)
                        }
                      }}
                    >
                      {generatingSampleData ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        '샘플 데이터 생성하기'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>지역</TableHead>
                      <TableHead>마감 시간</TableHead>
                      <TableHead>마감 전 배송</TableHead>
                      <TableHead>마감 후 배송</TableHead>
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
                          <Badge variant="outline">{rule.cutoffTime}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{rule.beforeCutoffDays}일 후</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{rule.afterCutoffDays}일 후</Badge>
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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? '배송 규칙 수정' : '새 배송 규칙 추가'}</DialogTitle>
            <DialogDescription>지역별 배송 마감시간과 배송일을 설정하세요</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="region" className="text-right">
                지역
              </Label>
              <div className="col-span-3 space-y-2">
                {!isCustomRegion ? (
                  <Select
                    value={formData.region || undefined}
                    onValueChange={(value) => {
                      if (value === '__custom__') {
                        setIsCustomRegion(true)
                        setFormData({ ...formData, region: '' })
                      } else {
                        setFormData({ ...formData, region: value })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="지역 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {allRegions.map((region) => (
                        <SelectItem key={region} value={region}>
                          {region}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">🔧 직접 입력...</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="region"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      placeholder="예: 송도, 판교, 분당"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCustomRegion(false)
                        setFormData({ ...formData, region: '' })
                      }}
                    >
                      취소
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cutoffTime" className="text-right">
                마감 시간
              </Label>
              <Input
                id="cutoffTime"
                type="time"
                value={formData.cutoffTime}
                onChange={(e) => setFormData({ ...formData, cutoffTime: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="beforeCutoffDays" className="text-right">
                마감 전 배송
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="beforeCutoffDays"
                  type="number"
                  min="0"
                  max="14"
                  value={formData.beforeCutoffDays}
                  onChange={(e) =>
                    setFormData({ ...formData, beforeCutoffDays: parseInt(e.target.value) })
                  }
                  className="w-20"
                  placeholder="1"
                />
                <span className="text-sm text-muted-foreground">일 후</span>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="afterCutoffDays" className="text-right">
                마감 후 배송
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="afterCutoffDays"
                  type="number"
                  min="0"
                  max="14"
                  value={formData.afterCutoffDays}
                  onChange={(e) =>
                    setFormData({ ...formData, afterCutoffDays: parseInt(e.target.value) })
                  }
                  className="w-20"
                  placeholder="2"
                />
                <span className="text-sm text-muted-foreground">일 후</span>
              </div>
            </div>

            {/* 배송 시간대 선택 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="beforeCutoffDeliveryTime" className="text-right">
                마감 전 배송
              </Label>
              <Select
                value={formData.beforeCutoffDeliveryTime}
                onValueChange={(value) =>
                  setFormData({ ...formData, beforeCutoffDeliveryTime: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="오전">오전</SelectItem>
                  <SelectItem value="오후">오후</SelectItem>
                  <SelectItem value="미정">미정</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="afterCutoffDeliveryTime" className="text-right">
                마감 후 배송
              </Label>
              <Select
                value={formData.afterCutoffDeliveryTime}
                onValueChange={(value) =>
                  setFormData({ ...formData, afterCutoffDeliveryTime: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="오전">오전</SelectItem>
                  <SelectItem value="오후">오후</SelectItem>
                  <SelectItem value="미정">미정</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 영업 요일 선택 */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">영업 요일</Label>
              <div className="col-span-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: '0', label: '일' },
                    { value: '1', label: '월' },
                    { value: '2', label: '화' },
                    { value: '3', label: '수' },
                    { value: '4', label: '목' },
                    { value: '5', label: '금' },
                    { value: '6', label: '토' },
                  ].map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      size="sm"
                      variant={formData.workingDays.includes(day.value) ? 'default' : 'outline'}
                      onClick={() => {
                        const newWorkingDays = formData.workingDays.includes(day.value)
                          ? formData.workingDays.filter((d) => d !== day.value)
                          : [...formData.workingDays, day.value].sort()
                        setFormData({ ...formData, workingDays: newWorkingDays })
                      }}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">선택한 요일에만 배송합니다</p>
              </div>
            </div>

            {/* 공휴일 제외 여부 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="excludeHolidays" className="text-right">
                공휴일 제외
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <input
                  id="excludeHolidays"
                  type="checkbox"
                  checked={formData.excludeHolidays}
                  onChange={(e) => setFormData({ ...formData, excludeHolidays: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="excludeHolidays" className="text-sm font-normal">
                  공휴일에는 배송하지 않음
                </Label>
              </div>
            </div>

            {/* 커스텀 휴무일 */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">휴무일 추가</Label>
              <div className="col-span-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={newClosedDate}
                    onChange={(e) => setNewClosedDate(e.target.value)}
                    placeholder="YYYY-MM-DD"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (newClosedDate && !formData.customClosedDates.includes(newClosedDate)) {
                        setFormData({
                          ...formData,
                          customClosedDates: [...formData.customClosedDates, newClosedDate].sort(),
                        })
                        setNewClosedDate('')
                      }
                    }}
                    disabled={!newClosedDate}
                  >
                    추가
                  </Button>
                </div>
                {formData.customClosedDates.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.customClosedDates.map((date) => (
                      <Badge
                        key={date}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            customClosedDates: formData.customClosedDates.filter((d) => d !== date),
                          })
                        }}
                      >
                        {date} ✕
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">특정 날짜를 휴무일로 지정합니다</p>
              </div>
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
            {deliveryRules.filter((r) => r.isActive).length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-yellow-600" />
                  <p className="font-medium text-yellow-900">활성 배송 규칙이 없습니다</p>
                </div>
                <p className="text-sm text-yellow-800">
                  납품일을 계산하려면 먼저 배송 규칙을 등록해주세요.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 border-yellow-300 text-yellow-900 hover:bg-yellow-100"
                  onClick={() => {
                    setShowCalculatorDialog(false)
                    setShowCreateDialog(true)
                  }}
                >
                  <Plus className="mr-2 h-3 w-3" />
                  배송 규칙 등록하기
                </Button>
              </div>
            ) : (
              <>
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
                  <div className="mt-4 p-5 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <h4 className="font-semibold mb-3 text-blue-900 text-base">계산 결과</h4>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-900">
                        <span className="font-semibold text-blue-800">납품일:</span>{' '}
                        <span className="font-medium">{calculationResult.deliveryDateKR}</span>
                      </p>
                      <p className="text-gray-900">
                        <span className="font-semibold text-blue-800">소요일:</span>{' '}
                        <span className="font-medium">{calculationResult.businessDaysUsed}영업일</span>
                      </p>
                      <p className="text-gray-900">
                        <span className="font-semibold text-blue-800">지역:</span>{' '}
                        <span className="font-medium">{calculationResult.rule.region}</span>
                      </p>
                    </div>
                  </div>
                )}
              </>
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
