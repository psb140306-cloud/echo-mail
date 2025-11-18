/**
 * 공휴일 계산 테스트 스크립트
 *
 * 실행 방법:
 * npx tsx scripts/test-holiday-calculator.ts
 */

import { generateHolidays } from '@/lib/utils/holiday-calculator'

console.log('🎉 2025년 한국 공휴일 계산 테스트\n')
console.log('=' .repeat(60))

const holidays = generateHolidays(2025)

console.log(`\n총 ${holidays.length}개의 공휴일이 계산되었습니다.\n`)

// 월별로 그룹화
const monthlyHolidays: { [key: string]: typeof holidays } = {}

holidays.forEach((holiday) => {
  const month = holiday.date.substring(5, 7)
  if (!monthlyHolidays[month]) {
    monthlyHolidays[month] = []
  }
  monthlyHolidays[month].push(holiday)
})

// 월별로 출력
Object.keys(monthlyHolidays)
  .sort()
  .forEach((month) => {
    console.log(`\n📅 ${month}월`)
    console.log('-'.repeat(60))
    monthlyHolidays[month].forEach((holiday) => {
      const lunarMark = holiday.isLunar ? '🌙' : '☀️'
      console.log(`  ${lunarMark} ${holiday.date} - ${holiday.name}`)
    })
  })

console.log('\n' + '='.repeat(60))

// 음력 공휴일만 따로 출력
console.log('\n🌙 음력 공휴일 (자동 계산됨)')
console.log('-'.repeat(60))
holidays
  .filter((h) => h.isLunar)
  .forEach((holiday) => {
    console.log(`  ${holiday.date} - ${holiday.name}`)
  })

console.log('\n✅ 테스트 완료!\n')
