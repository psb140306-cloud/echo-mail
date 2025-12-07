import { NextRequest, NextResponse } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { createErrorResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { logger } from '@/lib/utils/logger'
import { exportAddressBook, ImportedContact } from '@/lib/utils/address-book-import'

export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 모든 연락처 조회
      const contacts = await prisma.contact.findMany({
        where: { tenantId },
        include: {
          company: {
            select: { name: true },
          },
        },
        orderBy: { name: 'asc' },
      })

      if (contacts.length === 0) {
        return createErrorResponse('내보낼 연락처가 없습니다.', 404)
      }

      // ImportedContact 형식으로 변환
      const exportData: ImportedContact[] = contacts.map((c) => ({
        name: c.name,
        email: c.email || '',
        company: c.company?.name || '',
        department: c.department || '',
        position: c.position || '',
        phone: c.phone || '',
        memo: c.memo || '',
      }))

      // 엑셀 파일 생성
      const buffer = exportAddressBook(exportData)

      logger.info('주소록 내보내기 완료', {
        tenantId,
        contactCount: contacts.length,
      })

      // 파일 다운로드 응답
      const now = new Date()
      const filename = `주소록_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.xlsx`

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      })
    } catch (error) {
      logger.error('주소록 내보내기 실패:', error)
      return createErrorResponse('주소록 내보내기에 실패했습니다.')
    }
  })
}
