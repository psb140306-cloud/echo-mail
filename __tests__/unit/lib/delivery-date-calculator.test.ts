/**
 * Unit Tests for Delivery Date Calculator
 * 납기일 계산 로직 단위 테스트
 */

// 먼저 배송 규칙 및 날짜 계산 관련 유틸리티 함수들을 가정하여 테스트 작성
interface DeliveryRule {
  region: string
  deliveryDays: number
  cutoffTime: string // "14:00" 형식
  isActive: boolean
  weekendDelivery: boolean
  holidayDelivery: boolean
}

interface DeliveryCalculationOptions {
  region: string
  orderTime?: Date
  urgentOrder?: boolean
  customCutoffTime?: string
}

interface DeliveryCalculationResult {
  deliveryDate: Date
  deliveryDays: number
  isUrgent: boolean
  isWeekend: boolean
  isHoliday: boolean
  businessDaysOnly: boolean
  notes: string[]
}

// Mock implementation for testing
class DeliveryDateCalculator {
  private deliveryRules: Map<string, DeliveryRule> = new Map()
  private holidays: Set<string> = new Set()

  constructor() {
    this.initializeDefaultRules()
    this.initializeHolidays()
  }

  private initializeDefaultRules() {
    const defaultRules: DeliveryRule[] = [
      {
        region: '서울',
        deliveryDays: 1,
        cutoffTime: '14:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '경기',
        deliveryDays: 1,
        cutoffTime: '14:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '인천',
        deliveryDays: 1,
        cutoffTime: '14:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '부산',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '대구',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '광주',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '대전',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '울산',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '세종',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '강원',
        deliveryDays: 3,
        cutoffTime: '11:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '충북',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '충남',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '전북',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '전남',
        deliveryDays: 3,
        cutoffTime: '11:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '경북',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '경남',
        deliveryDays: 2,
        cutoffTime: '12:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
      {
        region: '제주',
        deliveryDays: 4,
        cutoffTime: '10:00',
        isActive: true,
        weekendDelivery: false,
        holidayDelivery: false,
      },
    ]

    defaultRules.forEach((rule) => {
      this.deliveryRules.set(rule.region, rule)
    })
  }

  private initializeHolidays() {
    // 2024년 주요 공휴일
    const holidays2024 = [
      '2024-01-01', // 신정
      '2024-02-09',
      '2024-02-10',
      '2024-02-11',
      '2024-02-12', // 설날
      '2024-03-01', // 삼일절
      '2024-05-05', // 어린이날
      '2024-05-15', // 부처님오신날
      '2024-06-06', // 현충일
      '2024-08-15', // 광복절
      '2024-09-16',
      '2024-09-17',
      '2024-09-18', // 추석
      '2024-10-03', // 개천절
      '2024-10-09', // 한글날
      '2024-12-25', // 성탄절
    ]

    holidays2024.forEach((holiday) => this.holidays.add(holiday))
  }

  calculateDeliveryDate(options: DeliveryCalculationOptions): DeliveryCalculationResult {
    const rule = this.deliveryRules.get(options.region)
    if (!rule) {
      throw new Error(`배송 규칙을 찾을 수 없습니다: ${options.region}`)
    }

    if (!rule.isActive) {
      throw new Error(`해당 지역은 배송 서비스가 중단되었습니다: ${options.region}`)
    }

    const orderTime = options.orderTime || new Date()
    const cutoffTime = options.customCutoffTime || rule.cutoffTime
    const notes: string[] = []

    let deliveryDate = new Date(orderTime)
    let deliveryDays = rule.deliveryDays

    // 마감 시간 확인
    const orderHour = orderTime.getHours()
    const orderMinute = orderTime.getMinutes()
    const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number)

    const orderTimeInMinutes = orderHour * 60 + orderMinute
    const cutoffTimeInMinutes = cutoffHour * 60 + cutoffMinute

    if (orderTimeInMinutes > cutoffTimeInMinutes) {
      deliveryDays += 1
      notes.push(`마감 시간(${cutoffTime}) 이후 주문으로 배송일 +1일`)
    }

    // 긴급 주문 처리
    if (options.urgentOrder) {
      deliveryDays = Math.max(1, deliveryDays - 1)
      notes.push('긴급 주문으로 배송일 단축')
    }

    // 배송일 계산 (영업일 기준)
    deliveryDate = this.addBusinessDays(orderTime, deliveryDays)

    // 주말/공휴일 배송 불가 시 다음 영업일로 이동
    if (!rule.weekendDelivery || !rule.holidayDelivery) {
      deliveryDate = this.adjustForNonBusinessDays(deliveryDate, rule)
    }

    return {
      deliveryDate,
      deliveryDays,
      isUrgent: options.urgentOrder || false,
      isWeekend: this.isWeekend(deliveryDate),
      isHoliday: this.isHoliday(deliveryDate),
      businessDaysOnly: !rule.weekendDelivery,
      notes,
    }
  }

