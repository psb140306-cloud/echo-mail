import { PrismaClient } from '@prisma/client'
import { templateManager } from '../lib/notifications/templates/template-manager'

const prisma = new PrismaClient()

async function createDefaultTemplatesForAllTenants() {
  try {
    console.log('모든 테넌트에 기본 템플릿 생성 시작...')

    // 모든 테넌트 조회
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        ownerEmail: true,
      },
    })

    console.log(`총 ${tenants.length}개 테넌트 발견`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (const tenant of tenants) {
      console.log(`\n처리 중: ${tenant.name} (${tenant.ownerEmail})`)

      try {
        // 이미 템플릿이 있는지 확인
        const existingTemplates = await prisma.messageTemplate.count({
          where: { tenantId: tenant.id },
        })

        if (existingTemplates > 0) {
          console.log(`  ⏭️  이미 ${existingTemplates}개 템플릿 존재 - 스킵`)
          skipCount++
          continue
        }

        // 기본 템플릿 생성
        await templateManager.createDefaultTemplatesForTenant(tenant.id)
        console.log(`  ✅ 기본 템플릿 생성 완료`)
        successCount++
      } catch (error) {
        console.error(`  ❌ 템플릿 생성 실패:`, error)
        errorCount++
      }
    }

    console.log(`\n===== 완료 =====`)
    console.log(`성공: ${successCount}개`)
    console.log(`스킵: ${skipCount}개`)
    console.log(`실패: ${errorCount}개`)
  } catch (error) {
    console.error('스크립트 실행 실패:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createDefaultTemplatesForAllTenants()
