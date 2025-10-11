/**
 * Echo Mail Email Format Validator
 * 이메일 형식 검증 및 오류 처리
 */

import { EchoMailError, createEchoMailError } from './errors'
import { globalErrorHandler } from './error-handler'
import { logger } from './logger'

export interface EmailValidationResult {
  isValid: boolean
  errors: EmailFormatError[]
  warnings: EmailFormatWarning[]
  extractedData?: ExtractedEmailData
  confidence: number
}

export interface EmailFormatError {
  type: EmailErrorType
  field: string
  message: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  recoverable: boolean
}

export interface EmailFormatWarning {
  type: EmailWarningType
  field: string
  message: string
  suggestion?: string
}

export interface ExtractedEmailData {
  sender: {
    email: string
    name?: string
    domain?: string
  }
  subject: {
    raw: string
    normalized?: string
    keywords?: string[]
  }
  content: {
    plainText?: string
    html?: string
    attachments: EmailAttachment[]
  }
  metadata: {
    receivedAt: Date
    size: number
    encoding?: string
    contentType?: string
  }
  businessData?: {
    orderInfo?: OrderInfo
    companyInfo?: CompanyInfo
    deliveryInfo?: DeliveryInfo
  }
}

export interface EmailAttachment {
  name: string
  size: number
  contentType: string
  isOrderDocument: boolean
  confidence: number
  extractedText?: string
}

export interface OrderInfo {
  orderNumber?: string
  orderDate?: Date
  items?: Array<{
    name: string
    quantity?: number
    unit?: string
  }>
  totalAmount?: number
  currency?: string
  confidence: number
}

export interface CompanyInfo {
  name?: string
  businessNumber?: string
  address?: string
  phone?: string
  representative?: string
  confidence: number
}

export interface DeliveryInfo {
  requestedDate?: Date
  address?: string
  recipient?: string
  phone?: string
  notes?: string
  confidence: number
}

export enum EmailErrorType {
  INVALID_SENDER = 'INVALID_SENDER',
  MISSING_SUBJECT = 'MISSING_SUBJECT',
  EMPTY_CONTENT = 'EMPTY_CONTENT',
  INVALID_ENCODING = 'INVALID_ENCODING',
  CORRUPTED_ATTACHMENT = 'CORRUPTED_ATTACHMENT',
  MISSING_ORDER_INFO = 'MISSING_ORDER_INFO',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
  SUSPICIOUS_CONTENT = 'SUSPICIOUS_CONTENT',
  OVERSIZED_EMAIL = 'OVERSIZED_EMAIL',
}

export enum EmailWarningType {
  UNCLEAR_SUBJECT = 'UNCLEAR_SUBJECT',
  MIXED_LANGUAGES = 'MIXED_LANGUAGES',
  UNUSUAL_FORMATTING = 'UNUSUAL_FORMATTING',
  POTENTIAL_SPAM = 'POTENTIAL_SPAM',
  MISSING_ATTACHMENT = 'MISSING_ATTACHMENT',
  INCOMPLETE_ORDER_INFO = 'INCOMPLETE_ORDER_INFO',
}

/**
 * 이메일 형식 검증기
 */
export class EmailFormatValidator {
  private static instance: EmailFormatValidator
  private readonly maxEmailSize = 25 * 1024 * 1024 // 25MB
  private readonly maxAttachmentSize = 10 * 1024 * 1024 // 10MB
  private readonly orderKeywords = [
    '발주',
    '주문',
    '오더',
    'order',
    '견적',
    '납품',
    '배송',
    '구매',
    '청구',
    'invoice',
    '계산서',
    '거래명세서',
  ]

  private constructor() {}

  static getInstance(): EmailFormatValidator {
    if (!EmailFormatValidator.instance) {
      EmailFormatValidator.instance = new EmailFormatValidator()
    }
    return EmailFormatValidator.instance
  }