  private addBusinessDays(startDate: Date, businessDays: number): Date {
    const result = new Date(startDate)
    let daysAdded = 0

    while (daysAdded < businessDays) {
      result.setDate(result.getDate() + 1)

      // 주말과 공휴일을 제외하고 카운트
      if (!this.isWeekend(result) && !this.isHoliday(result)) {
        daysAdded++
      }
    }

    return result
  }

  private adjustForNonBusinessDays(date: Date, rule: DeliveryRule): Date {
    const adjustedDate = new Date(date)

    // 주말 배송 불가인 경우
    if (!rule.weekendDelivery && this.isWeekend(adjustedDate)) {
      // 다음 월요일로 이동
      const daysUntilMonday = (8 - adjustedDate.getDay()) % 7
      adjustedDate.setDate(adjustedDate.getDate() + daysUntilMonday)
    }

    // 공휴일 배송 불가인 경우
    if (!rule.holidayDelivery && this.isHoliday(adjustedDate)) {
      // 다음 영업일로 이동
      do {
        adjustedDate.setDate(adjustedDate.getDate() + 1)
      } while (this.isWeekend(adjustedDate) || this.isHoliday(adjustedDate))
    }

    return adjustedDate
  }

  private isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6 // 일요일(0) 또는 토요일(6)
  }

  private isHoliday(date: Date): boolean {
    const dateString = date.toISOString().split('T')[0]
    return this.holidays.has(dateString)
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  // 테스트용 공개 메서드들
  addHoliday(date: string): void {
    this.holidays.add(date)
  }

  removeHoliday(date: string): void {
    this.holidays.delete(date)
  }

  updateDeliveryRule(region: string, rule: Partial<DeliveryRule>): void {
    const existing = this.deliveryRules.get(region)
    if (existing) {
      this.deliveryRules.set(region, { ...existing, ...rule })
    }
  }

  getDeliveryRule(region: string): DeliveryRule | undefined {
    return this.deliveryRules.get(region)
  }

  isBusinessDay(date: Date): boolean {
    return !this.isWeekend(date) && !this.isHoliday(date)
  }

  getNextBusinessDay(date: Date): Date {
    const nextDay = new Date(date)
    do {
      nextDay.setDate(nextDay.getDate() + 1)
    } while (!this.isBusinessDay(nextDay))
    return nextDay
  }
}

