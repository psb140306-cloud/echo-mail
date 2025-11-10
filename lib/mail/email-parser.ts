import { logger } from '@/lib/utils/logger'

export interface EmailData {
  from: string
  fromName: string
  subject: string
  body: string
  receivedDate: Date
}

export interface ParsedEmailData {
  isOrderEmail: boolean
  companyName?: string
  senderEmail?: string
  senderDomain?: string
  orderDate?: Date
  confidence: number
}

/**
 * 이메일 파싱하여 발주 메일 여부 판단 및 업체 정보 추출
 */
export async function parseOrderEmail(email: EmailData): Promise<ParsedEmailData> {
  const { from, fromName, subject, body } = email

  // 발주 관련 키워드
  const orderKeywords = [
    '발주',
    '주문',
    '구매',
    '납품',
    '요청',
    'order',
    'purchase',
    'po',
    'purchase order',
  ]

  // 제목과 본문에서 발주 키워드 찾기
  const subjectLower = subject.toLowerCase()
  const bodyLower = body.toLowerCase()

  const keywordMatches = orderKeywords.filter(
    (keyword) =>
      subjectLower.includes(keyword.toLowerCase()) ||
      bodyLower.includes(keyword.toLowerCase())
  )

  const isOrderEmail = keywordMatches.length > 0
  const confidence = keywordMatches.length / orderKeywords.length

  if (!isOrderEmail) {
    return {
      isOrderEmail: false,
      confidence: 0,
    }
  }

  // 발신자 이메일에서 도메인 추출
  const senderEmail = from
  const senderDomain = from.split('@')[1]

  // 업체명 추출 시도
  let companyName: string | undefined

  // 1. 발신자 이름에서 추출
  if (fromName && fromName.trim().length > 0) {
    companyName = fromName.trim()
  }

  // 2. 이메일 도메인에서 추출 (예: company.com -> company)
  if (!companyName && senderDomain) {
    const domainParts = senderDomain.split('.')
    if (domainParts.length > 0) {
      companyName = domainParts[0]
    }
  }

  logger.info('[EmailParser] 이메일 파싱 완료', {
    from,
    subject,
    isOrderEmail,
    companyName,
    confidence,
    matchedKeywords: keywordMatches,
  })

  return {
    isOrderEmail,
    companyName,
    senderEmail,
    senderDomain,
    orderDate: email.receivedDate,
    confidence,
  }
}

/**
 * HTML 이메일 본문에서 텍스트 추출
 */
export function extractTextFromHtml(html: string): string {
  // 간단한 HTML 태그 제거
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
