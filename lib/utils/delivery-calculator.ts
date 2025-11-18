import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const prisma = new PrismaClient()

export interface DeliveryCalculationOptions {
  region: string
  orderDateTime: Date
  tenantId: string
  excludeWeekends?: boolean
  customHolidays?: Date[]
}

export interface DeliveryResult {
  deliveryDate: Date
  businessDaysUsed: number
  isHoliday: boolean
  isWeekend: boolean
  deliveryTime?: string // 오전/오후 배송 시간대
  rule: {
    region: string
    cutoffTime: string
    beforeCutoffDays: number
    afterCutoffDays: number
    beforeCutoffDeliveryTime: string
    afterCutoffDeliveryTime: string
  }
}

export class DeliveryCalculator {
  private holidayCache: Map<string, Date[]> = new Map()
  private deliveryRuleCache: Map<string, any> = new Map()

  constructor() {}

  /**
   * UTC Date를 한국 시간대(KST, UTC+9)로 변환
   */
  private toKST(date: Date): Date {
    const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    return kstDate
  }

  /**
   * 한국 시간대 기준으로 날짜의 연/월/일/시/분 추출
   */
  private getKSTComponents(date: Date) {
    const kstString = date.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    const parts = kstString.split(', ')
    const datePart = parts[0].split('/')  // MM/DD/YYYY
    const timePart = parts[1].split(':')  // HH:MM

    return {
      year: parseInt(datePart[2]),
      month: parseInt(datePart[0]) - 1,  // JS month is 0-indexed
      day: parseInt(datePart[1]),
      hours: parseInt(timePart[0]),
      minutes: parseInt(timePart[1])
    }
  }

  /**
   * 메인 납품일 계산 함수
   */
  async calculateDeliveryDate(options: DeliveryCalculationOptions): Promise<DeliveryResult> {
    try {
      // 납품 규칙 조회
      const rule = await this.getDeliveryRule(options.region, options.tenantId)
      if (!rule) {
        throw new Error(`'${options.region}' 지역의 납품 규칙을 찾을 수 없습니다.`)
      }

      // 주문 시간 분석 (한국 시간 기준)
      const kstComponents = this.getKSTComponents(options.orderDateTime)
      const orderTime = kstComponents.hours * 60 + kstComponents.minutes
      const cutoffTime = this.parseTime(rule.cutoffTime)

      // 마감 전/후 판단 (마감시간 정각은 마감 후로 처리)
      const isBeforeCutoff = orderTime < cutoffTime
      const deliveryDays = isBeforeCutoff ? rule.beforeCutoffDays : rule.afterCutoffDays
      const deliveryTime = isBeforeCutoff ? rule.beforeCutoffDeliveryTime : rule.afterCutoffDeliveryTime

      // 영업일 기준으로 배송일 계산
      const deliveryDate = await this.calculateBusinessDate(
        options.orderDateTime,
        deliveryDays,
        rule,
        options.tenantId
      )

      const result: DeliveryResult = {
        deliveryDate,
        businessDaysUsed: deliveryDays,
        isHoliday: await this.isHoliday(deliveryDate, options.customHolidays, options.tenantId),
        isWeekend: this.isWeekend(deliveryDate),
        deliveryTime,
        rule: {
          region: rule.region,
          cutoffTime: rule.cutoffTime,
          beforeCutoffDays: rule.beforeCutoffDays,
          afterCutoffDays: rule.afterCutoffDays,
          beforeCutoffDeliveryTime: rule.beforeCutoffDeliveryTime || '오전',
          afterCutoffDeliveryTime: rule.afterCutoffDeliveryTime || '오후',
        },
      }

      logger.info('납품일 계산 완료', {
        region: options.region,
        orderTime: options.orderDateTime.toISOString(),
        orderMinutes: orderTime,
        cutoffTime: rule.cutoffTime,
        cutoffMinutes: cutoffTime,
        isBeforeCutoff,
        deliveryDate: result.deliveryDate.toISOString(),
        businessDaysUsed: result.businessDaysUsed,
      })

      return result
    } catch (error) {
      logger.error('납품일 계산 실패:', error)
      throw error
    }
  }

  /**
   * 영업일 기준 날짜 계산 (한국 시간대 기준)
   * 유연한 휴무일 관리: workingDays, customClosedDates, excludeHolidays 지원
   */
  private async calculateBusinessDate(
    startDate: Date,
    businessDays: number,
    rule: any, // DeliveryRule with workingDays, customClosedDates, excludeHolidays
    tenantId: string
  ): Promise<Date> {
    // 한국 시간대로 변환
    let currentDate = this.toKST(startDate)
    let daysAdded = 0

    while (daysAdded < businessDays) {
      currentDate.setDate(currentDate.getDate() + 1)

      // 1. 영업 요일 확인 (workingDays에 포함되지 않으면 스킵)
      const kstComponents = this.getKSTComponents(currentDate)
      const kstDate = new Date(kstComponents.year, kstComponents.month, kstComponents.day)
      const dayOfWeek = kstDate.getDay().toString()

      if (!rule.workingDays.includes(dayOfWeek)) {
        continue
      }

      // 2. 커스텀 휴무일 확인
      const dateString = this.formatDateKST(currentDate)
      if (rule.customClosedDates.includes(dateString)) {
        continue
      }

      // 3. 공휴일 확인 (excludeHolidays가 true일 때만)
      if (rule.excludeHolidays && await this.isHoliday(currentDate, undefined, tenantId)) {
        continue
      }

      daysAdded++
    }

    return currentDate
  }

