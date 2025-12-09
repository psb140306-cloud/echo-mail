import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { logger } from '@/lib/utils/logger'
import { parseAddressBookFile, ImportedContact } from '@/lib/utils/address-book-import'

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

        // 연락처 생성
        await prisma.contact.createMany({
          data: newContacts.map((c) => ({
            tenantId,
            companyId: defaultCompany!.id,
            name: c.name,
            email: c.email,
            phone: c.phone || '',  // phone은 필수 필드
            position: c.position || null,
          })),
        })
        createdCount = newContacts.length
      }

      // 기존 연락처 업데이트 (merge 모드)
      if (mode === 'merge' && updateContacts.length > 0) {
        for (const contact of updateContacts) {
          const updateData: Record<string, string | undefined> = {
            name: contact.name,
          }
          if (contact.phone) updateData.phone = contact.phone
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