describe('DeliveryDateCalculator', () => {
  let calculator: DeliveryDateCalculator

  beforeEach(() => {
    calculator = new DeliveryDateCalculator()
  })

  describe('기본 배송일 계산', () => {
    it('서울 지역 정상 시간 주문', () => {
      const orderTime = new Date('2024-03-15T10:00:00') // 금요일 오전 10시
      const result = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
      })

      expect(result.deliveryDays).toBe(1)
      expect(result.deliveryDate.toISOString().split('T')[0]).toBe('2024-03-18') // 다음 월요일
      expect(result.notes).toHaveLength(0)
    })

    it('서울 지역 마감 시간 이후 주문', () => {
      const orderTime = new Date('2024-03-15T15:00:00') // 금요일 오후 3시 (마감: 14시)
      const result = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
      })

      expect(result.deliveryDays).toBe(2)
      expect(result.notes).toContain('마감 시간(14:00) 이후 주문으로 배송일 +1일')
    })

    it('부산 지역 배송일 계산', () => {
      const orderTime = new Date('2024-03-15T10:00:00') // 금요일 오전 10시
      const result = calculator.calculateDeliveryDate({
        region: '부산',
        orderTime,
      })

      expect(result.deliveryDays).toBe(2)
      expect(result.deliveryDate.toISOString().split('T')[0]).toBe('2024-03-19') // 다음 화요일
    })

    it('제주 지역 배송일 계산', () => {
      const orderTime = new Date('2024-03-15T09:00:00') // 금요일 오전 9시
      const result = calculator.calculateDeliveryDate({
        region: '제주',
        orderTime,
      })

      expect(result.deliveryDays).toBe(4)
      expect(result.deliveryDate.toISOString().split('T')[0]).toBe('2024-03-21') // 다음 목요일
    })
  })

  describe('긴급 주문 처리', () => {
    it('긴급 주문 시 배송일 단축', () => {
      const orderTime = new Date('2024-03-15T10:00:00')
      const normalResult = calculator.calculateDeliveryDate({
        region: '부산',
        orderTime,
      })

      const urgentResult = calculator.calculateDeliveryDate({
        region: '부산',
        orderTime,
        urgentOrder: true,
      })

      expect(urgentResult.deliveryDays).toBe(normalResult.deliveryDays - 1)
      expect(urgentResult.isUrgent).toBe(true)
      expect(urgentResult.notes).toContain('긴급 주문으로 배송일 단축')
    })

    it('서울 긴급 주문은 최소 1일 유지', () => {
      const orderTime = new Date('2024-03-15T10:00:00')
      const result = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
        urgentOrder: true,
      })

      expect(result.deliveryDays).toBe(1) // 최소 1일은 유지
    })
  })

  describe('주말 및 공휴일 처리', () => {
    it('토요일 배송일인 경우 월요일로 이연', () => {
      const orderTime = new Date('2024-03-14T10:00:00') // 목요일
      const result = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
      })

      // 1일 후면 금요일(15일)이지만, 영업일 기준으로 계산하므로 월요일(18일)
      expect(result.deliveryDate.toISOString().split('T')[0]).toBe('2024-03-18')
      expect(result.isWeekend).toBe(false)
    })

    it('공휴일 배송일인 경우 다음 영업일로 이연', () => {
      // 삼일절(3월 1일) 전날 주문
      const orderTime = new Date('2024-02-29T10:00:00')
      const result = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
      })

      // 3월 1일은 공휴일이므로 다음 영업일로 이연
      expect(result.deliveryDate.getTime()).toBeGreaterThan(new Date('2024-03-01').getTime())
      expect(result.isHoliday).toBe(false)
    })

    it('연속 공휴일 처리 (설날)', () => {
      // 설날 연휴 전 주문
      const orderTime = new Date('2024-02-08T10:00:00')
      const result = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
      })

      // 설날 연휴(2/9-2/12) 이후 첫 영업일
      expect(result.deliveryDate.toISOString().split('T')[0]).toBe('2024-02-13')
    })
  })

  describe('영업일 계산 유틸리티', () => {
    it('isBusinessDay 정확성 검증', () => {
      expect(calculator.isBusinessDay(new Date('2024-03-15'))).toBe(true) // 금요일
      expect(calculator.isBusinessDay(new Date('2024-03-16'))).toBe(false) // 토요일
      expect(calculator.isBusinessDay(new Date('2024-03-17'))).toBe(false) // 일요일
      expect(calculator.isBusinessDay(new Date('2024-03-18'))).toBe(true) // 월요일
      expect(calculator.isBusinessDay(new Date('2024-03-01'))).toBe(false) // 삼일절
    })

    it('getNextBusinessDay 정확성 검증', () => {
      const friday = new Date('2024-03-15')
      const nextBusinessDay = calculator.getNextBusinessDay(friday)
      expect(nextBusinessDay.toISOString().split('T')[0]).toBe('2024-03-18') // 다음 월요일
    })

    it('addBusinessDays 정확성 검증', () => {
      const startDate = new Date('2024-03-15') // 금요일

      // 1 영업일 후 = 다음 월요일
      const oneBizDay = (calculator as any).addBusinessDays(startDate, 1)
      expect(oneBizDay.toISOString().split('T')[0]).toBe('2024-03-18')

      // 3 영업일 후 = 다음 수요일
      const threeBizDays = (calculator as any).addBusinessDays(startDate, 3)
      expect(threeBizDays.toISOString().split('T')[0]).toBe('2024-03-20')
    })
  })

  describe('커스텀 마감 시간', () => {
    it('커스텀 마감 시간 적용', () => {
      const orderTime = new Date('2024-03-15T13:00:00')

      const defaultResult = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
      })

      const customResult = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
        customCutoffTime: '12:00',
      })

      // 기본 마감시간(14:00)로는 당일 처리, 커스텀(12:00)으로는 +1일
      expect(customResult.deliveryDays).toBe(defaultResult.deliveryDays + 1)
    })
  })

  describe('에러 처리', () => {
    it('존재하지 않는 지역에 대한 에러', () => {
      expect(() => {
        calculator.calculateDeliveryDate({
          region: '존재하지않는지역',
          orderTime: new Date(),
        })
      }).toThrow('배송 규칙을 찾을 수 없습니다')
    })

    it('비활성 지역에 대한 에러', () => {
      calculator.updateDeliveryRule('서울', { isActive: false })

      expect(() => {
        calculator.calculateDeliveryDate({
          region: '서울',
          orderTime: new Date(),
        })
      }).toThrow('배송 서비스가 중단되었습니다')
    })
  })

  describe('규칙 관리', () => {
    it('배송 규칙 업데이트', () => {
      calculator.updateDeliveryRule('서울', {
        deliveryDays: 3,
        cutoffTime: '16:00',
      })

      const rule = calculator.getDeliveryRule('서울')
      expect(rule?.deliveryDays).toBe(3)
      expect(rule?.cutoffTime).toBe('16:00')
    })

    it('공휴일 추가/제거', () => {
      const testDate = '2024-12-31'
      calculator.addHoliday(testDate)
      expect(calculator.isBusinessDay(new Date(testDate))).toBe(false)

      calculator.removeHoliday(testDate)
      expect(calculator.isBusinessDay(new Date(testDate))).toBe(true)
    })
  })

  describe('특수 케이스', () => {
    it('월말 주문 (다음 달 배송)', () => {
      const orderTime = new Date('2024-02-29T10:00:00') // 윤년 2월 29일
      const result = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
      })

      expect(result.deliveryDate.getMonth()).toBe(2) // 3월 (0-based)
    })

    it('연말 주문 (다음 해 배송)', () => {
      const orderTime = new Date('2024-12-30T10:00:00')
      const result = calculator.calculateDeliveryDate({
        region: '제주', // 4일 소요
        orderTime,
      })

      expect(result.deliveryDate.getFullYear()).toBe(2025)
    })

    it('자정 직후 주문', () => {
      const orderTime = new Date('2024-03-15T00:01:00')
      const result = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
      })

      expect(result.notes).not.toContain('마감 시간')
    })

    it('자정 직전 주문', () => {
      const orderTime = new Date('2024-03-15T23:59:00')
      const result = calculator.calculateDeliveryDate({
        region: '서울',
        orderTime,
      })

      expect(result.notes).toContain('마감 시간(14:00) 이후 주문으로 배송일 +1일')
    })
  })

  describe('성능 테스트', () => {
    it('대량 계산 성능', () => {
      const startTime = Date.now()

      for (let i = 0; i < 1000; i++) {
        const orderTime = new Date(2024, 2, 15 + (i % 30)) // 3월 중 다양한 날짜
        calculator.calculateDeliveryDate({
          region: '서울',
          orderTime,
          urgentOrder: i % 2 === 0,
        })
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // 1000회 계산이 1초 이내
    })
  })

  describe('일관성 테스트', () => {
    it('같은 조건으로 반복 계산 시 동일한 결과', () => {
      const options = {
        region: '서울',
        orderTime: new Date('2024-03-15T10:00:00'),
        urgentOrder: false,
      }

      const results = Array.from({ length: 100 }, () => calculator.calculateDeliveryDate(options))

      // 모든 결과가 동일해야 함
      const firstResult = results[0]
      results.forEach((result) => {
        expect(result.deliveryDate.getTime()).toBe(firstResult.deliveryDate.getTime())
        expect(result.deliveryDays).toBe(firstResult.deliveryDays)
        expect(result.notes).toEqual(firstResult.notes)
      })
    })

    it('시간대별 배송일 계산 일관성', () => {
      const regions = ['서울', '부산', '제주']
      const testDates = [
        new Date('2024-03-15T09:00:00'),
        new Date('2024-03-15T13:00:00'),
        new Date('2024-03-15T15:00:00'),
      ]

      regions.forEach((region) => {
        testDates.forEach((orderTime) => {
          const result = calculator.calculateDeliveryDate({
            region,
            orderTime,
          })

          // 배송일은 항상 주문일보다 이후여야 함
          expect(result.deliveryDate.getTime()).toBeGreaterThan(orderTime.getTime())

          // 배송 소요일은 0보다 커야 함
          expect(result.deliveryDays).toBeGreaterThan(0)

          // 영업일 기준으로 배송되어야 함
          expect(calculator.isBusinessDay(result.deliveryDate)).toBe(true)
        })
      })
    })
  })
})
