/**
 * 이메일 헤더 및 특수문자 디코딩 강화
 * - MIME 인코딩 디코딩
 * - 특수문자 처리
 * - 여러 인코딩 시도 (fallback)
 */

import { decode as decodeMimeHeader } from 'libmime'
import { logger } from '@/lib/utils/logger'

/**
 * 알려진 특수문자 매핑
 * - 이메일에서 자주 보이는 유니코드 특수문자
 */
const SPECIAL_CHAR_MAP: Record<string, string> = {
  '∧': '^', // 논리 AND 기호 → 캐럿
  '∨': 'v', // 논리 OR 기호
  '◆': '♦',
  '●': '•',
  '■': '▪',
  '▶': '▸',
  '▼': '▾',
  '★': '☆',
  // 추가 필요 시 확장
}

interface DecodeResult {
  decoded: string
  originalEncoding?: string
  decodingMethod: 'mime' | 'fallback' | 'none'
  hasSpecialChars: boolean
}

/**
 * 강화된 MIME 헤더 디코딩
 * - libmime 우선 시도
 * - 실패 시 여러 fallback 전략 사용
 * - 원본 보존
 */
export function decodeEmailHeader(header: string | undefined): DecodeResult {
  if (!header) {
    return {
      decoded: '',
      decodingMethod: 'none',
      hasSpecialChars: false,
    }
  }

  const result: DecodeResult = {
    decoded: header,
    decodingMethod: 'none',
    hasSpecialChars: false,
  }

  try {
    // 1. libmime 디코딩 시도
    const mimeDecoded = decodeMimeHeader(header)

    if (mimeDecoded && mimeDecoded !== header) {
      result.decoded = mimeDecoded
      result.decodingMethod = 'mime'

      logger.debug('[EmailDecoder] MIME 디코딩 성공', {
        original: header.substring(0, 50),
        decoded: mimeDecoded.substring(0, 50),
      })
    }
  } catch (error) {
    logger.warn('[EmailDecoder] MIME 디코딩 실패, fallback 시도', {
      header: header.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    // 2. Fallback: Buffer 디코딩 시도 (여러 인코딩)
    result.decoded = tryBufferDecode(header) || header
    result.decodingMethod = 'fallback'
  }

  // 3. 특수문자 정규화
  const normalized = normalizeSpecialChars(result.decoded)
  if (normalized !== result.decoded) {
    result.hasSpecialChars = true
    result.decoded = normalized

    logger.debug('[EmailDecoder] 특수문자 정규화', {
      before: result.decoded,
      after: normalized,
    })
  }

  // 4. 여전히 깨진 문자가 있으면 원본 + 경고
  if (hasGarbledChars(result.decoded)) {
    logger.warn('[EmailDecoder] 디코딩 후에도 깨진 문자 존재', {
      original: header,
      decoded: result.decoded,
    })

    // 원본을 그대로 사용 (사용자가 직접 볼 수 있도록)
    result.decoded = header
  }

  return result
}

/**
 * Buffer 기반 디코딩 시도 (여러 인코딩)
 */
function tryBufferDecode(text: string): string | null {
  const encodings: BufferEncoding[] = ['utf-8', 'utf16le', 'latin1', 'ascii']

  for (const encoding of encodings) {
    try {
      const buffer = Buffer.from(text, 'binary')
      const decoded = buffer.toString(encoding)

      // 유효한 문자열인지 간단 체크
      if (!hasGarbledChars(decoded)) {
        logger.debug(`[EmailDecoder] Buffer 디코딩 성공 (${encoding})`)
        return decoded
      }
    } catch (error) {
      // 다음 인코딩 시도
      continue
    }
  }

  return null
}

/**
 * 특수문자 정규화
 * - 알려진 특수문자를 ASCII 또는 일반 문자로 변환
 */
function normalizeSpecialChars(text: string): string {
  let normalized = text

  for (const [special, replacement] of Object.entries(SPECIAL_CHAR_MAP)) {
    if (normalized.includes(special)) {
      normalized = normalized.replaceAll(special, replacement)
    }
  }

  return normalized
}

/**
 * 깨진 문자(garbled characters) 감지
 * - �, ?, 연속 물음표 등
 */
function hasGarbledChars(text: string): boolean {
  // 1. 대체 문자 (�, replacement character U+FFFD)
  if (text.includes('\uFFFD')) return true

  // 2. 연속된 물음표 (3개 이상)
  if (/\?{3,}/.test(text)) return true

  // 3. 제어 문자가 과도하게 많음 (5% 이상)
  const controlChars = text.match(/[\x00-\x1F\x7F-\x9F]/g)
  if (controlChars && controlChars.length / text.length > 0.05) return true

  return false
}

/**
 * 이메일 주소에서 발신자 이름 추출 및 디코딩
 * - "만족도∧1위 <address@domain.com>" → "만족도^1위"
 */
export function decodeEmailAddress(fullAddress: string | undefined): {
  name: string | null
  address: string | null
} {
  if (!fullAddress) {
    return { name: null, address: null }
  }

  // 정규식으로 이름과 주소 분리
  const match = fullAddress.match(/^(.+?)\s*<(.+?)>$/)

  if (match) {
    const rawName = match[1].trim()
    const address = match[2].trim()

    // 이름 디코딩
    const decodedName = decodeEmailHeader(rawName)

    return {
      name: decodedName.decoded || null,
      address,
    }
  }

  // "<address>" 형식
  const simpleMatch = fullAddress.match(/^<(.+?)>$/)
  if (simpleMatch) {
    return {
      name: null,
      address: simpleMatch[1].trim(),
    }
  }

  // 주소만 있는 경우
  return {
    name: null,
    address: fullAddress.trim(),
  }
}

/**
 * 디코딩 실패 시 사용자 친화적 표시
 * - "????????12@nru.com" → "[디코딩 실패] ?12@nru.com"
 */
export function getSafeDisplayName(
  sender: string,
  senderName: string | null
): string {
  if (!senderName) return sender

  // 깨진 문자가 있으면 경고 표시
  if (hasGarbledChars(senderName)) {
    return `[디코딩 실패] ${sender}`
  }

  return senderName
}
