import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 데이터베이스 시드 데이터 생성 시작...')

  // =============================================================================
  // 테스트 테넌트 생성
  // =============================================================================

  // Supabase Auth에서 생성된 테스트 사용자 ID
  // 실제로는 Supabase Dashboard에서 생성하거나 회원가입을 통해 생성된 UUID를 사용
  const TEST_USER_ID = '00000000-0000-0000-0000-000000000001' // 예시 UUID
  const TEST_USER_EMAIL = 'test@echomail.com'
  const TEST_USER_NAME = '테스트 사용자'

  const testTenant = await prisma.tenant.upsert({
    where: { subdomain: 'test' },
    update: {},
    create: {
      name: '테스트 회사',
      subdomain: 'test',
      ownerId: TEST_USER_ID,
      ownerEmail: TEST_USER_EMAIL,
      ownerName: TEST_USER_NAME,
      subscriptionPlan: 'PROFESSIONAL',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년 후
      maxCompanies: 50,
      maxContacts: 300,
      maxEmails: 5000,
      maxNotifications: 10000,
    },
  })

  console.log('✅ 테스트 테넌트 생성:', testTenant.subdomain)

  // 테넌트 멤버 생성 (OWNER)
  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: testTenant.id,
        userId: TEST_USER_ID,
      },
    },
    update: {},
    create: {
      tenantId: testTenant.id,
      userId: TEST_USER_ID,
      userEmail: TEST_USER_EMAIL,
      userName: TEST_USER_NAME,
      role: 'OWNER',
      status: 'ACTIVE',
      acceptedAt: new Date(),
    },
  })

  console.log('✅ 테넌트 소유자 멤버십 생성 완료')

  // =============================================================================
  // 샘플 데이터 생성 (업체, 담당자)
  // =============================================================================

  // 샘플 업체 1
  const company1 = await prisma.company.create({
    data: {
      name: '서울 철강',
      email: 'seoul-steel@example.com',
      region: '서울',
      tenantId: testTenant.id,
      isActive: true,
    },
  })

  // 샘플 담당자 1-1
  await prisma.contact.create({
    data: {
      name: '김철수',
      phone: '010-1234-5678',
      email: 'kim@seoul-steel.com',
      position: '구매 담당',
      companyId: company1.id,
      tenantId: testTenant.id,
      isActive: true,
      smsEnabled: true,
      kakaoEnabled: false,
    },
  })

  // 샘플 담당자 1-2
  await prisma.contact.create({
    data: {
      name: '이영희',
      phone: '010-2345-6789',
      email: 'lee@seoul-steel.com',
      position: '부장',
      companyId: company1.id,
      tenantId: testTenant.id,
      isActive: true,
      smsEnabled: true,
      kakaoEnabled: true,
    },
  })

  console.log('✅ 샘플 업체 1 생성:', company1.name)

  // 샘플 업체 2
  const company2 = await prisma.company.create({
    data: {
      name: '부산 건설',
      email: 'busan-construction@example.com',
      region: '부산',
      tenantId: testTenant.id,
      isActive: true,
    },
  })

  // 샘플 담당자 2-1
  await prisma.contact.create({
    data: {
      name: '박민수',
      phone: '010-3456-7890',
      email: 'park@busan-construction.com',
      position: '자재 담당',
      companyId: company2.id,
      tenantId: testTenant.id,
      isActive: true,
      smsEnabled: true,
      kakaoEnabled: false,
    },
  })

  console.log('✅ 샘플 업체 2 생성:', company2.name)

  // =============================================================================
  // 납품 규칙 생성
  // =============================================================================

  await prisma.deliveryRule.create({
    data: {
      region: '서울',
      morningCutoff: '09:00',
      afternoonCutoff: '14:00',
      morningDeliveryDays: 1,
      afternoonDeliveryDays: 2,
      excludeWeekends: true,
      excludeHolidays: true,
      tenantId: testTenant.id,
      isActive: true,
    },
  })

  await prisma.deliveryRule.create({
    data: {
      region: '부산',
      morningCutoff: '10:00',
      afternoonCutoff: '15:00',
      morningDeliveryDays: 2,
      afternoonDeliveryDays: 3,
      excludeWeekends: true,
      excludeHolidays: true,
      tenantId: testTenant.id,
      isActive: true,
    },
  })

  console.log('✅ 납품 규칙 생성 완료')

  // =============================================================================
  // 공휴일 생성
  // =============================================================================

  const currentYear = new Date().getFullYear()

  const holidays = [
    { date: new Date(`${currentYear}-01-01`), name: '신정' },
    { date: new Date(`${currentYear}-03-01`), name: '삼일절' },
    { date: new Date(`${currentYear}-05-05`), name: '어린이날' },
    { date: new Date(`${currentYear}-06-06`), name: '현충일' },
    { date: new Date(`${currentYear}-08-15`), name: '광복절' },
    { date: new Date(`${currentYear}-10-03`), name: '개천절' },
    { date: new Date(`${currentYear}-10-09`), name: '한글날' },
    { date: new Date(`${currentYear}-12-25`), name: '크리스마스' },
  ]

  for (const holiday of holidays) {
    await prisma.holiday.create({
      data: {
        date: holiday.date,
        name: holiday.name,
        tenantId: testTenant.id,
      },
    })
  }

  console.log('✅ 공휴일 생성 완료')

  // =============================================================================
  // 메시지 템플릿 생성
  // =============================================================================

  // SMS 템플릿 - 발주 접수 알림 (90바이트 이하로 최적화)
  await prisma.messageTemplate.upsert({
    where: {
      tenantId_name: {
        tenantId: testTenant.id,
        name: 'ORDER_RECEIVED_SMS',
      },
    },
    update: {},
    create: {
      name: 'ORDER_RECEIVED_SMS',
      type: 'SMS',
      content:
        '[발주접수] {{companyName}}님 발주확인. 납품:{{shortDate}} {{deliveryTime}}',
      variables: {
        companyName: '업체명',
        shortDate: '날짜',
        deliveryTime: '시간',
      },
      tenantId: testTenant.id,
      isActive: true,
      isDefault: true,
    },
  })

  // 카카오 알림톡 템플릿 - 발주 접수 알림
  await prisma.messageTemplate.upsert({
    where: {
      tenantId_name: {
        tenantId: testTenant.id,
        name: 'ORDER_RECEIVED_KAKAO',
      },
    },
    update: {},
    create: {
      name: 'ORDER_RECEIVED_KAKAO',
      type: 'KAKAO_ALIMTALK',
      subject: '발주 접수 알림',
      content: `안녕하세요, {{companyName}}님.

발주가 접수되었습니다.

납품 예정일: {{deliveryDate}}
납품 시간대: {{deliveryTime}}

감사합니다.`,
      variables: {
        companyName: '업체명',
        deliveryDate: '납품일',
        deliveryTime: '납품 시간대',
      },
      tenantId: testTenant.id,
      isActive: true,
      isDefault: true,
    },
  })

  console.log('✅ 메시지 템플릿 생성 완료')

  console.log('🎉 시드 데이터 생성 완료!')
}

main()
  .catch((e) => {
    console.error('❌ 시드 데이터 생성 실패:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
