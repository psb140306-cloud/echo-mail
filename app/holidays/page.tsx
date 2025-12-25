'use client'

import { useState, useEffect } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import './holidays.css'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { AppHeader } from '@/components/layout/app-header'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Calendar as CalendarIcon, Loader2, Download, RefreshCcw, CalendarCheck } from 'lucide-react'

interface Holiday {
  id: string
  name: string
  date: string
  isLunar: boolean
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  // 오늘 날짜가 속한 월의 1일로 초기화
  const [activeStartDate, setActiveStartDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1))
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null)
  const [generating, setGenerating] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: '',
    date: '',
  })

  // 공휴일 목록 조회
  const fetchHolidays = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/holidays?year=${selectedYear}&limit=500`)
      const data = await res.json()

      if (res.ok) {
        // data.data는 pagination 응답 구조
        setHolidays(data.data.data || data.data || [])
      } else {
        toast({
          title: '오류',
          description: data.message || '공휴일 목록 조회에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('공휴일 조회 실패:', error)
      toast({
        title: '오류',
        description: '공휴일 목록 조회에 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHolidays()
  }, [selectedYear])

  // 연도가 변경되면 해당 연도의 1월로 이동
  const handleYearChange = (year: number) => {
    setSelectedYear(year)
    setActiveStartDate(new Date(year, 0, 1))
  }

  // 오늘 날짜로 이동
  const handleGoToToday = () => {
    const today = new Date()
    setSelectedYear(today.getFullYear())
    setSelectedDate(today)
    setActiveStartDate(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  // 특정 날짜의 공휴일 조회
  const getHolidayForDate = (date: Date): Holiday | undefined => {
    // 로컬 시간대로 YYYY-MM-DD 형식 생성 (UTC 변환 문제 방지)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    return holidays.find((h) => h.date.startsWith(dateStr))
  }

  // 날짜 클릭 핸들러
  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    const holiday = getHolidayForDate(date)

    if (holiday) {
      // 이미 공휴일이면 삭제 확인
      setHolidayToDelete(holiday)
      setShowDeleteDialog(true)
    } else {
      // 공휴일이 아니면 추가 다이얼로그
      setFormData({
        name: '',
        date: date.toISOString().split('T')[0],
      })
      setShowAddDialog(true)
    }
  }

  // 공휴일 추가
  const handleAddHoliday = async () => {
    if (!formData.name || !formData.date) {
      toast({
        title: '오류',
        description: '공휴일 이름과 날짜를 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '성공',
          description: data.message || '공휴일이 추가되었습니다.',
        })
        setShowAddDialog(false)
        setFormData({ name: '', date: '' })
        fetchHolidays()
      } else {
        toast({
          title: '오류',
          description: data.message || data.error || '공휴일 추가에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('공휴일 추가 실패:', error)
      toast({
        title: '오류',
        description: '공휴일 추가에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 공휴일 삭제
  const handleDeleteHoliday = async () => {
    if (!holidayToDelete) return

    try {
      const res = await fetch(`/api/holidays?id=${holidayToDelete.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '성공',
          description: data.message || '공휴일이 삭제되었습니다.',
        })
        setShowDeleteDialog(false)
        setHolidayToDelete(null)
        fetchHolidays()
      } else {
        toast({
          title: '오류',
          description: data.message || data.error || '공휴일 삭제에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('공휴일 삭제 실패:', error)
      toast({
        title: '오류',
        description: '공휴일 삭제에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 자동 생성
  const handleGenerateHolidays = async () => {
    if (
      !confirm(
        `${selectedYear}년 공휴일을 자동으로 생성하시겠습니까?\n\n기존 공휴일이 있으면 에러가 발생합니다.`
      )
    ) {
      return
    }

    try {
      setGenerating(true)
      const res = await fetch(`/api/holidays/generate/${selectedYear}`, {
        method: 'GET',
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '성공',
          description: data.message || `${selectedYear}년 공휴일이 자동 생성되었습니다.`,
        })
        fetchHolidays()
      } else {
        toast({
          title: '오류',
          description: data.message || data.error || '공휴일 자동 생성에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('공휴일 자동 생성 실패:', error)
      toast({
        title: '오류',
        description: '공휴일 자동 생성에 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  // 재생성 (기존 삭제 후 생성)
  const handleRegenerateHolidays = async () => {
    if (
      !confirm(
        `${selectedYear}년의 기존 공휴일을 모두 삭제하고 재생성하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return
    }

    try {
      setGenerating(true)
      const res = await fetch(`/api/holidays/generate/${selectedYear}`, {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: '성공',
          description: data.message || `${selectedYear}년 공휴일이 재생성되었습니다.`,
        })
        fetchHolidays()
      } else {
        toast({
          title: '오류',
          description: data.message || data.error || '공휴일 재생성에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('공휴일 재생성 실패:', error)
      toast({
        title: '오류',
        description: '공휴일 재생성에 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  // 캘린더 타일 스타일링
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const holiday = getHolidayForDate(date)
      if (holiday) {
        return (
          <div className="flex flex-col items-center mt-0.5">
            <span
              className={`text-[10px] font-medium truncate max-w-full px-0.5 leading-tight ${
                holiday.isLunar ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {holiday.name}
            </span>
          </div>
        )
      }
    }
    return null
  }

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const holiday = getHolidayForDate(date)
      if (holiday) {
        // 음력: 보라색 배경/텍스트, 양력: 빨간색 배경/텍스트
        return holiday.isLunar
          ? 'holiday-lunar bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-950/40'
          : 'holiday-solar bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40'
      }
    }
    return ''
  }

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50/40">
        <main className="container mx-auto py-6 space-y-6">
          <h1 className="text-2xl font-bold">공휴일 관리</h1>
        {/* 연도 선택 및 액션 버튼 */}
        <Card>
          <CardHeader>
            <CardTitle>연도 선택</CardTitle>
            <CardDescription>
              공휴일을 조회하거나 자동 생성할 연도를 선택하세요. 음력 공휴일(설날, 추석,
              석가탄신일)도 자동으로 계산됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label htmlFor="year">연도</Label>
                <Input
                  id="year"
                  type="number"
                  value={selectedYear}
                  onChange={(e) => handleYearChange(parseInt(e.target.value))}
                  className="w-32"
                  min={2000}
                  max={2100}
                />
              </div>

              <Button onClick={handleGoToToday} variant="secondary">
                <CalendarCheck className="mr-2 h-4 w-4" />
                오늘
              </Button>

              <div className="h-6 w-px bg-border" />

              <Button onClick={handleGenerateHolidays} disabled={generating} variant="outline">
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    공휴일 생성
                  </>
                )}
              </Button>

              <Button onClick={handleRegenerateHolidays} disabled={generating} variant="destructive">
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    재생성 중...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    모두 삭제 후 재생성
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>양력 공휴일</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span>음력 공휴일 (자동 계산)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 캘린더 및 공휴일 목록 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 캘린더 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {selectedYear}년 캘린더
              </CardTitle>
              <CardDescription>
                날짜를 클릭하여 공휴일을 추가하거나 삭제하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Calendar
                  value={selectedDate}
                  onClickDay={handleDateClick}
                  tileContent={tileContent}
                  tileClassName={tileClassName}
                  locale="ko-KR"
                  className="w-full border-0 shadow-none"
                  activeStartDate={activeStartDate}
                  onActiveStartDateChange={({ activeStartDate }) => {
                    if (activeStartDate) {
                      setActiveStartDate(activeStartDate)
                    }
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* 공휴일 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedYear}년 공휴일 목록</CardTitle>
              <CardDescription>총 {holidays.length}개</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : holidays.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>등록된 공휴일이 없습니다.</p>
                  <p className="text-sm mt-2">자동 생성 버튼을 눌러 공휴일을 생성하세요.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {holidays.map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => {
                        setHolidayToDelete(holiday)
                        setShowDeleteDialog(true)
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${holiday.isLunar ? 'bg-purple-500' : 'bg-red-500'}`}
                        />
                        <div>
                          <p className="font-medium">{holiday.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {holiday.date.split('T')[0]}
                          </p>
                        </div>
                      </div>
                      <Badge variant={holiday.isLunar ? 'secondary' : 'default'}>
                        {holiday.isLunar ? '음력' : '양력'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 공휴일 추가 다이얼로그 */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>공휴일 추가</DialogTitle>
              <DialogDescription>새로운 공휴일을 추가합니다. (양력만 가능)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="holiday-name">공휴일명</Label>
                <Input
                  id="holiday-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 임시 공휴일"
                />
              </div>
              <div>
                <Label htmlFor="holiday-date">날짜</Label>
                <Input
                  id="holiday-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                취소
              </Button>
              <Button onClick={handleAddHoliday}>추가</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 공휴일 삭제 확인 다이얼로그 */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>공휴일 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                {holidayToDelete && (
                  <>
                    <span className="font-semibold">{holidayToDelete.name}</span> (
                    {holidayToDelete.date.split('T')[0]})를 삭제하시겠습니까?
                    <br />
                    이 작업은 되돌릴 수 없습니다.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setHolidayToDelete(null)}>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteHoliday} className="bg-destructive">
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </main>
      </div>
    </>
  )
}