  /**
   * 이메일 검증 메인 메서드
   */
  async validateEmail(emailData: {
    from: string
    subject?: string
    body?: string
    html?: string
    attachments?: Array<{
      name: string
      content: Buffer
      contentType?: string
    }>
    size?: number
    receivedAt?: Date
  }): Promise<EmailValidationResult> {
    const errors: EmailFormatError[] = []
    const warnings: EmailFormatWarning[] = []
    let confidence = 1.0

    try {
      logger.debug('Validating email format', {
        from: emailData.from,
        subject: emailData.subject,
        hasAttachments: (emailData.attachments?.length || 0) > 0,
      })

      // 1. 기본 형식 검증
      await this.validateBasicFormat(emailData, errors, warnings)

      // 2. 발신자 검증
      await this.validateSender(emailData.from, errors, warnings)

      // 3. 제목 검증
      if (emailData.subject) {
        await this.validateSubject(emailData.subject, errors, warnings)
      }

      // 4. 내용 검증
      await this.validateContent(emailData.body || '', emailData.html, errors, warnings)

      // 5. 첨부파일 검증
      if (emailData.attachments) {
        await this.validateAttachments(emailData.attachments, errors, warnings)
      }

      // 6. 크기 검증
      await this.validateSize(emailData.size || 0, errors, warnings)

      // 7. 비즈니스 데이터 추출 시도
      const extractedData = await this.extractBusinessData(emailData)

      // 8. 신뢰도 계산
      confidence = this.calculateConfidence(errors, warnings, extractedData)

      // 9. 검증 결과 생성
      const isValid = errors.filter((e) => e.severity === 'CRITICAL').length === 0

      const result: EmailValidationResult = {
        isValid,
        errors,
        warnings,
        extractedData,
        confidence,
      }

      // 10. 오류 로깅 및 처리
      if (!isValid) {
        await this.handleValidationErrors(errors, emailData)
      }

      return result
    } catch (error) {
      logger.error('Email validation failed', { error, emailData: { from: emailData.from } })

      errors.push({
        type: EmailErrorType.SUSPICIOUS_CONTENT,
        field: 'email',
        message: '이메일 검증 중 오류가 발생했습니다.',
        severity: 'CRITICAL',
        recoverable: false,
      })

      return {
        isValid: false,
        errors,
        warnings,
        confidence: 0,
      }
    }
  }

  /**
   * 기본 형식 검증
   */
  private async validateBasicFormat(
    emailData: any,
    errors: EmailFormatError[],
    warnings: EmailFormatWarning[]
  ): Promise<void> {
    // 필수 필드 검증
    if (!emailData.from) {
      errors.push({
        type: EmailErrorType.INVALID_SENDER,
        field: 'from',
        message: '발신자 정보가 없습니다.',
        severity: 'CRITICAL',
        recoverable: false,
      })
    }

    if (!emailData.subject || emailData.subject.trim().length === 0) {
      warnings.push({
        type: EmailWarningType.UNCLEAR_SUBJECT,
        field: 'subject',
        message: '제목이 없거나 비어있습니다.',
        suggestion: '명확한 제목을 포함해주세요.',
      })
    }

    if (
      (!emailData.body || emailData.body.trim().length === 0) &&
      (!emailData.html || emailData.html.trim().length === 0) &&
      (!emailData.attachments || emailData.attachments.length === 0)
    ) {
      errors.push({
        type: EmailErrorType.EMPTY_CONTENT,
        field: 'content',
        message: '이메일 내용이 완전히 비어있습니다.',
        severity: 'HIGH',
        recoverable: false,
      })
    }
  }

  /**
   * 발신자 검증
   */
  private async validateSender(
    from: string,
    errors: EmailFormatError[],
    warnings: EmailFormatWarning[]
  ): Promise<void> {
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const emailMatch = from.match(/<([^>]+)>/) || [null, from]
    const email = emailMatch[1]

    if (!emailRegex.test(email)) {
      errors.push({
        type: EmailErrorType.INVALID_SENDER,
        field: 'from',
        message: '유효하지 않은 이메일 주소입니다.',
        severity: 'CRITICAL',
        recoverable: false,
      })
      return
    }

    // 도메인 검증
    const domain = email.split('@')[1]
    if (this.isSuspiciousDomain(domain)) {
      warnings.push({
        type: EmailWarningType.POTENTIAL_SPAM,
        field: 'from',
        message: '의심스러운 도메인에서 발송된 이메일입니다.',
        suggestion: '발신자를 확인해주세요.',
      })
    }

    // 임시 이메일 서비스 검증
    if (this.isTemporaryEmailDomain(domain)) {
      errors.push({
        type: EmailErrorType.INVALID_SENDER,
        field: 'from',
        message: '임시 이메일 주소는 허용되지 않습니다.',
        severity: 'HIGH',
        recoverable: false,
      })
    }
  }

