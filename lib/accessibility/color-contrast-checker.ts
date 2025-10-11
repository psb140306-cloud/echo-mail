/**
 * WCAG 2.1 색상 대비 검증 도구
 * - AA/AAA 레벨 대비율 검증
 * - HSL/RGB/HEX 색상 변환
 * - 자동 색상 대비 개선 제안
 */

export interface ColorContrastResult {
  ratio: number
  passAA: boolean
  passAAA: boolean
  passAALarge: boolean
  passAAALarge: boolean
  level: 'AAA' | 'AA' | 'AA Large' | 'Fail'
  suggestion?: string
}

export interface ColorDefinition {
  name: string
  light: string
  dark: string
  foreground: string
}

export class ColorContrastChecker {
  // WCAG 2.1 기준
  private static readonly WCAG_AA_NORMAL = 4.5
  private static readonly WCAG_AA_LARGE = 3
  private static readonly WCAG_AAA_NORMAL = 7
  private static readonly WCAG_AAA_LARGE = 4.5

  /**
   * HSL을 RGB로 변환
   */
  static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100
    l /= 100

    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = l - c / 2

    let r = 0,
      g = 0,
      b = 0

    if (0 <= h && h < 60) {
      r = c
      g = x
      b = 0
    } else if (60 <= h && h < 120) {
      r = x
      g = c
      b = 0
    } else if (120 <= h && h < 180) {
      r = 0
      g = c
      b = x
    } else if (180 <= h && h < 240) {
      r = 0
      g = x
      b = c
    } else if (240 <= h && h < 300) {
      r = x
      g = 0
      b = c
    } else if (300 <= h && h < 360) {
      r = c
      g = 0
      b = x
    }

    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
  }

  /**
   * 상대 휘도 계산
   */
  static getRelativeLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  /**
   * 대비율 계산
   */
  static getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
    const lum1 = this.getRelativeLuminance(rgb1[0], rgb1[1], rgb1[2])
    const lum2 = this.getRelativeLuminance(rgb2[0], rgb2[1], rgb2[2])

    const lighter = Math.max(lum1, lum2)
    const darker = Math.min(lum1, lum2)

    return (lighter + 0.05) / (darker + 0.05)
  }

  /**
   * 색상 대비 검증
   */
  static checkContrast(
    foreground: [number, number, number],
    background: [number, number, number],
    fontSize: 'normal' | 'large' = 'normal'
  ): ColorContrastResult {
    const ratio = this.getContrastRatio(foreground, background)

    const passAANormal = ratio >= this.WCAG_AA_NORMAL
    const passAALarge = ratio >= this.WCAG_AA_LARGE
    const passAAANormal = ratio >= this.WCAG_AAA_NORMAL
    const passAAALarge = ratio >= this.WCAG_AAA_LARGE

    const passAA = fontSize === 'normal' ? passAANormal : passAALarge
    const passAAA = fontSize === 'normal' ? passAAANormal : passAAALarge

    let level: 'AAA' | 'AA' | 'AA Large' | 'Fail'
    if (passAAA) {
      level = 'AAA'
    } else if (passAA) {
      level = fontSize === 'large' ? 'AA Large' : 'AA'
    } else {
      level = 'Fail'
    }

    let suggestion: string | undefined
    if (!passAA) {
      const required = fontSize === 'normal' ? this.WCAG_AA_NORMAL : this.WCAG_AA_LARGE
      suggestion = `대비율 ${ratio.toFixed(2)}:1이 기준 ${required}:1에 미달합니다. 전경색을 더 어둡게 하거나 배경색을 더 밝게 조정하세요.`
    }

    return {
      ratio,
      passAA,
      passAAA,
      passAALarge,
      passAAALarge,
      level,
      suggestion,
    }
  }

  /**
   * Echo Mail 테마 색상 검증
   */
  static validateEchoMailTheme(): {
    light: ColorContrastResult[]
    dark: ColorContrastResult[]
  } {
    // Light Theme 색상 (globals.css 기준 - WCAG AA 개선)
    const lightBg = this.hslToRgb(0, 0, 100) // --background: 0 0% 100%
    const lightFg = this.hslToRgb(222.2, 84, 4.9) // --foreground: 222.2 84% 4.9%
    const lightPrimary = this.hslToRgb(217.2, 91.2, 53) // --primary: 217.2 91.2% 53% (개선)
    const lightPrimaryFg = this.hslToRgb(0, 0, 100) // --primary-foreground: 0 0% 100%
    const lightMuted = this.hslToRgb(210, 40, 96.1) // --muted: 210 40% 96.1%
    const lightMutedFg = this.hslToRgb(215.4, 16.3, 44) // --muted-foreground: 215.4 16.3% 44% (개선)

    // Dark Theme 색상
    const darkBg = this.hslToRgb(222.2, 84, 4.9) // --background: 222.2 84% 4.9%
    const darkFg = this.hslToRgb(210, 40, 98) // --foreground: 210 40% 98%
    const darkPrimary = this.hslToRgb(215, 100, 82) // --primary: 215 100% 82%
    const darkPrimaryFg = this.hslToRgb(222.2, 84, 4.9) // --primary-foreground: 222.2 84% 4.9%
    const darkMuted = this.hslToRgb(217.2, 32.6, 17.5) // --muted: 217.2 32.6% 17.5%
    const darkMutedFg = this.hslToRgb(215, 20.2, 65.1) // --muted-foreground: 215 20.2% 65.1%

    return {
      light: [
        {
          name: 'background / foreground',
          ...this.checkContrast(lightFg, lightBg),
        },
        {
          name: 'primary / primary-foreground',
          ...this.checkContrast(lightPrimaryFg, lightPrimary),
        },
        {
          name: 'muted / muted-foreground',
          ...this.checkContrast(lightMutedFg, lightMuted),
        },
      ],
      dark: [
        {
          name: 'background / foreground',
          ...this.checkContrast(darkFg, darkBg),
        },
        {
          name: 'primary / primary-foreground',
          ...this.checkContrast(darkPrimaryFg, darkPrimary),
        },
        {
          name: 'muted / muted-foreground',
          ...this.checkContrast(darkMutedFg, darkMuted),
        },
      ],
    }
  }

  /**
   * 검증 결과 출력
   */
  static printValidationReport(): void {
    const results = this.validateEchoMailTheme()

    console.log('\n=== Echo Mail 색상 대비 검증 리포트 ===\n')

    console.log('🌞 Light Theme:')
    results.light.forEach((result: any) => {
      const status = result.passAA ? '✅' : '❌'
      console.log(
        `${status} ${result.name}: ${result.ratio.toFixed(2)}:1 (${result.level})`
      )
      if (result.suggestion) {
        console.log(`   ⚠️  ${result.suggestion}`)
      }
    })

    console.log('\n🌙 Dark Theme:')
    results.dark.forEach((result: any) => {
      const status = result.passAA ? '✅' : '❌'
      console.log(
        `${status} ${result.name}: ${result.ratio.toFixed(2)}:1 (${result.level})`
      )
      if (result.suggestion) {
        console.log(`   ⚠️  ${result.suggestion}`)
      }
    })

    console.log('\n=== 검증 완료 ===\n')
  }
}

export default ColorContrastChecker
