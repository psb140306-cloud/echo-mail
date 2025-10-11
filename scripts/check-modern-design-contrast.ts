import { ColorContrastChecker } from '../lib/accessibility/color-contrast-checker'

// 새로운 페이지의 주요 색상 조합 체크 (RGB 값 직접 지정)
const combinations: Array<{ name: string; fg: [number, number, number]; bg: [number, number, number] }> = [
  // Aurora Background - 그라디언트 색상들
  { name: 'Blue-600 on White', fg: [37, 99, 235], bg: [255, 255, 255] }, // blue-600
  { name: 'Purple-600 on White', fg: [147, 51, 234], bg: [255, 255, 255] }, // purple-600

  // GradientText on light background
  { name: 'Blue-600 on Light Blue BG', fg: [37, 99, 235], bg: [239, 246, 255] }, // slate-50

  // Footer text
  { name: 'Gray-600 on Light Background', fg: [75, 85, 99], bg: [239, 246, 255] }, // gray-600

  // GlassmorphismCard - 반투명 배경 근사값
  { name: 'Dark text on Glassmorphism', fg: [15, 23, 42], bg: [242, 242, 242] }, // slate-900 on gray-100

  // Button text
  { name: 'White on Blue-600', fg: [255, 255, 255], bg: [37, 99, 235] },
  { name: 'White on Purple-600', fg: [255, 255, 255], bg: [147, 51, 234] },

  // Stats cards
  { name: 'Blue-600 on White Card', fg: [37, 99, 235], bg: [255, 255, 255] },
  { name: 'Green-600 on White Card', fg: [22, 163, 74], bg: [255, 255, 255] }, // green-600
  { name: 'Purple-600 on White Card', fg: [147, 51, 234], bg: [255, 255, 255] },
]

console.log('\n🎨 Echo Mail 모던 디자인 색상 대비 검증\n')
console.log('='.repeat(80))

let passCount = 0
let failCount = 0

combinations.forEach(combo => {
  const result = ColorContrastChecker.checkContrast(combo.fg, combo.bg, 'normal')

  const status = result.passAA ? '✅ PASS' : '❌ FAIL'

  console.log(`\n${status} ${combo.name}`)
  console.log(`   대비율: ${result.ratio.toFixed(2)}:1`)
  console.log(`   등급: ${result.level}`)
  console.log(`   AA 기준 (4.5:1): ${result.passAA ? '통과' : '미달'}`)
  console.log(`   AAA 기준 (7:1): ${result.passAAA ? '통과' : '미달'}`)

  if (result.suggestion) {
    console.log(`   💡 제안: ${result.suggestion}`)
  }

  if (result.passAA) passCount++
  else failCount++
})

console.log('\n' + '='.repeat(80))
console.log(`\n📊 결과: ${passCount}개 통과, ${failCount}개 실패`)
console.log(`성공률: ${((passCount / combinations.length) * 100).toFixed(1)}%\n`)
