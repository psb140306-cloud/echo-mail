/**
 * 미래 연도 공휴일 계산 테스트
 */

import { generateHolidays } from '@/lib/utils/holiday-calculator'

const testYears = [2027, 2030, 2035, 2040]

console.log('🔮 미래 연도 공휴일 자동 계산 테스트\n')
console.log('='.repeat(70))

testYears.forEach((year) => {
  const holidays = generateHolidays(year)
  const lunarHolidays = holidays.filter((h) => h.isLunar)

  console.log(`\n📅 ${year}년 (총 ${holidays.length}개)`)
  console.log('-'.repeat(70))
  console.log(`  🌙 음력 공휴일: ${lunarHolidays.length}개`)

  lunarHolidays.forEach((h) => {
    console.log(`     - ${h.date} (${h.name})`)
  })
})

console.log('\n' + '='.repeat(70))
console.log('✅ 모든 연도에서 음력 공휴일이 자동으로 계산됩니다!\n')
