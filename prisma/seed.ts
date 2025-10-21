import { PrismaClient, NotificationType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 데이터베이스 시드 데이터 생성 시작...')

  // =============================================================================
  // 테스트 테넌트 생성
  // =============================================================================
  const testTenant = await prisma.tenant.upsert({
    where: { subdomain: 'test' },
    update: {},
    create: {
      name: '테스트 회사',
      subdomain: 'test',
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

  // =============================================================================
  // 테스트 계정 생성 (이메일 인증 완료)
  // =============================================================================
  const testHashedPassword = await bcrypt.hash('test123!', 12)

  const testUser = await prisma.user.upsert({
    where: { email: 'test@echomail.com' },
    update: {},
    create: {
      email: 'test@echomail.com',
      name: '테스트 사용자',
      password: testHashedPassword,
      role: 'ADMIN',
      emailVerified: new Date(), // 이메일 인증 완료
      tenantId: testTenant.id,
    },
  })

  console.log('✅ 테스트 계정 생성:', testUser.email, '(이메일 인증 완료)')

  // 테넌트-사용자 관계 설정 (OWNER 역할)
  await prisma.tenantUser.upsert({
    where: {
      tenantId_userId: {
        tenantId: testTenant.id,
        userId: testUser.id,
      },
    },
    update: {},
    create: {
      tenantId: testTenant.id,
      userId: testUser.id,
      role: 'OWNER',
      acceptedAt: new Date(),
    },
  })

  // 테넌트 소유자 설정
  await prisma.tenant.update({
    where: { id: testTenant.id },
    data: { ownerId: testUser.id },
  })

  console.log('✅ 테넌트-사용자 관계 설정 완료')

  // =============================================================================
  // 관리자 계정 생성 (슈퍼 관리자 - tenantId 없음)
  // =============================================================================
  const hashedPassword = await bcrypt.hash('admin123!', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@echomail.com' },
    update: {},
    create: {
      email: 'admin@echomail.com',
      name: '시스템 관리자',
      password: hashedPassword,
      role: 'ADMIN',
      emailVerified: new Date(), // 이메일 인증 완료
      // tenantId 없음 (슈퍼 관리자)
    },
  })

  console.log('✅ 슈퍼 관리자 계정 생성:', admin.email)

  // =============================================================================
  // 시스템 설정
  // =============================================================================
  const systemConfigs = [
    {
      key: 'MAIL_CHECK_INTERVAL',
      value: '30000',
      description: '메일 체크 간격 (밀리초)',
      category: 'mail',
    },
    {
      key: 'SMS_RATE_LIMIT',
      value: '100',
      description: '분당 SMS 발송 제한',
      category: 'notification',
    },
    {
      key: 'KAKAO_RATE_LIMIT',
      value: '200',
      description: '분당 카카오톡 발송 제한',
      category: 'notification',
    },
    {
      key: 'DEFAULT_RETRY_COUNT',
      value: '3',
      description: '기본 재시도 횟수',
      category: 'notification',
    },
  ]

  for (const config of systemConfigs) {
    await prisma.systemConfig.upsert({
      where: {
        tenantId_key: {
          tenantId: testTenant.id,
          key: config.key,
        },
      },
      update: config,
      create: {
        ...config,
        tenantId: testTenant.id,
      },
    })
  }

  console.log('✅ 시스템 설정 생성 완료')

  // =============================================================================
  // 메시지 템플릿
  // =============================================================================
  const messageTemplates = [
    {
      name: 'ORDER_RECEIVED_SMS',
      type: NotificationType.SMS,
      content:
        '[발주 접수 알림]\n{{companyName}}님의 발주가 접수되었습니다.\n납품 예정일: {{deliveryDate}} {{deliveryTime}}\n감사합니다.',
      variables: ['companyName', 'deliveryDate', 'deliveryTime'],
      isDefault: true,
    },
    {
      name: 'ORDER_RECEIVED_KAKAO',
      type: NotificationType.KAKAO_ALIMTALK,
      subject: '발주 접수 확인',
      content:
        '{{companyName}}님의 발주가 정상적으로 접수되었습니다.\n\n📦 납품 예정일: {{deliveryDate}} {{deliveryTime}}\n\n문의사항이 있으시면 언제든 연락 주세요.\n감사합니다.',
      variables: ['companyName', 'deliveryDate', 'deliveryTime'],
      isDefault: true,
    },
  ]

  for (const template of messageTemplates) {
    await prisma.messageTemplate.upsert({
      where: {
        tenantId_name: {
          tenantId: testTenant.id,
          name: template.name,
        },
      },
      update: template,
      create: {
        ...template,
        tenantId: testTenant.id,
      },
    })
  }

  console.log('✅ 메시지 템플릿 생성 완료')

  // =============================================================================
  // 테스트용 업체 데이터
  // =============================================================================
  const testCompanies = [
    {
      name: '대한상사',
      email: 'order@daehan.co.kr',
      region: '서울',
      contacts: [
        {
          name: '김대리',
          phone: '010-1234-5678',
          email: 'kim@daehan.co.kr',
          position: '구매담당',
        },
      ],
    },
    {
      name: '부산물산',
      email: 'purchase@busan.co.kr',
      region: '부산',
      contacts: [
        {
          name: '이과장',
          phone: '010-2345-6789',
          email: 'lee@busan.co.kr',
          position: '구매과장',
        },
      ],
    },
  ]

  for (const companyData of testCompanies) {
    const { contacts, ...company } = companyData

    const createdCompany = await prisma.company.upsert({
      where: {
        tenantId_email: {
          tenantId: testTenant.id,
          email: company.email,
        },
      },
      update: company,
      create: {
        ...company,
        tenantId: testTenant.id,
      },
    })

    // 담당자 생성
    for (const contact of contacts) {
      await prisma.contact.upsert({
        where: {
          id: `${testTenant.id}-${createdCompany.id}-${contact.phone}`,
        },
        update: contact,
        create: {
          ...contact,
          companyId: createdCompany.id,
          tenantId: testTenant.id,
        },
      })
    }
  }

  console.log('✅ 테스트 업체 데이터 생성 완료')

  // =============================================================================
  // 기본 납품 규칙
  // =============================================================================
  const deliveryRules = [
    {
      region: '서울',
      morningCutoff: '12:00',
      afternoonCutoff: '18:00',
      morningDeliveryDays: 1,
      afternoonDeliveryDays: 1,
    },
    {
      region: '부산',
      morningCutoff: '11:00',
      afternoonCutoff: '17:00',
      morningDeliveryDays: 1,
      afternoonDeliveryDays: 2,
    },
    {
      region: '대구',
      morningCutoff: '11:30',
      afternoonCutoff: '17:30',
      morningDeliveryDays: 1,
      afternoonDeliveryDays: 2,
    },
  ]

  for (const rule of deliveryRules) {
    await prisma.deliveryRule.upsert({
      where: {
        tenantId_region: {
          tenantId: testTenant.id,
          region: rule.region,
        },
      },
      update: rule,
      create: {
        ...rule,
        tenantId: testTenant.id,
      },
    })
  }

  console.log('✅ 납품 규칙 생성 완료')

  // =============================================================================
  // 공휴일 데이터 (2025년 기준)
  // =============================================================================
  const holidays = [
    { date: new Date('2025-01-01'), name: '신정', isRecurring: true },
    { date: new Date('2025-01-28'), name: '설날 연휴', isRecurring: false },
    { date: new Date('2025-01-29'), name: '설날', isRecurring: false },
    { date: new Date('2025-01-30'), name: '설날 연휴', isRecurring: false },
    { date: new Date('2025-03-01'), name: '삼일절', isRecurring: true },
    { date: new Date('2025-05-05'), name: '어린이날', isRecurring: true },
    { date: new Date('2025-05-06'), name: '석가탄신일', isRecurring: false },
    { date: new Date('2025-06-06'), name: '현충일', isRecurring: true },
    { date: new Date('2025-08-15'), name: '광복절', isRecurring: true },
    { date: new Date('2025-10-03'), name: '개천절', isRecurring: true },
    { date: new Date('2025-10-06'), name: '추석 연휴', isRecurring: false },
    { date: new Date('2025-10-07'), name: '추석', isRecurring: false },
    { date: new Date('2025-10-08'), name: '추석 연휴', isRecurring: false },
    { date: new Date('2025-10-09'), name: '한글날', isRecurring: true },
    { date: new Date('2025-12-25'), name: '크리스마스', isRecurring: true },
  ]

  for (const holiday of holidays) {
    await prisma.holiday.upsert({
      where: {
        tenantId_date: {
          tenantId: testTenant.id,
          date: holiday.date,
        },
      },
      update: holiday,
      create: {
        ...holiday,
        tenantId: testTenant.id,
      },
    })
  }

  console.log('✅ 공휴일 데이터 생성 완료')

  console.log('\n🎉 데이터베이스 시드 데이터 생성 완료!')
  console.log('\n📝 테스트 계정 정보:')
  console.log('  - 이메일: test@echomail.com')
  console.log('  - 비밀번호: test123!')
  console.log('  - 테넌트: test.echomail.co.kr')
  console.log('  - 이메일 인증: 완료')
  console.log('\n📝 관리자 계정 정보:')
  console.log('  - 이메일: admin@echomail.com')
  console.log('  - 비밀번호: admin123!')
  console.log('  - 역할: 슈퍼 관리자')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ 시드 데이터 생성 실패:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
