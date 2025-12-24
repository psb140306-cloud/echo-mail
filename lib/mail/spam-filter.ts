/**
 * 스팸 메일 필터링 시스템
 * - 발신자 도메인, 제목, 내용 기반 스팸 감지
 */

interface SpamCheckResult {
  isSpam: boolean
  score: number // 0-100, 높을수록 스팸 가능성 높음
  reasons: string[]
}

interface EmailData {
  sender: string
  senderName?: string
  subject: string
  body?: string
}

/**
 * 스팸 도메인 블랙리스트
 * - 알려진 스팸 발송 도메인
 */
const SPAM_DOMAINS = [
  'nru.com',
  'clickbank.net',
  'sendgrid.com', // 스팸 발송에 악용되는 경우
  // 추가 도메인은 DB나 환경변수로 관리
]

/**
 * 스팸 키워드 (한글/영문)
 * - 제목이나 본문에 이런 키워드가 있으면 스팸 가능성 높음
 */
const SPAM_KEYWORDS = {
  // 성인/불법
  adult: ['발기부전', '비아그라', '시알리스', '성인', 'viagra', 'cialis', '정력', '조루'],

  // 광고/마케팅
  marketing: ['100% 정품', '할인마트', '무료배송', '최저가', '특가', '이벤트', '당첨',
              'free shipping', 'lowest price', 'special offer'],

  // 금융/도박
  financial: ['대출', '신용카드', '무이자', '현금', '카지노', 'loan', 'casino', '베팅'],

  // 의심스러운 패턴
  suspicious: ['클릭', '확인', '긴급', '지금', '오늘만', 'click here', 'urgent', 'act now'],
}

/**
 * 의심스러운 발신자 이름 패턴
 */
const SUSPICIOUS_SENDER_PATTERNS = [
  /^[\?\?]+/, // "????????" 같은 디코딩 실패
  /[∧◆●■▶▼★☆♥♡]/g, // 과도한 특수문자
  /\d{4,}/, // 숫자 4개 이상 연속 (예: "1234업체")
  /^[a-z0-9\-_.]+$/i, // 영문+숫자만 (이름처럼 보이지 않음)
]

/**
 * 스팸 점수 계산
 */
export function checkSpam(email: EmailData): SpamCheckResult {
  let score = 0
  const reasons: string[] = []

  // 1. 발신자 도메인 체크 (가중치: 40점)
  const senderDomain = email.sender.split('@')[1]?.toLowerCase()
  if (senderDomain && SPAM_DOMAINS.includes(senderDomain)) {
    score += 40
    reasons.push(`블랙리스트 도메인: ${senderDomain}`)
  }

  // 2. 발신자 이름 체크 (가중치: 20점)
  if (email.senderName) {
    for (const pattern of SUSPICIOUS_SENDER_PATTERNS) {
      if (pattern.test(email.senderName)) {
        score += 20
        reasons.push(`의심스러운 발신자 이름: ${email.senderName}`)
        break
      }
    }
  }

  // 3. 제목 키워드 체크 (가중치: 각 10점, 최대 40점)
  const subjectLower = email.subject.toLowerCase()
  let keywordMatches = 0

  for (const [category, keywords] of Object.entries(SPAM_KEYWORDS)) {
    for (const keyword of keywords) {
      if (subjectLower.includes(keyword.toLowerCase())) {
        keywordMatches++
        reasons.push(`스팸 키워드 (${category}): "${keyword}"`)

        // 카테고리별 가중치
        if (category === 'adult') score += 15
        else if (category === 'financial') score += 10
        else score += 5

        if (keywordMatches >= 4) break // 최대 4개까지만
      }
    }
    if (keywordMatches >= 4) break
  }

  // 4. 제목 길이 및 패턴 (가중치: 10점)
  if (email.subject.length > 100) {
    score += 5
    reasons.push('과도하게 긴 제목')
  }

  // 과도한 이모지/특수문자
  const emojiCount = (email.subject.match(/[🔶💚💡◆●■]/g) || []).length
  if (emojiCount > 3) {
    score += 10
    reasons.push(`과도한 이모지: ${emojiCount}개`)
  }

  // 5. 본문 체크 (가중치: 10점)
  if (email.body) {
    const bodyLower = email.body.toLowerCase()
    let bodyKeywordCount = 0

    for (const keywords of Object.values(SPAM_KEYWORDS)) {
      for (const keyword of keywords) {
        if (bodyLower.includes(keyword.toLowerCase())) {
          bodyKeywordCount++
        }
      }
    }

    if (bodyKeywordCount > 5) {
      score += 10
      reasons.push(`본문에 스팸 키워드 ${bodyKeywordCount}개`)
    }
  }

  // 최종 판정 (임계값: 60점)
  const isSpam = score >= 60

  return {
    isSpam,
    score: Math.min(score, 100), // 최대 100점
    reasons,
  }
}

/**
 * 도메인을 블랙리스트에 추가 (동적 관리)
 */
export function addSpamDomain(domain: string): void {
  if (!SPAM_DOMAINS.includes(domain.toLowerCase())) {
    SPAM_DOMAINS.push(domain.toLowerCase())
  }
}

/**
 * 블랙리스트에서 도메인 제거
 */
export function removeSpamDomain(domain: string): void {
  const index = SPAM_DOMAINS.indexOf(domain.toLowerCase())
  if (index > -1) {
    SPAM_DOMAINS.splice(index, 1)
  }
}