  /**
   * 제목 검증
   */
  private async validateSubject(
    subject: string,
    errors: EmailFormatError[],
    warnings: EmailFormatWarning[]
  ): Promise<void> {
    // 제목 길이 검증
    if (subject.length > 200) {
      warnings.push({
        type: EmailWarningType.UNUSUAL_FORMATTING,
        field: 'subject',
        message: '제목이 너무 깁니다.',
        suggestion: '제목을 200자 이내로 작성해주세요.',
      })
    }

    // 스팸 패턴 검증
    if (this.isSpamSubject(subject)) {
      warnings.push({
        type: EmailWarningType.POTENTIAL_SPAM,
        field: 'subject',
        message: '스팸으로 의심되는 제목입니다.',
      })
    }

    // 발주 관련 키워드 확인
    const hasOrderKeywords = this.orderKeywords.some((keyword) =>
      subject.toLowerCase().includes(keyword.toLowerCase())
    )

    if (!hasOrderKeywords) {
      warnings.push({
        type: EmailWarningType.UNCLEAR_SUBJECT,
        field: 'subject',
        message: '발주 관련 키워드가 포함되지 않았습니다.',
        suggestion: '발주, 주문, 견적 등의 키워드를 포함해주세요.',
      })
    }
  }

  /**
   * 내용 검증
   */
  private async validateContent(
    plainText: string,
    html?: string,
    errors: EmailFormatError[] = [],
    warnings: EmailFormatWarning[] = []
  ): Promise<void> {
    const content = plainText || this.extractTextFromHtml(html || '')

    // 내용 길이 검증
    if (content.length > 50000) {
      warnings.push({
        type: EmailWarningType.UNUSUAL_FORMATTING,
        field: 'content',
        message: '이메일 내용이 너무 깁니다.',
      })
    }

    // 인코딩 문제 검증
    if (this.hasEncodingIssues(content)) {
      errors.push({
        type: EmailErrorType.INVALID_ENCODING,
        field: 'content',
        message: '인코딩 문제가 발생했습니다.',
        severity: 'MEDIUM',
        recoverable: true,
      })
    }

    // 의심스러운 내용 검증
    if (this.hasSuspiciousContent(content)) {
      warnings.push({
        type: EmailWarningType.POTENTIAL_SPAM,
        field: 'content',
        message: '의심스러운 내용이 포함되어 있습니다.',
      })
    }
  }

  /**
   * 첨부파일 검증
   */
  private async validateAttachments(
    attachments: Array<{
      name: string
      content: Buffer
      contentType?: string
    }>,
    errors: EmailFormatError[],
    warnings: EmailFormatWarning[]
  ): Promise<void> {
    for (const attachment of attachments) {
      // 파일 크기 검증
      if (attachment.content.length > this.maxAttachmentSize) {
        errors.push({
          type: EmailErrorType.OVERSIZED_EMAIL,
          field: 'attachment',
          message: `첨부파일 '${attachment.name}'이 너무 큽니다.`,
          severity: 'HIGH',
          recoverable: false,
        })
        continue
      }

      // 파일 형식 검증
      const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.docx', '.doc', '.hwp', '.txt']
      const hasAllowedExtension = allowedExtensions.some((ext) =>
        attachment.name.toLowerCase().endsWith(ext)
      )

      if (!hasAllowedExtension) {
        warnings.push({
          type: EmailWarningType.UNUSUAL_FORMATTING,
          field: 'attachment',
          message: `'${attachment.name}'은 일반적이지 않은 파일 형식입니다.`,
          suggestion: 'PDF, Excel, Word, HWP 파일을 권장합니다.',
        })
      }

      // 첨부파일 손상 검증
      if (await this.isCorruptedFile(attachment)) {
        errors.push({
          type: EmailErrorType.CORRUPTED_ATTACHMENT,
          field: 'attachment',
          message: `첨부파일 '${attachment.name}'이 손상되었습니다.`,
          severity: 'MEDIUM',
          recoverable: true,
        })
      }
    }
  }

