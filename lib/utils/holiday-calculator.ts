import { Lunar, Solar } from 'lunar-javascript'
import { logger } from './logger'

export interface Holiday {
  name: string
  date: string // YYYY-MM-DD
  isLunar: boolean
}

/**
 * 한국 공휴일 계산 유틸리티
 * 음력 공휴일 자동 계산 포함
 */
export class HolidayCalculator {
  /**
   * 특정 연도의 모든 한국 공휴일 생성
   */
  static generateHolidays(year: number): Holiday[] {
    const holidays: Holiday[] = []

    // 1. 양력 고정 공휴일
    holidays.push(...this.getSolarHolidays(year))

    // 2. 음력 공휴일 (설날, 추석)
    holidays.push(...this.getLunarHolidays(year))

    // 날짜순 정렬
    holidays.sort((a, b) => a.date.localeCompare(b.date))

    logger.info(`${year}년 공휴일 생성 완료: ${holidays.length}개`, {
      year,
      count: holidays.length,
    })

    return holidays
  }

  /**
   * 양력 고정 공휴일
   */
  private static getSolarHolidays(year: number): Holiday[] {
    return [
      { name: '신정', date: `${year}-01-01`, isLunar: false },
      { name: '삼일절', date: `${year}-03-01`, isLunar: false },
      { name: '어린이날', date: `${year}-05-05`, isLunar: false },
      { name: '현충일', date: `${year}-06-06`, isLunar: false },
      { name: '광복절', date: `${year}-08-15`, isLunar: false },
      { name: '개천절', date: `${year}-10-03`, isLunar: false },
      { name: '한글날', date: `${year}-10-09`, isLunar: false },
      { name: '크리스마스', date: `${year}-12-25`, isLunar: false },

      // 대체공휴일 계산 (어린이날, 광복절 등)
      ...this.calculateSubstituteHolidays(year),
    ]
  }

  /**
   * 음력 공휴일 (설날, 추석)
   */
  private static getLunarHolidays(year: number): Holiday[] {
    const holidays: Holiday[] = []

    try {
      // 설날 (음력 1월 1일) - 전날, 당일, 다음날 (3일)
      const seollal = this.lunarToSolar(year, 1, 1)
      if (seollal) {
        const seollalDate = new Date(seollal)

        // 설날 전날
        const seollalPrev = new Date(seollalDate)
        seollalPrev.setDate(seollalDate.getDate() - 1)
        holidays.push({
          name: '설날 연휴',
          date: this.formatDate(seollalPrev),
          isLunar: true,
        })

        // 설날 당일
        holidays.push({
          name: '설날',
          date: this.formatDate(seollalDate),
          isLunar: true,
        })

        // 설날 다음날
        const seollalNext = new Date(seollalDate)
        seollalNext.setDate(seollalDate.getDate() + 1)
        holidays.push({
          name: '설날 연휴',
          date: this.formatDate(seollalNext),
          isLunar: true,
        })
      }

      // 추석 (음력 8월 15일) - 전날, 당일, 다음날 (3일)
      const chuseok = this.lunarToSolar(year, 8, 15)
      if (chuseok) {
        const chuseokDate = new Date(chuseok)

        // 추석 전날
        const chuseokPrev = new Date(chuseokDate)
        chuseokPrev.setDate(chuseokDate.getDate() - 1)
        holidays.push({
          name: '추석 연휴',
          date: this.formatDate(chuseokPrev),
          isLunar: true,
        })

        // 추석 당일
        holidays.push({
          name: '추석',
          date: this.formatDate(chuseokDate),
          isLunar: true,
        })

        // 추석 다음날
        const chuseokNext = new Date(chuseokDate)
        chuseokNext.setDate(chuseokDate.getDate() + 1)
        holidays.push({
          name: '추석 연휴',
          date: this.formatDate(chuseokNext),
          isLunar: true,
        })
      }

      // 석가탄신일 (음력 4월 8일)
      const buddha = this.lunarToSolar(year, 4, 8)
      if (buddha) {
        holidays.push({
          name: '석가탄신일',
          date: this.formatDate(new Date(buddha)),
          isLunar: true,
        })
      }

      logger.info(`${year}년 음력 공휴일 계산 완료`, {
        year,
        count: holidays.length,
        holidays: holidays.map((h) => `${h.name} (${h.date})`),
      })
    } catch (error) {
      logger.error('음력 공휴일 계산 실패:', error)
    }

    return holidays
  }

  /**
   * 음력 날짜를 양력으로 변환
   */
  private static lunarToSolar(year: number, month: number, day: number): string | null {
    try {
      const lunar = Lunar.fromYmd(year, month, day)
      const solar = lunar.getSolar()

      return `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`
    } catch (error) {
      logger.error('음력->양력 변환 실패:', { year, month, day, error })
      return null
    }
  }

  /**
   * 대체공휴일 계산
   * 어린이날, 광복절, 개천절, 한글날이 토요일이면 다음 월요일이 대체공휴일
   * 일요일이면 다음 월요일이 대체공휴일
   */
  private static calculateSubstituteHolidays(year: number): Holiday[] {
    const substitutes: Holiday[] = []

    const checkDates = [
      { name: '어린이날', date: `${year}-05-05` },
      { name: '광복절', date: `${year}-08-15` },
      { name: '개천절', date: `${year}-10-03` },
      { name: '한글날', date: `${year}-10-09` },
    ]

    for (const holiday of checkDates) {
      const date = new Date(holiday.date)
      const dayOfWeek = date.getDay()

      // 토요일(6) 또는 일요일(0)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // 다음 월요일 계산
        const daysToAdd = dayOfWeek === 0 ? 1 : 2
        const substituteDate = new Date(date)
        substituteDate.setDate(date.getDate() + daysToAdd)

        substitutes.push({
          name: `${holiday.name} 대체공휴일`,
          date: this.formatDate(substituteDate),
          isLunar: false,
        })
      }
    }

    // 설날/추석 대체공휴일은 음력 계산 후 처리 필요 (복잡도 높아 일단 제외)
    return substitutes
  }

  /**
   * Date 객체를 YYYY-MM-DD 형식으로 변환
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 특정 날짜가 공휴일인지 확인
   */
  static isHoliday(date: Date, holidays: Holiday[]): boolean {
    const dateString = this.formatDate(date)
    return holidays.some((h) => h.date === dateString)
  }

  /**
   * 여러 연도의 공휴일을 한번에 생성
   */
  static generateMultiYearHolidays(startYear: number, endYear: number): Holiday[] {
    const allHolidays: Holiday[] = []

    for (let year = startYear; year <= endYear; year++) {
      allHolidays.push(...this.generateHolidays(year))
    }

    logger.info(`${startYear}-${endYear}년 공휴일 생성 완료: ${allHolidays.length}개`)

    return allHolidays
  }
}

// 편의 함수들
export function generateHolidays(year: number): Holiday[] {
  return HolidayCalculator.generateHolidays(year)
}

export function generateMultiYearHolidays(startYear: number, endYear: number): Holiday[] {
  return HolidayCalculator.generateMultiYearHolidays(startYear, endYear)
}

export function isHoliday(date: Date, holidays: Holiday[]): boolean {
  return HolidayCalculator.isHoliday(date, holidays)
}
