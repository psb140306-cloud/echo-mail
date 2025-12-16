/**
 * KST (한국 표준시) 기준 날짜 유틸리티
 * 모든 날짜 계산은 KST 기준으로 수행
 */

const KST_OFFSET = 9 * 60 * 60 * 1000 // UTC+9 (밀리초)
const KST_OFFSET_HOURS = 9

/**
 * 현재 시간의 KST 날짜 컴포넌트를 반환
 * 주의: 반환되는 Date의 timestamp는 실제 현재 시간이 아닌 KST 표현용 값
 */
export function getKSTNow(): Date {
  const now = new Date()
  return new Date(now.getTime() + KST_OFFSET)
}

/**
 * 현재 KST 날짜 컴포넌트를 숫자로 반환 (더 명확한 방식)
 */
export function getKSTComponents(): { year: number; month: number; day: number; hour: number; minute: number } {
  const now = new Date()
  // UTC 시간에 9시간을 더해 KST 계산
  const kstHour = now.getUTCHours() + KST_OFFSET_HOURS
  const kstDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    kstHour,
    now.getUTCMinutes()
  ))
  return {
    year: kstDate.getUTCFullYear(),
    month: kstDate.getUTCMonth(),
    day: kstDate.getUTCDate(),
    hour: kstDate.getUTCHours(),
    minute: kstDate.getUTCMinutes(),
  }
}

/**
 * KST 기준 오늘 00:00:00을 UTC Date 객체로 반환
 * DB 쿼리 및 IMAP 검색에 사용 (UTC로 변환됨)
 *
 * 예: KST 2025-12-16 03:00 (새벽)
 *     → UTC 2025-12-15 15:00에 해당하는 Date 반환
 *     → IMAP SINCE 검색 시 "15-Dec-2025" 이후로 검색됨
 */
export function getKSTStartOfDay(): Date {
  const kst = getKSTComponents()
  // KST 오늘 00:00:00을 UTC로 변환
  // KST 00:00 = UTC 전날 15:00 (또는 같은 날 -9시간)
  const utcDate = new Date(Date.UTC(kst.year, kst.month, kst.day, 0, 0, 0, 0))
  utcDate.setTime(utcDate.getTime() - KST_OFFSET)
  return utcDate
}

/**
 * KST 기준 이번 달 1일 00:00:00을 UTC Date 객체로 반환
 * DB 쿼리에 사용 (DB는 UTC로 저장)
 */
export function getKSTStartOfMonth(): Date {
  const kst = getKSTComponents()
  const startOfMonth = new Date(Date.UTC(kst.year, kst.month, 1, 0, 0, 0, 0))
  startOfMonth.setTime(startOfMonth.getTime() - KST_OFFSET)
  return startOfMonth
}

/**
 * KST 기준 어제 00:00:00을 UTC Date 객체로 반환
 */
export function getKSTStartOfYesterday(): Date {
  const kst = getKSTComponents()
  // 어제 날짜 계산 (날짜 underflow는 Date.UTC가 자동 처리)
  const yesterday = new Date(Date.UTC(kst.year, kst.month, kst.day - 1, 0, 0, 0, 0))
  yesterday.setTime(yesterday.getTime() - KST_OFFSET)
  return yesterday
}

/**
 * KST 기준 N일 전 00:00:00을 UTC Date 객체로 반환
 * 메일 수집 시 누락 방지를 위해 여유있게 검색할 때 사용
 * @param days 며칠 전 (기본값: 3)
 */
export function getKSTStartOfDaysAgo(days: number = 3): Date {
  const kst = getKSTComponents()
  const daysAgo = new Date(Date.UTC(kst.year, kst.month, kst.day - days, 0, 0, 0, 0))
  daysAgo.setTime(daysAgo.getTime() - KST_OFFSET)
  return daysAgo
}

/**
 * KST 기준 특정 날짜의 00:00:00을 UTC Date 객체로 반환
 * @param year KST 년도
 * @param month KST 월 (1-12)
 * @param day KST 일
 */
export function getKSTDate(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  date.setTime(date.getTime() - KST_OFFSET)
  return date
}

/**
 * UTC Date를 KST 문자열로 변환 (YYYY-MM-DD HH:mm:ss)
 */
export function formatKST(date: Date): string {
  const kstDate = new Date(date.getTime() + KST_OFFSET)
  return kstDate.toISOString().replace('T', ' ').slice(0, 19)
}

/**
 * UTC Date를 KST 날짜 문자열로 변환 (YYYY-MM-DD)
 */
export function formatKSTDate(date: Date): string {
  const kstDate = new Date(date.getTime() + KST_OFFSET)
  return kstDate.toISOString().slice(0, 10)
}

/**
 * KST 기준 현재 년월 문자열 반환 (YYYY-MM)
 */
export function getKSTCurrentMonth(): string {
  const kstNow = getKSTNow()
  const year = kstNow.getUTCFullYear()
  const month = String(kstNow.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * KST 기준 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 */
export function getKSTToday(): string {
  return formatKSTDate(new Date())
}

/**
 * 두 날짜 사이의 일수 계산 (KST 기준)
 */
export function getKSTDaysDiff(date1: Date, date2: Date): number {
  const kst1 = new Date(date1.getTime() + KST_OFFSET)
  const kst2 = new Date(date2.getTime() + KST_OFFSET)

  // 시간 제거하고 날짜만 비교
  kst1.setUTCHours(0, 0, 0, 0)
  kst2.setUTCHours(0, 0, 0, 0)

  const diffTime = kst2.getTime() - kst1.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * KST 기준 특정 월의 시작일을 UTC Date 객체로 반환
 * @param monthStr YYYY-MM 형식
 */
export function getKSTMonthStart(monthStr: string): Date {
  const [year, month] = monthStr.split('-').map(Number)
  return getKSTDate(year, month, 1)
}

/**
 * KST 기준 특정 월의 마지막 일을 UTC Date 객체로 반환
 * @param monthStr YYYY-MM 형식
 */
export function getKSTMonthEnd(monthStr: string): Date {
  const [year, month] = monthStr.split('-').map(Number)
  // 다음 달 0일 = 이번 달 마지막 날
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const endOfMonth = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999))
  endOfMonth.setTime(endOfMonth.getTime() - KST_OFFSET)
  return endOfMonth
}

/**
 * UTC Date가 KST 기준 오늘인지 확인
 * @param date UTC Date 객체
 * @returns true면 KST 기준 오늘
 */
export function isKSTToday(date: Date): boolean {
  const todayKST = getKSTToday() // "YYYY-MM-DD"
  const dateKST = formatKSTDate(date) // "YYYY-MM-DD"
  return todayKST === dateKST
}