  /**
   * 크기 검증
   */
  private async validateSize(
    size: number,
    errors: EmailFormatError[],
    warnings: EmailFormatWarning[]
  ): Promise<void> {
    if (size > this.maxEmailSize) {
      errors.push({
        type: EmailErrorType.OVERSIZED_EMAIL,
        field: 'size',
        message: '이메일 크기가 허용 한도를 초과했습니다.',
        severity: 'HIGH',
        recoverable: false,
      })
    }
  }

  /**
   * 비즈니스 데이터 추출
   */
  private async extractBusinessData(emailData: any): Promise<ExtractedEmailData> {
    const extractedData: ExtractedEmailData = {
      sender: this.extractSenderInfo(emailData.from),
      subject: this.extractSubjectInfo(emailData.subject || ''),
      content: {
        plainText: emailData.body,
        html: emailData.html,
        attachments: await this.processAttachments(emailData.attachments || []),
      },
      metadata: {
        receivedAt: emailData.receivedAt || new Date(),
        size: emailData.size || 0,
        contentType: emailData.contentType,
      },
    }

    // 비즈니스 데이터 추출 시도
    extractedData.businessData = {
      orderInfo: await this.extractOrderInfo(emailData),
      companyInfo: await this.extractCompanyInfo(emailData),
      deliveryInfo: await this.extractDeliveryInfo(emailData),
    }

    return extractedData
  }

