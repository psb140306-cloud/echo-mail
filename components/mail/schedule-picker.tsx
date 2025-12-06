'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { CalendarIcon, Clock, Send, Timer } from 'lucide-react'
import { format, addMinutes, setHours, setMinutes } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface SchedulePickerProps {
  onSchedule: (date: Date | null) => void
  disabled?: boolean
  canSchedule?: boolean // 플랜이 예약 발송을 지원하는지
}

export function SchedulePicker({
  onSchedule,
  disabled = false,
  canSchedule = false,
}: SchedulePickerProps) {
  const [isScheduled, setIsScheduled] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedHour, setSelectedHour] = useState('09')
  const [selectedMinute, setSelectedMinute] = useState('00')

  // 빠른 예약 옵션
  const quickOptions = [
    { label: '30분 후', minutes: 30 },
    { label: '1시간 후', minutes: 60 },
    { label: '3시간 후', minutes: 180 },
    { label: '내일 오전 9시', preset: 'tomorrow9' },
    { label: '내일 오후 2시', preset: 'tomorrow14' },
  ]

  const handleQuickOption = (option: { minutes?: number; preset?: string }) => {
    let date: Date

    if (option.minutes) {
      date = addMinutes(new Date(), option.minutes)
    } else if (option.preset === 'tomorrow9') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      date = setMinutes(setHours(tomorrow, 9), 0)
    } else if (option.preset === 'tomorrow14') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      date = setMinutes(setHours(tomorrow, 14), 0)
    } else {
      return
    }

    setSelectedDate(date)
    setSelectedHour(format(date, 'HH'))
    setSelectedMinute(format(date, 'mm'))
    onSchedule(date)
  }

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    if (date) {
      const scheduledDate = setMinutes(
        setHours(date, parseInt(selectedHour)),
        parseInt(selectedMinute)
      )
      onSchedule(scheduledDate)
    }
  }

  const handleTimeChange = (type: 'hour' | 'minute', value: string) => {
    if (type === 'hour') {
      setSelectedHour(value)
    } else {
      setSelectedMinute(value)
    }

    if (selectedDate) {
      const hour = type === 'hour' ? parseInt(value) : parseInt(selectedHour)
      const minute = type === 'minute' ? parseInt(value) : parseInt(selectedMinute)
      const scheduledDate = setMinutes(setHours(selectedDate, hour), minute)
      onSchedule(scheduledDate)
    }
  }

  const handleToggleSchedule = () => {
    if (isScheduled) {
      setIsScheduled(false)
      setSelectedDate(undefined)
      onSchedule(null)
    } else {
      setIsScheduled(true)
    }
  }

  // 플랜이 예약 발송을 지원하지 않으면 버튼만 표시
  if (!canSchedule) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className="opacity-50"
        >
          <Timer className="mr-2 h-4 w-4" />
          예약 발송 (프로페셔널 이상)
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={isScheduled ? 'default' : 'outline'}
          size="sm"
          onClick={handleToggleSchedule}
          disabled={disabled}
        >
          {isScheduled ? (
            <>
              <Timer className="mr-2 h-4 w-4" />
              예약 발송
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              즉시 발송
            </>
          )}
        </Button>
        {!isScheduled && (
          <span className="text-sm text-muted-foreground">
            (예약 발송으로 전환하려면 클릭)
          </span>
        )}
      </div>

      {isScheduled && (
        <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
          {/* 빠른 선택 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">빠른 선택</Label>
            <div className="flex flex-wrap gap-2">
              {quickOptions.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickOption(option)}
                  disabled={disabled}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 직접 선택 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">직접 선택</Label>
            <div className="flex items-center gap-3">
              {/* 날짜 선택 */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-[200px] justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                    disabled={disabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(selectedDate, 'PPP', { locale: ko })
                    ) : (
                      '날짜 선택'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) =>
                      date < new Date() || date > addMinutes(new Date(), 30 * 24 * 60)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* 시간 선택 */}
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedHour}
                  onValueChange={(v) => handleTimeChange('hour', v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) =>
                      i.toString().padStart(2, '0')
                    ).map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}시
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>:</span>
                <Select
                  value={selectedMinute}
                  onValueChange={(v) => handleTimeChange('minute', v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['00', '15', '30', '45'].map((minute) => (
                      <SelectItem key={minute} value={minute}>
                        {minute}분
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 선택된 예약 시간 표시 */}
          {selectedDate && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
              <span className="font-medium text-blue-700 dark:text-blue-300">
                예약 발송 시간:
              </span>{' '}
              <span className="text-blue-600 dark:text-blue-400">
                {format(
                  setMinutes(
                    setHours(selectedDate, parseInt(selectedHour)),
                    parseInt(selectedMinute)
                  ),
                  'PPP a h:mm',
                  { locale: ko }
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
