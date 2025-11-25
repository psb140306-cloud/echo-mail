/**
 * KST (한국 표준시) 기준 날짜 유틸리티
 * 모든 날짜 계산은 KST 기준으로 수행
 */

const KST_OFFSET = 9 * 60 * 60 * 1000 // UTC+9 (밀리초)

/**
 * 현재 KST 시간을 Date 객체로 반환
 */
export function getKSTNow(): Date {
  const now = new Date()
  return new Date(now.getTime() + KST_OFFSET)
}

/**
 * KST 기준 오늘 00:00:00을 UTC Date 객체로 반환
 * DB 쿼리에 사용 (DB는 UTC로 저장)
 */
export function getKSTStartOfDay(): Date {
  const kstNow = getKSTNow()
  const startOfDay = new Date(Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate(),
    0, 0, 0, 0
  ))
  // UTC 기준으로 변환 (KST 00:00 = UTC 전날 15:00)
  startOfDay.setTime(startOfDay.getTime() - KST_OFFSET)
  return startOfDay
}

/**
 * KST 기준 이번 달 1일 00:00:00을 UTC Date 객체로 반환
 * DB 쿼리에 사용 (DB는 UTC로 저장)
 */
export function getKSTStartOfMonth(): Date {
  const kstNow = getKSTNow()
  const startOfMonth = new Date(Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    1,
    0, 0, 0, 0
  ))
  // UTC 기준으로 변환
  startOfMonth.setTime(startOfMonth.getTime() - KST_OFFSET)
  return startOfMonth
}

/**
 * KST 기준 어제 00:00:00을 UTC Date 객체로 반환
 */
export function getKSTStartOfYesterday(): Date {
  const kstNow = getKSTNow()
  const yesterday = new Date(Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate() - 1,
    0, 0, 0, 0
  ))
  yesterday.setTime(yesterday.getTime() - KST_OFFSET)
  return yesterday
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
