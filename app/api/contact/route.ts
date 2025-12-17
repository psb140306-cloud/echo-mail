import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

// 문의 유형 매핑
const inquiryTypeMap: Record<string, 'INQUIRY' | 'DEMO' | 'PARTNERSHIP' | 'SUPPORT' | 'BILLING' | 'OTHER'> = {
  'inquiry': 'INQUIRY',
  'demo': 'DEMO',
  'partnership': 'PARTNERSHIP',
  'support': 'SUPPORT',
  'billing': 'BILLING',
  'other': 'OTHER',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, company, type, subject, message } = body

    // 필수 필드 검증
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: '필수 항목을 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 주소를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 메타데이터 수집
    const headersList = await headers()
    const ipAddress = headersList.get('x-forwarded-for') ||
                     headersList.get('x-real-ip') ||
                     'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    // 문의 유형 변환
    const inquiryType = inquiryTypeMap[type] || 'INQUIRY'

    // DB에 문의 저장
    const inquiry = await prisma.contactInquiry.create({
      data: {
        name,
        email,
        phone: phone || null,
        company: company || null,
        type: inquiryType,
        subject,
        message,
        ipAddress,
        userAgent,
      },
    })

    console.log('[Contact API] 문의 접수:', {
      id: inquiry.id,
      name,
      email,
      type: inquiryType,
      subject,
    })

    // 관리자에게 이메일 알림 발송 (환경변수 설정된 경우)
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SUPER_ADMIN_EMAILS?.split(',')[0]

    if (adminEmail) {
      // 이메일 발송 로직 (Resend, SendGrid 등 사용 가능)
      // 현재는 로그만 출력
      console.log('[Contact API] 관리자 알림 대상:', adminEmail)
      console.log('[Contact API] 문의 내용:', {
        name,
        email,
        phone,
        company,
        type: inquiryType,
        subject,
        message: message.substring(0, 100) + '...',
      })
    }

    return NextResponse.json({
      success: true,
      message: '문의가 성공적으로 접수되었습니다.',
      inquiryId: inquiry.id,
    })

  } catch (error) {
    console.error('[Contact API] Error:', error)
    return NextResponse.json(
      {
        error: '문의 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}

// GET: 문의 목록 조회 (슈퍼어드민 전용)
export async function GET(request: NextRequest) {
  try {
    // 슈퍼어드민 권한 확인
    const { requireSuperAdmin } = await import('@/lib/auth/super-admin')
    const authError = await requireSuperAdmin()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // 필터 조건 구성
    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type

    // 문의 목록 조회
    const [inquiries, total] = await Promise.all([
      prisma.contactInquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactInquiry.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: inquiries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    console.error('[Contact API] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
