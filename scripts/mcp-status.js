#!/usr/bin/env node

/**
 * MCP 서버 상태 확인 스크립트
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const MCP_CONFIG_PATH = path.join(__dirname, '..', '.MCP.json')

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

// MCP 설정 로드
function loadMCPConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, 'utf8'))
    return config
  } catch (error) {
    console.error(`${colors.red}❌ .MCP.json 파일을 읽을 수 없습니다.${colors.reset}`)
    process.exit(1)
  }
}

// 명령 실행
function executeCommand(command) {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' })
    return { success: true, output: output.trim() }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// MCP 서버 상태 확인
function checkMCPStatus(serverName, config) {
  const server = config.servers[serverName]

  console.log(`\n${colors.cyan}━━━ ${serverName.toUpperCase()} MCP ━━━${colors.reset}`)
  console.log(`📝 설명: ${server.description}`)
  console.log(`🏷️  단계: ${server.installStage}`)

  // 설치 상태
  if (server.installed) {
    console.log(`${colors.green}✅ 설치됨${colors.reset}`)
  } else {
    console.log(`${colors.yellow}⚠️  미설치${colors.reset}`)
  }

  // 활성화 상태
  if (server.enabled) {
    console.log(`${colors.green}🟢 활성화됨${colors.reset}`)
  } else {
    console.log(`${colors.yellow}🔴 비활성화됨${colors.reset}`)
  }

  // 환경변수 확인
  console.log('\n환경변수 상태:')
  if (server.config && server.config.env) {
    for (const [key, value] of Object.entries(server.config.env)) {
      const envKey = key.replace('${', '').replace('}', '')
      const envValue = process.env[envKey]

      if (envValue) {
        console.log(`  ${colors.green}✓${colors.reset} ${envKey}: 설정됨`)
      } else {
        console.log(`  ${colors.red}✗${colors.reset} ${envKey}: ${colors.red}미설정${colors.reset}`)
      }
    }
  }
}

// 메인 함수
function main() {
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════`)
  console.log(`          MCP 서버 상태 확인`)
  console.log(`═══════════════════════════════════════════${colors.reset}`)

  const config = loadMCPConfig()

  console.log(`\n📦 프로젝트: ${config.name}`)
  console.log(`📌 버전: ${config.version}`)
  console.log(`📝 설명: ${config.description}`)

  // 각 MCP 서버 상태 확인
  for (const serverName of Object.keys(config.servers)) {
    checkMCPStatus(serverName, config)
  }

  // 설치 단계별 요약
  console.log(`\n${colors.bright}${colors.blue}━━━ 설치 단계별 요약 ━━━${colors.reset}`)

  for (const [stageName, stage] of Object.entries(config.installStages)) {
    console.log(`\n${colors.cyan}[${stageName}] ${stage.name}${colors.reset}`)
    console.log(`  ${stage.description}`)
    console.log('  서버:')

    for (const serverName of stage.servers) {
      const server = config.servers[serverName]
      const statusIcon = server.installed ? '✅' : '⬜'
      const enabledIcon = server.enabled ? '🟢' : '🔴'
      console.log(`    ${statusIcon} ${enabledIcon} ${serverName}`)
    }
  }

  // 통계
  const servers = Object.values(config.servers)
  const installedCount = servers.filter((s) => s.installed).length
  const enabledCount = servers.filter((s) => s.enabled).length
  const totalCount = servers.length

  console.log(`\n${colors.bright}${colors.blue}━━━ 통계 ━━━${colors.reset}`)
  console.log(`전체 MCP 서버: ${totalCount}개`)
  console.log(`설치된 서버: ${colors.green}${installedCount}개${colors.reset}`)
  console.log(`활성화된 서버: ${colors.green}${enabledCount}개${colors.reset}`)
  console.log(`미설치 서버: ${colors.yellow}${totalCount - installedCount}개${colors.reset}`)

  // 권장 사항
  if (installedCount < totalCount) {
    console.log(`\n${colors.yellow}💡 권장 사항:${colors.reset}`)

    const uninstalledServers = Object.entries(config.servers)
      .filter(([_, server]) => !server.installed)
      .map(([name, _]) => name)

    console.log(`다음 MCP 서버를 설치하세요: ${uninstalledServers.join(', ')}`)
    console.log(`설치 가이드: docs/mcp-setup.md 참고`)
  }

  console.log(
    `\n${colors.bright}${colors.blue}═══════════════════════════════════════════${colors.reset}`
  )
}

// 스크립트 실행
if (require.main === module) {
  main()
}