  /**
   * KST 날짜를 YYYY-MM-DD 형식으로 포맷
   */
  private formatDateKST(date: Date): string {
    const kstComponents = this.getKSTComponents(date)
    const year = kstComponents.year
    const month = String(kstComponents.month + 1).padStart(2, '0')
    const day = String(kstComponents.day).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 납품 규칙 조회 (캐싱)
   */
  private async getDeliveryRule(region: string, tenantId: string) {
    const cacheKey = `rule_${tenantId}_${region}`

    if (this.deliveryRuleCache.has(cacheKey)) {
      return this.deliveryRuleCache.get(cacheKey)
    }

    const rule = await prisma.deliveryRule.findFirst({
      where: {
        region,
        tenantId,
        isActive: true,
      },
    })

    if (rule) {
      this.deliveryRuleCache.set(cacheKey, rule)
    }

    return rule
  }

  /**
   * 공휴일 여부 확인
   */
  private async isHoliday(date: Date, customHolidays?: Date[], tenantId?: string): Promise<boolean> {
    // 커스텀 공휴일 확인
    if (customHolidays) {
      const dateString = date.toISOString().split('T')[0]
      return customHolidays.some((holiday) => holiday.toISOString().split('T')[0] === dateString)
    }

    // tenantId가 없으면 공휴일 아님
    if (!tenantId) {
      return false
    }

    // 데이터베이스 공휴일 확인 (캐싱)
    const year = date.getFullYear()
    const cacheKey = `holidays_${tenantId}_${year}`

    let holidays: Date[]
    if (this.holidayCache.has(cacheKey)) {
      holidays = this.holidayCache.get(cacheKey)!
    } else {
      const holidayRecords = await prisma.holiday.findMany({
        where: {
          tenantId,
          date: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        },
      })

      holidays = holidayRecords.map((h) => h.date)
      this.holidayCache.set(cacheKey, holidays)
    }

    const dateString = date.toISOString().split('T')[0]
    return holidays.some((holiday) => holiday.toISOString().split('T')[0] === dateString)
  }

  /**
   * 주말 여부 확인 (토요일: 6, 일요일: 0)
   */
  private isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  /**
   * 주말 여부 확인 (한국 시간대 기준)
   */
  private isWeekendKST(date: Date): boolean {
    const kstComponents = this.getKSTComponents(date)
    const kstDate = new Date(kstComponents.year, kstComponents.month, kstComponents.day)
    const day = kstDate.getDay()
    return day === 0 || day === 6
  }

  /**
   * 시간을 분 단위로 변환
   */
  private getTimeInMinutes(date: Date): number {
    return date.getHours() * 60 + date.getMinutes()
  }

  /**
   * 시간 문자열을 분 단위로 변환
   */
  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * 다음 영업일 조회 (한국 시간대 기준)
   */
  async getNextBusinessDay(date: Date, excludeWeekends: boolean = true): Promise<Date> {
    let nextDay = this.toKST(date)
    nextDay.setDate(nextDay.getDate() + 1)

    while (true) {
      if (excludeWeekends && this.isWeekendKST(nextDay)) {
        nextDay.setDate(nextDay.getDate() + 1)
        continue
      }

      if (await this.isHoliday(nextDay)) {
        nextDay.setDate(nextDay.getDate() + 1)
        continue
      }

      break
    }

    return nextDay
  }

  /**
   * 두 날짜 간의 영업일 수 계산 (한국 시간대 기준)
   */
  async getBusinessDaysBetween(
    startDate: Date,
    endDate: Date,
    excludeWeekends: boolean = true
  ): Promise<number> {
    let count = 0
    let currentDate = this.toKST(startDate)
    const kstEndDate = this.toKST(endDate)

    while (currentDate < kstEndDate) {
      currentDate.setDate(currentDate.getDate() + 1)

      if (excludeWeekends && this.isWeekendKST(currentDate)) {
        continue
      }

      if (await this.isHoliday(currentDate)) {
        continue
      }

      count++
    }

    return count
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.holidayCache.clear()
    this.deliveryRuleCache.clear()
    logger.info('납품 계산기 캐시 초기화 완료')
  }

  /**
   * 특정 연도의 공휴일을 미리 캐시에 로드
   */
  async preloadHolidays(year: number): Promise<void> {
    const cacheKey = `holidays_${year}`

    const holidayRecords = await prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
      },
    })

    const holidays = holidayRecords.map((h) => h.date)
    this.holidayCache.set(cacheKey, holidays)

    logger.info(`${year}년 공휴일 캐시 로드 완료: ${holidays.length}개`)
  }
}

// 싱글톤 인스턴스
export const deliveryCalculator = new DeliveryCalculator()

// 편의 함수들
export async function calculateDeliveryDate(
  options: DeliveryCalculationOptions
): Promise<DeliveryResult> {
  return deliveryCalculator.calculateDeliveryDate(options)
}

export async function getNextBusinessDay(date: Date = new Date()): Promise<Date> {
  return deliveryCalculator.getNextBusinessDay(date)
}

export async function getBusinessDaysBetween(startDate: Date, endDate: Date): Promise<number> {
  return deliveryCalculator.getBusinessDaysBetween(startDate, endDate)
}
