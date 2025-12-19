import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const prisma = new PrismaClient()

export interface DeliveryCalculationOptions {
  region: string
  orderDateTime: Date
  tenantId: string
  /**
   * @deprecated 사용되지 않음. 배송 규칙의 workingDays 설정이 주말 제외 여부를 결정합니다.
   */
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
   * Date 객체 복사 (타임존 변환 없이)
   * 주의: getKSTComponents()가 이미 timeZone: 'Asia/Seoul'로 KST 해석을 하므로
   * 별도의 +9시간 보정은 이중 변환 문제를 일으킴
   * @deprecated 이중 보정 문제로 인해 copyDate()로 대체됨
   */
  private copyDate(date: Date): Date {
    return new Date(date.getTime())
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

      // 1. 주문일이 영업일인지 확인
      const isHoliday =
        (rule.excludeHolidays &&
          (await this.isHoliday(options.orderDateTime, options.customHolidays, options.tenantId))) ||
        false
      const isWeekend = this.isWeekendKST(options.orderDateTime)
      const dayOfWeek = new Date(
        kstComponents.year,
        kstComponents.month,
        kstComponents.day
      ).getDay().toString()
      const isWorkingDay =
        !isHoliday &&
        !rule.customClosedDates.includes(this.formatDateKST(options.orderDateTime)) &&
        rule.workingDays.includes(dayOfWeek)

      let baseDate = options.orderDateTime
      let isBeforeCutoff = false

      if (!isWorkingDay) {
        // 휴무일인 경우: 다음 영업일을 기준일로 이월하되, 마감 판단은 주문 시각(KST)을 그대로 사용
        baseDate = await this.getNextBusinessDay(options.orderDateTime, rule, options.tenantId, options.customHolidays)
        logger.info('휴무일 주문 - 다음 영업일로 이월', {
          originalDate: this.formatDateKST(options.orderDateTime),
          nextBusinessDay: this.formatDateKST(baseDate),
        })
      }

      // 배송일수 및 시간 결정
      let deliveryDays: number
      let deliveryTime: string

      if (rule.cutoffCount === 2 && rule.secondCutoffTime) {
        // 2차 마감 설정이 있는 경우
        const secondCutoffTime = this.parseTime(rule.secondCutoffTime)

        if (orderTime < cutoffTime) {
          // 영업일 1차 마감 전
          isBeforeCutoff = true
          deliveryDays = rule.beforeCutoffDays
          deliveryTime = rule.beforeCutoffDeliveryTime
        } else if (orderTime < secondCutoffTime) {
          // 1차 마감 후 ~ 2차 마감 전
          isBeforeCutoff = true // 2차 마감 기준으로는 전임
          deliveryDays = rule.afterCutoffDays
          deliveryTime = rule.afterCutoffDeliveryTime
        } else {
          // 2차 마감 후
          isBeforeCutoff = false
          deliveryDays = rule.afterSecondCutoffDays ?? rule.afterCutoffDays + 1
          deliveryTime = rule.afterSecondCutoffDeliveryTime ?? rule.afterCutoffDeliveryTime
        }
      } else {
        // 기존 1차 마감 로직
        if (orderTime < cutoffTime) {
          // 영업일 마감 전
          isBeforeCutoff = true
          deliveryDays = rule.beforeCutoffDays
          deliveryTime = rule.beforeCutoffDeliveryTime
        } else {
          // 영업일 마감 후
          isBeforeCutoff = false
          deliveryDays = rule.afterCutoffDays
          deliveryTime = rule.afterCutoffDeliveryTime
        }
      }

      // 영업일 기준으로 배송일 계산 (customHolidays 전달)
      const deliveryDate = await this.calculateBusinessDate(
        baseDate,
        deliveryDays,
        rule,
        options.tenantId,
        options.customHolidays
      )

      const result: DeliveryResult = {
        deliveryDate,
        businessDaysUsed: deliveryDays,
        isHoliday: await this.isHoliday(deliveryDate, options.customHolidays, options.tenantId),
        isWeekend: this.isWeekendKST(deliveryDate),  // KST 기준으로 주말 확인
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
        isWorkingDay,
        baseDate: this.formatDateKST(baseDate),
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
    tenantId: string,
    customHolidays?: Date[]
  ): Promise<Date> {
    // Date 객체 복사 (getKSTComponents에서 KST 해석하므로 변환 불필요)
    let currentDate = this.copyDate(startDate)
    let daysAdded = 0

    // 무한 루프 방지: 최대 365일까지만 탐색
    const maxAttempts = 365
    let attempts = 0

    logger.info('[calculateBusinessDate] 시작', {
      startDate: startDate.toISOString(),
      startDateKST: this.formatDateKST(currentDate),
      businessDays,
      workingDays: rule.workingDays,
    })

    while (daysAdded < businessDays && attempts < maxAttempts) {
      currentDate.setDate(currentDate.getDate() + 1)
      attempts++

      // 1. 영업 요일 확인 (workingDays에 포함되지 않으면 스킵)
      const kstComponents = this.getKSTComponents(currentDate)
      const kstDate = new Date(kstComponents.year, kstComponents.month, kstComponents.day)
      const dayOfWeek = kstDate.getDay().toString()
      const dateString = this.formatDateKST(currentDate)

      logger.debug('[calculateBusinessDate] 날짜 체크', {
        dateString,
        dayOfWeek,
        isWorkingDay: rule.workingDays.includes(dayOfWeek),
        daysAdded,
      })

      if (!rule.workingDays.includes(dayOfWeek)) {
        logger.debug('[calculateBusinessDate] 영업일 아님 - 스킵')
        continue
      }

      // 2. 커스텀 휴무일 확인
      if (rule.customClosedDates.includes(dateString)) {
        logger.debug('[calculateBusinessDate] 커스텀 휴무일 - 스킵')
        continue
      }

      // 3. 공휴일 확인 (excludeHolidays가 true일 때만) - customHolidays 전달
      const isHoliday = rule.excludeHolidays && await this.isHoliday(currentDate, customHolidays, tenantId)
      if (isHoliday) {
        logger.debug('[calculateBusinessDate] 공휴일 - 스킵')
        continue
      }

      daysAdded++
      logger.debug('[calculateBusinessDate] 영업일로 카운트', {
        dateString,
        daysAdded,
        remainingDays: businessDays - daysAdded,
      })
    }

    // 무한 루프 방지 체크
    if (attempts >= maxAttempts && daysAdded < businessDays) {
      logger.error('[calculateBusinessDate] 최대 탐색 일수 초과 - 영업일 부족', {
        requested: businessDays,
        found: daysAdded,
        attempts,
      })
      throw new Error(`영업일 계산 실패: ${businessDays}일의 영업일을 찾을 수 없습니다. (영업일 설정을 확인해주세요)`)
    }

    logger.info('[calculateBusinessDate] 완료', {
      finalDate: this.formatDateKST(currentDate),
      totalDaysAdded: daysAdded,
    })

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
   * 공휴일 여부 확인 (한국 시간대 기준)
   * customHolidays와 DB 공휴일 모두 OR 조건으로 확인
   */
  private async isHoliday(date: Date, customHolidays?: Date[], tenantId?: string): Promise<boolean> {
    // KST 날짜 문자열로 변환 (YYYY-MM-DD)
    const dateString = this.formatDateKST(date)

    // 1. 커스텀 공휴일 확인 (있으면 우선 체크, true면 즉시 반환)
    if (customHolidays && customHolidays.length > 0) {
      const isCustomHoliday = customHolidays.some((holiday) => {
        const holidayString = this.formatDateKST(holiday)
        return holidayString === dateString
      })
      if (isCustomHoliday) {
        return true // 커스텀 공휴일이면 즉시 true
      }
      // 커스텀 공휴일이 아니면 DB 공휴일도 확인 (OR 조건)
    }

    // 2. tenantId가 없으면 DB 공휴일 확인 불가
    if (!tenantId) {
      return false
    }

    // 데이터베이스 공휴일 확인 (캐싱)
    const kstComponents = this.getKSTComponents(date)
    const year = kstComponents.year
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

    return holidays.some((holiday) => {
      const holidayString = this.formatDateKST(holiday)
      return holidayString === dateString
    })
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
   * 특정 날짜가 영업일인지 확인
   */
  private async isBusinessDay(date: Date, rule: any, tenantId?: string, customHolidays?: Date[]): Promise<boolean> {
    const kstComponents = this.getKSTComponents(date)
    const kstDate = new Date(kstComponents.year, kstComponents.month, kstComponents.day)
    const dayOfWeek = kstDate.getDay().toString()
    const dateString = this.formatDateKST(date)

    // 1. 영업 요일 확인
    if (rule.workingDays && !rule.workingDays.includes(dayOfWeek)) {
      return false
    }

    // 2. 커스텀 휴무일 확인
    if (rule.customClosedDates && rule.customClosedDates.includes(dateString)) {
      return false
    }

    // 3. 공휴일 확인 (customHolidays 전달)
    if (rule.excludeHolidays && (await this.isHoliday(date, customHolidays, tenantId))) {
      return false
    }

    return true
  }

  /**
   * 다음 영업일 조회 (한국 시간대 기준)
   */
  async getNextBusinessDay(date: Date, rule?: any, tenantId?: string, customHolidays?: Date[]): Promise<Date> {
    // Date 객체 복사 (getKSTComponents에서 KST 해석하므로 변환 불필요)
    let nextDay = this.copyDate(date)
    nextDay.setDate(nextDay.getDate() + 1)

    // 무한 루프 방지
    const maxAttempts = 365
    let attempts = 0

    // 규칙이 없으면 기본 주말/공휴일 제외 로직 사용 (하위 호환성)
    if (!rule) {
      while (attempts < maxAttempts) {
        attempts++
        if (this.isWeekendKST(nextDay)) {
          nextDay.setDate(nextDay.getDate() + 1)
          continue
        }

        if (await this.isHoliday(nextDay, customHolidays, tenantId)) {
          nextDay.setDate(nextDay.getDate() + 1)
          continue
        }

        break
      }
      return nextDay
    }

    // 규칙이 있으면 정교한 로직 사용
    while (!(await this.isBusinessDay(nextDay, rule, tenantId, customHolidays)) && attempts < maxAttempts) {
      nextDay.setDate(nextDay.getDate() + 1)
      attempts++
    }

    return nextDay
  }

  /**
   * 두 날짜 간의 영업일 수 계산 (한국 시간대 기준)
   */
  async getBusinessDaysBetween(
    startDate: Date,
    endDate: Date,
    excludeWeekends: boolean = true,
    tenantId?: string,
    customHolidays?: Date[]
  ): Promise<number> {
    let count = 0
    // Date 객체 복사 (getKSTComponents에서 KST 해석하므로 변환 불필요)
    let currentDate = this.copyDate(startDate)
    const copyEndDate = this.copyDate(endDate)

    while (currentDate < copyEndDate) {
      currentDate.setDate(currentDate.getDate() + 1)

      if (excludeWeekends && this.isWeekendKST(currentDate)) {
        continue
      }

      // tenantId와 customHolidays를 전달하여 공휴일 확인
      if (await this.isHoliday(currentDate, customHolidays, tenantId)) {
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

export async function getNextBusinessDay(
  date: Date = new Date(),
  tenantId?: string,
  customHolidays?: Date[]
): Promise<Date> {
  return deliveryCalculator.getNextBusinessDay(date, undefined, tenantId, customHolidays)
}

export async function getBusinessDaysBetween(
  startDate: Date,
  endDate: Date,
  excludeWeekends: boolean = true,
  tenantId?: string,
  customHolidays?: Date[]
): Promise<number> {
  return deliveryCalculator.getBusinessDaysBetween(startDate, endDate, excludeWeekends, tenantId, customHolidays)
}
