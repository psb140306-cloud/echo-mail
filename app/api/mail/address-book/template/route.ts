import { NextResponse } from 'next/server'
import { createAddressBookTemplate } from '@/lib/utils/address-book-import'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 템플릿 엑셀 파일 생성
    const buffer = createAddressBookTemplate()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('주소록_템플릿.xlsx')}`,
      },
    })
  } catch (error) {
    console.error('템플릿 생성 실패:', error)
    return NextResponse.json({ error: '템플릿 생성에 실패했습니다.' }, { status: 500 })
  }
}
