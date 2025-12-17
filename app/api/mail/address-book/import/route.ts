import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { logger } from '@/lib/utils/logger'
import { parseAddressBookFile, ImportedContact } from '@/lib/utils/address-book-import'

export const dynamic = 'force-dynamic'

// 전화번호 정규화 함수: 다양한 형식을 010-0000-0000으로 변환
function normalizePhoneNumber(phone: string | undefined | null): string | null {
  if (!phone) return null

  // 숫자만 추출
  const digits = phone.replace(/\D/g, '')

  // 010으로 시작하는 11자리 번호인지 확인
  if (digits.length === 11 && digits.startsWith('010')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
  }

  // 10자리 (구형 번호: 010-000-0000)
  if (digits.length === 10 && digits.startsWith('010')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  // 유효하지 않은 번호
  return null
}

export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const mode = formData.get('mode') as string || 'merge' // 'merge' | 'replace'

      if (!file) {
        return createErrorResponse('파일을 선택해주세요.', 400)
      }

      // 파일 확장자 체크
      const filename = file.name.toLowerCase()
      if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls') && !filename.endsWith('.csv')) {
        return createErrorResponse('지원하지 않는 파일 형식입니다. (xlsx, xls, csv만 지원)', 400)
      }

      // 파일 크기 체크 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        return createErrorResponse('파일 크기는 5MB 이하만 가능합니다.', 400)
      }

      // 파일 파싱
      const buffer = await file.arrayBuffer()
      const result = await parseAddressBookFile(buffer, file.name)

      if (!result.success && result.contacts.length === 0) {
        return createErrorResponse(
          result.errors.length > 0 ? result.errors[0] : '파일을 파싱할 수 없습니다.',
          400
        )
      }

      // 기존 이메일 목록 조회 (중복 체크용)
      const existingContacts = await prisma.contact.findMany({
        where: { tenantId },
        select: { email: true },
      })
      const existingEmails = new Set(
        existingContacts.map((c) => c.email?.toLowerCase()).filter(Boolean)
      )

      // 새로운 연락처와 업데이트할 연락처 분류
      const newContacts: ImportedContact[] = []
      const updateContacts: ImportedContact[] = []
      const skippedDuplicates: string[] = []

      for (const contact of result.contacts) {
        const emailLower = contact.email.toLowerCase()
        if (existingEmails.has(emailLower)) {
          if (mode === 'merge') {
            updateContacts.push(contact)
          } else {
            skippedDuplicates.push(contact.email)
          }
        } else {
          newContacts.push(contact)
        }
      }

      let createdCount = 0
      let updatedCount = 0

      // 새 연락처 생성
      if (newContacts.length > 0) {
        // 회사 없이 개인 연락처로 저장하기 위해 기본 회사 찾거나 생성
        let defaultCompany = await prisma.company.findFirst({
          where: {
            tenantId,
            name: '개인 연락처',
          },
        })

        if (!defaultCompany) {
          defaultCompany = await prisma.company.create({
            data: {
              tenantId,
              name: '개인 연락처',
              email: 'imported@contacts.local',
              region: '기타',
              isManual: false, // 자동 생성된 업체 (업체 관리에 표시 안 함)
            },
          })
        }

        // 연락처 생성 (유효한 전화번호가 있는 것만)
        const validNewContacts = newContacts
          .map((c) => ({
            ...c,
            normalizedPhone: normalizePhoneNumber(c.phone),
          }))
          .filter((c) => c.normalizedPhone !== null) // 유효한 전화번호만

        if (validNewContacts.length > 0) {
          await prisma.contact.createMany({
            data: validNewContacts.map((c) => ({
              tenantId,
              companyId: defaultCompany!.id,
              name: c.name,
              email: c.email,
              phone: c.normalizedPhone!, // 정규화된 전화번호
              position: c.position || null,
            })),
          })
        }
        createdCount = validNewContacts.length

        // 전화번호가 유효하지 않아 건너뛴 연락처 수 기록
        const skippedInvalidPhone = newContacts.length - validNewContacts.length
        if (skippedInvalidPhone > 0) {
          result.errors.push(`전화번호 형식이 올바르지 않아 ${skippedInvalidPhone}개 건너뜀`)
        }
      }

      // 기존 연락처 업데이트 (merge 모드)
      if (mode === 'merge' && updateContacts.length > 0) {
        for (const contact of updateContacts) {
          const updateData: Record<string, string | undefined> = {
            name: contact.name,
          }
          // 전화번호 정규화 후 유효한 경우만 업데이트
          const normalizedPhone = normalizePhoneNumber(contact.phone)
          if (normalizedPhone) updateData.phone = normalizedPhone
          if (contact.position) updateData.position = contact.position

          await prisma.contact.updateMany({
            where: {
              tenantId,
              email: { equals: contact.email, mode: 'insensitive' },
            },
            data: updateData,
          })
        }
        updatedCount = updateContacts.length
      }

      logger.info('주소록 가져오기 완료', {
        tenantId,
        filename: file.name,
        totalRows: result.totalRows,
        created: createdCount,
        updated: updatedCount,
        duplicates: skippedDuplicates.length,
        errors: result.errors.length,
      })

      return createSuccessResponse({
        totalRows: result.totalRows,
        created: createdCount,
        updated: updatedCount,
        duplicates: [...result.duplicates, ...skippedDuplicates],
        errors: result.errors.slice(0, 10), // 최대 10개 에러만 반환
      }, `${createdCount}개 추가, ${updatedCount}개 업데이트 완료`)
    } catch (error) {
      logger.error('주소록 가져오기 실패:', error)
      // 보안: Prisma 에러 메시지에 민감한 데이터가 포함될 수 있으므로 일반 메시지 반환
      return createErrorResponse('주소록 가져오기에 실패했습니다. 파일 형식을 확인해주세요.')
    }
  })
}
