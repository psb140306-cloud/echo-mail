#!/usr/bin/env node

/**
 * shadcn/ui 초기화 및 컴포넌트 설치 스크립트
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

// 명령 실행 헬퍼
function executeCommand(command, description) {
  console.log(`${colors.cyan}⚡ ${description}...${colors.reset}`)
  try {
    execSync(command, { stdio: 'inherit' })
    console.log(`${colors.green}✅ ${description} 완료${colors.reset}\n`)
    return true
  } catch (error) {
    console.error(`${colors.red}❌ ${description} 실패${colors.reset}`)
    console.error(error.message)
    return false
  }
}

// 기본 컴포넌트 목록
const basicComponents = [
  'button',
  'card',
  'input',
  'label',
  'form',
  'toast',
  'toaster',
  'alert',
  'alert-dialog',
  'badge',
  'avatar',
  'calendar',
  'checkbox',
  'dialog',
  'dropdown-menu',
  'popover',
  'progress',
  'radio-group',
  'scroll-area',
  'select',
  'separator',
  'sheet',
  'switch',
  'table',
  'tabs',
  'textarea',
  'tooltip',
]

// 고급 컴포넌트 목록
const advancedComponents = [
  'data-table',
  'command',
  'accordion',
  'collapsible',
  'context-menu',
  'hover-card',
  'menubar',
  'navigation-menu',
  'pagination',
  'resizable',
  'slider',
  'sonner',
  'toggle',
  'toggle-group',
]

function main() {
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════`)
  console.log(`        shadcn/ui 초기화 스크립트`)
  console.log(`═══════════════════════════════════════════${colors.reset}\n`)

  // components.json 파일 존재 확인
  const componentsJsonPath = path.join(process.cwd(), 'components.json')
  if (!fs.existsSync(componentsJsonPath)) {
    console.error(`${colors.red}❌ components.json 파일이 없습니다.${colors.reset}`)
    console.log(`${colors.yellow}먼저 components.json 파일을 생성해주세요.${colors.reset}`)
    process.exit(1)
  }

  console.log(`${colors.green}✅ components.json 파일 확인됨${colors.reset}\n`)

  // 기본 컴포넌트 설치
  console.log(`${colors.bright}${colors.blue}━━━ 기본 컴포넌트 설치 ━━━${colors.reset}`)
  let installedCount = 0

  for (const component of basicComponents) {
    const success = executeCommand(
      `npx shadcn-ui@latest add ${component} --yes`,
      `${component} 컴포넌트 설치`
    )
    if (success) installedCount++
  }

  console.log(
    `${colors.bright}${colors.green}기본 컴포넌트 설치 완료: ${installedCount}/${basicComponents.length}개${colors.reset}\n`
  )

  // 고급 컴포넌트 설치 여부 확인
  const args = process.argv.slice(2)
  const installAdvanced = args.includes('--advanced') || args.includes('-a')

  if (installAdvanced) {
    console.log(`${colors.bright}${colors.blue}━━━ 고급 컴포넌트 설치 ━━━${colors.reset}`)
    let advancedInstalledCount = 0

    for (const component of advancedComponents) {
      const success = executeCommand(
        `npx shadcn-ui@latest add ${component} --yes`,
        `${component} 컴포넌트 설치`
      )
      if (success) advancedInstalledCount++
    }

    console.log(
      `${colors.bright}${colors.green}고급 컴포넌트 설치 완료: ${advancedInstalledCount}/${advancedComponents.length}개${colors.reset}\n`
    )
  } else {
    console.log(
      `${colors.yellow}💡 고급 컴포넌트를 설치하려면 --advanced 플래그를 사용하세요:${colors.reset}`
    )
    console.log(`${colors.cyan}   npm run shadcn:init -- --advanced${colors.reset}\n`)
  }

  // UI 폴더 구조 확인
  const uiPath = path.join(process.cwd(), 'components', 'ui')
  if (fs.existsSync(uiPath)) {
    const uiFiles = fs.readdirSync(uiPath)
    console.log(`${colors.bright}${colors.blue}━━━ 설치된 UI 컴포넌트 ━━━${colors.reset}`)
    uiFiles.forEach((file) => {
      console.log(`${colors.green}✓${colors.reset} ${file}`)
    })
    console.log(
      `\n${colors.bright}총 ${uiFiles.length}개 컴포넌트가 설치되었습니다.${colors.reset}`
    )
  }

  // 사용법 안내
  console.log(`\n${colors.bright}${colors.blue}━━━ 사용법 ━━━${colors.reset}`)
  console.log(`${colors.cyan}개별 컴포넌트 추가:${colors.reset}`)
  console.log(`  npx shadcn-ui@latest add [component-name]`)
  console.log(`\n${colors.cyan}예시:${colors.reset}`)
  console.log(`  npx shadcn-ui@latest add skeleton`)
  console.log(`  npx shadcn-ui@latest add breadcrumb`)

  console.log(
    `\n${colors.bright}${colors.blue}═══════════════════════════════════════════${colors.reset}`
  )
  console.log(`${colors.green}🎉 shadcn/ui 설치가 완료되었습니다!${colors.reset}`)
  console.log(
    `${colors.bright}${colors.blue}═══════════════════════════════════════════${colors.reset}`
  )
}

// 스크립트 실행
if (require.main === module) {
  main()
}
