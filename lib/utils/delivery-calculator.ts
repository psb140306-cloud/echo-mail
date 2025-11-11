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
  deliveryTime: 'morning' | 'afternoon'
  businessDaysUsed: number
  isHoliday: boolean
  isWeekend: boolean
  rule: {
    region: string
    morningCutoff: string
    afternoonCutoff: string
    morningDeliveryDays: number
    afternoonDeliveryDays: number
  }
}

export class DeliveryCalculator {
  private holidayCache: Map<string, Date[]> = new Map()
  private deliveryRuleCache: Map<string, any> = new Map()

  constructor() {}

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

      // 주문 시간 분석
      let orderTime = this.getTimeInMinutes(options.orderDateTime)
      const morningCutoffTime = this.parseTime(rule.morningCutoff)
      const afternoonCutoffTime = this.parseTime(rule.afternoonCutoff)

      // 자정 이후(00:00 ~ 오전) 수신된 메일은 정오(12:00) 수신으로 처리
      const noonTime = 12 * 60 // 12:00 = 720분
      if (orderTime < morningCutoffTime) {
        logger.info('[DeliveryCalculator] 자정 이후 수신 메일 -> 정오 수신으로 처리', {
          originalTime: options.orderDateTime.toISOString(),
          originalMinutes: orderTime,
          adjustedMinutes: noonTime,
        })
        orderTime = noonTime
      }

      // 배송 시간대 및 배송일 결정
      let deliveryTime: 'morning' | 'afternoon'
      let deliveryDays: number

      if (orderTime <= morningCutoffTime) {
        // 오전 마감시간 이전 주문 -> 오전 배송
        deliveryTime = 'morning'
        deliveryDays = rule.morningDeliveryDays
      } else if (orderTime <= afternoonCutoffTime) {
        // 오전 마감 후, 오후 마감시간 이전 주문 -> 오후 배송
        deliveryTime = 'afternoon'
        deliveryDays = rule.afternoonDeliveryDays
      } else {
        // 오후 마감시간 이후 주문 -> 다음날 오전 배송
        deliveryTime = 'morning'
        deliveryDays = rule.morningDeliveryDays + 1
      }

      // 영업일 기준으로 배송일 계산
      const deliveryDate = await this.calculateBusinessDate(
        options.orderDateTime,
        deliveryDays,
        options.excludeWeekends ?? true,
        options.customHolidays
      )

      const result: DeliveryResult = {
        deliveryDate,
        deliveryTime,
        businessDaysUsed: deliveryDays,
        isHoliday: await this.isHoliday(deliveryDate, options.customHolidays),
        isWeekend: this.isWeekend(deliveryDate),
        rule: {
          region: rule.region,
          morningCutoff: rule.morningCutoff,
          afternoonCutoff: rule.afternoonCutoff,
          morningDeliveryDays: rule.morningDeliveryDays,
          afternoonDeliveryDays: rule.afternoonDeliveryDays,
        },
      }

      logger.info('납품일 계산 완료', {
        region: options.region,
        orderTime: options.orderDateTime.toISOString(),
        deliveryDate: result.deliveryDate.toISOString(),
        deliveryTime: result.deliveryTime,
        businessDaysUsed: result.businessDaysUsed,
      })

      return result
    } catch (error) {
      logger.error('납품일 계산 실패:', error)
      throw error
    }
  }

  /**
   * 영업일 기준 날짜 계산
   */
  private async calculateBusinessDate(
    startDate: Date,
    businessDays: number,
    excludeWeekends: boolean = true,
    customHolidays?: Date[]
  ): Promise<Date> {
    let currentDate = new Date(startDate)
    let daysAdded = 0

    while (daysAdded < businessDays) {
      currentDate.setDate(currentDate.getDate() + 1)

      // 주말 제외 여부 확인
      if (excludeWeekends && this.isWeekend(currentDate)) {
        continue
      }

      // 공휴일 확인
      if (await this.isHoliday(currentDate, customHolidays)) {
        continue
      }

      daysAdded++
    }

    return currentDate
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
  private async isHoliday(date: Date, customHolidays?: Date[]): Promise<boolean> {
    // 커스텀 공휴일 확인
    if (customHolidays) {
      const dateString = date.toISOString().split('T')[0]
      return customHolidays.some((holiday) => holiday.toISOString().split('T')[0] === dateString)
    }

    // 데이터베이스 공휴일 확인 (캐싱)
    const year = date.getFullYear()
    const cacheKey = `holidays_${year}`

    let holidays: Date[]
    if (this.holidayCache.has(cacheKey)) {
      holidays = this.holidayCache.get(cacheKey)!
    } else {
      const holidayRecords = await prisma.holiday.findMany({
        where: {
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
   * 다음 영업일 조회
   */
  async getNextBusinessDay(date: Date, excludeWeekends: boolean = true): Promise<Date> {
    let nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)

    while (true) {
      if (excludeWeekends && this.isWeekend(nextDay)) {
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
   * 두 날짜 간의 영업일 수 계산
   */
  async getBusinessDaysBetween(
    startDate: Date,
    endDate: Date,
    excludeWeekends: boolean = true
  ): Promise<number> {
    let count = 0
    let currentDate = new Date(startDate)

    while (currentDate < endDate) {
      currentDate.setDate(currentDate.getDate() + 1)

      if (excludeWeekends && this.isWeekend(currentDate)) {
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