  /**
   * 발신자 정보 추출
   */
  private extractSenderInfo(from: string): ExtractedEmailData['sender'] {
    const emailMatch = from.match(/<([^>]+)>/) || [null, from]
    const nameMatch = from.match(/^(.+?)\s*</)
    const email = emailMatch[1]
    const domain = email.split('@')[1]

    return {
      email,
      name: nameMatch?.[1]?.trim().replace(/['"]/g, ''),
      domain,
    }
  }

  /**
   * 제목 정보 추출
   */
  private extractSubjectInfo(subject: string): ExtractedEmailData['subject'] {
    return {
      raw: subject,
      normalized: subject.replace(/\s+/g, ' ').trim(),
      keywords: this.extractKeywords(subject),
    }
  }

  /**
   * 첨부파일 처리
   */
  private async processAttachments(
    attachments: Array<{ name: string; content: Buffer; contentType?: string }>
  ): Promise<EmailAttachment[]> {
    const processed: EmailAttachment[] = []

    for (const attachment of attachments) {
      const isOrderDoc = this.isOrderDocument(attachment.name)

      processed.push({
        name: attachment.name,
        size: attachment.content.length,
        contentType: attachment.contentType || 'application/octet-stream',
        isOrderDocument: isOrderDoc,
        confidence: isOrderDoc ? 0.8 : 0.3,
        extractedText: await this.extractTextFromFile(attachment),
      })
    }

    return processed
  }

  /**
   * 주문 정보 추출
   */
  private async extractOrderInfo(emailData: any): Promise<OrderInfo> {
    // TODO: 실제 주문 정보 추출 로직 구현
    return {
      confidence: 0.5,
    }
  }

  /**
   * 회사 정보 추출
   */
  private async extractCompanyInfo(emailData: any): Promise<CompanyInfo> {
    // TODO: 실제 회사 정보 추출 로직 구현
    return {
      confidence: 0.5,
    }
  }

  /**
   * 배송 정보 추출
   */
  private async extractDeliveryInfo(emailData: any): Promise<DeliveryInfo> {
    // TODO: 실제 배송 정보 추출 로직 구현
    return {
      confidence: 0.5,
    }
  }

  /**
   * 유틸리티 메서드들
   */

  private isSuspiciousDomain(domain: string): boolean {
    const suspiciousDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com']
    return suspiciousDomains.some((sus) => domain.includes(sus))
  }

  private isTemporaryEmailDomain(domain: string): boolean {
    const tempDomains = ['tempmail', '10minute', 'guerrilla', 'throwaway']
    return tempDomains.some((temp) => domain.toLowerCase().includes(temp))
  }

  private isSpamSubject(subject: string): boolean {
    const spamPatterns = [/무료/i, /당첨/i, /클릭/i, /urgent/i, /!!!+/]
    return spamPatterns.some((pattern) => pattern.test(subject))
  }

  private extractTextFromHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ')
  }

  private hasEncodingIssues(content: string): boolean {
    return /[��?]{2,}/.test(content) || content.includes('?????')
  }

  private hasSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /(?:click|클릭).{0,20}(?:here|여기)/i,
      /(?:free|무료).{0,20}(?:money|돈)/i,
      /비트코인|투자|수익/i,
    ]
    return suspiciousPatterns.some((pattern) => pattern.test(content))
  }

  private async isCorruptedFile(attachment: { content: Buffer; name: string }): Promise<boolean> {
    // 기본적인 파일 헤더 검증
    const content = attachment.content
    const name = attachment.name.toLowerCase()

    if (name.endsWith('.pdf')) {
      return !content.subarray(0, 4).equals(Buffer.from('%PDF'))
    }
    if (name.endsWith('.xlsx')) {
      return !content.subarray(0, 2).equals(Buffer.from('PK'))
    }

    return false
  }

  private isOrderDocument(fileName: string): boolean {
    const orderPatterns = [/발주/i, /주문/i, /order/i, /견적/i, /invoice/i, /구매/i, /청구/i]
    return orderPatterns.some((pattern) => pattern.test(fileName))
  }

  private extractKeywords(text: string): string[] {
    const keywords: string[] = []
    const keywordPatterns = [
      ...this.orderKeywords,
      '긴급',
      '급함',
      'urgent',
      '오늘',
      '내일',
      '당일',
    ]

    for (const keyword of keywordPatterns) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        keywords.push(keyword)
      }
    }

    return keywords
  }

  private async extractTextFromFile(attachment: {
    content: Buffer
    name: string
    contentType?: string
  }): Promise<string | undefined> {
    // TODO: 실제 파일 텍스트 추출 구현 (PDF, Excel 등)
    return undefined
  }

  private calculateConfidence(
    errors: EmailFormatError[],
    warnings: EmailFormatWarning[],
    extractedData?: ExtractedEmailData
  ): number {
    let confidence = 1.0

    // 오류에 따른 신뢰도 감소
    errors.forEach((error) => {
      switch (error.severity) {
        case 'CRITICAL':
          confidence *= 0.1
          break
        case 'HIGH':
          confidence *= 0.5
          break
        case 'MEDIUM':
          confidence *= 0.7
          break
        case 'LOW':
          confidence *= 0.9
          break
      }
    })

    // 경고에 따른 신뢰도 감소
    confidence *= Math.max(0.3, 1 - warnings.length * 0.1)

    // 추출된 데이터 품질에 따른 신뢰도 조정
    if (extractedData?.businessData) {
      const avgBusinessConfidence =
        ((extractedData.businessData.orderInfo?.confidence || 0) +
          (extractedData.businessData.companyInfo?.confidence || 0) +
          (extractedData.businessData.deliveryInfo?.confidence || 0)) /
        3

      confidence = (confidence + avgBusinessConfidence) / 2
    }

    return Math.max(0, Math.min(1, confidence))
  }

  private async handleValidationErrors(errors: EmailFormatError[], emailData: any): Promise<void> {
    const criticalErrors = errors.filter((e) => e.severity === 'CRITICAL')
    const highErrors = errors.filter((e) => e.severity === 'HIGH')

    if (criticalErrors.length > 0) {
      await globalErrorHandler.handleError(
        createEchoMailError.emailParseFailed({
          from: emailData.from,
          subject: emailData.subject,
          errors: criticalErrors.map((e) => e.message),
        }),
        { companyId: emailData.from }
      )
    }

    if (highErrors.length > 0) {
      logger.warn('High severity email format errors detected', {
        from: emailData.from,
        errors: highErrors,
      })
    }
  }
}

// 싱글톤 인스턴스 내보내기
export const emailFormatValidator = EmailFormatValidator.getInstance()
