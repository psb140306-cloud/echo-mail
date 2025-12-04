import { logger } from '@/lib/utils/logger'

export interface EmailData {
  from: string
  fromName: string
  subject: string
  body: string
  receivedDate: Date
}

export interface ParsedEmailData {
  hasOrderKeywords: boolean  // 키워드 포함 여부 (발주 판단은 업체 매칭과 함께)
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

  // HTML 태그 제거 (border="0" 같은 속성에서 order 매칭 방지)
  const cleanBody = extractTextFromHtml(body)

  // 한글 키워드 (includes 사용)
  const koreanKeywords = ['발주', '주문', '구매', '납품']

  // 영어 키워드 (단어 경계 정규식 사용)
  const englishKeywords = ['order', 'purchase', 'po']

  const subjectLower = subject.toLowerCase()
  const bodyLower = cleanBody.toLowerCase()

  // 한글 키워드 매칭 (includes)
  const koreanMatches = koreanKeywords.filter(
    (keyword) =>
      subjectLower.includes(keyword) || bodyLower.includes(keyword)
  )

  // 영어 키워드 매칭 (단어 경계 정규식)
  const englishMatches = englishKeywords.filter((keyword) => {
    // \b는 단어 경계: border의 order는 매칭 안됨, "your order"의 order는 매칭됨
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    return regex.test(subject) || regex.test(cleanBody)
  })

  const keywordMatches = [...koreanMatches, ...englishMatches]
  const hasOrderKeywords = keywordMatches.length > 0
  const totalKeywords = koreanKeywords.length + englishKeywords.length
  const confidence = keywordMatches.length / totalKeywords

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
    hasOrderKeywords,
    companyName,
    confidence,
    matchedKeywords: keywordMatches,
  })

  return {
    hasOrderKeywords,
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
