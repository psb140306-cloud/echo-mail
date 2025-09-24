/**
 * Echo Mail Unregistered Company Handler
 * 미등록 업체 처리 로직
 */

import { EchoMailError, createEchoMailError } from './errors'
import { globalErrorHandler } from './error-handler'
import { logger } from './logger'

export interface UnregisteredCompanyInfo {
  email: string
  companyName?: string
  extractedFromEmail?: {
    subject?: string
    body?: string
    attachments?: string[]
  }
  firstSeenAt: Date
  lastSeenAt: Date
  emailCount: number
  suggestedActions: UnregisteredCompanyAction[]
}

export interface UnregisteredCompanyAction {
  type: 'AUTO_REGISTER' | 'MANUAL_REVIEW' | 'BLOCK' | 'NOTIFY_ADMIN'
  description: string
  confidence: number
  metadata?: Record<string, any>
}

export interface CompanyExtractionResult {
  companyName?: string
  region?: string
  contactInfo?: {
    name?: string
    phone?: string
    email?: string
  }
  confidence: number
  source: 'SUBJECT' | 'BODY' | 'ATTACHMENT' | 'DOMAIN'
}

/**
 * 미등록 업체 처리 핸들러
 */
export class UnregisteredCompanyHandler {
  private static instance: UnregisteredCompanyHandler
  private unregisteredCompanies: Map<string, UnregisteredCompanyInfo> = new Map()
  private readonly autoRegisterThreshold = 0.8
  private readonly reviewThreshold = 0.5

  private constructor() {}

  static getInstance(): UnregisteredCompanyHandler {
    if (!UnregisteredCompanyHandler.instance) {
      UnregisteredCompanyHandler.instance = new UnregisteredCompanyHandler()
    }
    return UnregisteredCompanyHandler.instance
  }

  /**
   * 미등록 업체 이메일 처리
   */
  async handleUnregisteredEmail(
    senderEmail: string,
    emailContent: {
      subject: string
      body: string
      attachments?: Array<{
        name: string
        content?: Buffer
        contentType?: string
      }>
    }
  ): Promise<{
    action: 'PROCESSED' | 'QUEUED_FOR_REVIEW' | 'AUTO_REGISTERED' | 'BLOCKED'
    companyInfo?: UnregisteredCompanyInfo
    registrationResult?: any
  }> {
    try {
      logger.info('Processing unregistered company email', {
        senderEmail,
        subject: emailContent.subject
      })

      // 1. 기존 미등록 업체 정보 조회 또는 생성
      let companyInfo = this.unregisteredCompanies.get(senderEmail)

      if (!companyInfo) {
        companyInfo = await this.createUnregisteredCompanyInfo(senderEmail, emailContent)
        this.unregisteredCompanies.set(senderEmail, companyInfo)
      } else {
        // 기존 정보 업데이트
        companyInfo = await this.updateUnregisteredCompanyInfo(companyInfo, emailContent)
      }

      // 2. 업체 정보 추출 시도
      const extractionResult = await this.extractCompanyInfo(emailContent)

      // 3. 업체명이 추출된 경우 정보 업데이트
      if (extractionResult.companyName && extractionResult.confidence > 0.7) {
        companyInfo.companyName = extractionResult.companyName
      }

      // 4. 처리 액션 결정
      const actions = await this.determineActions(companyInfo, extractionResult)
      companyInfo.suggestedActions = actions

      // 5. 액션 실행
      const result = await this.executeActions(companyInfo, actions)

      // 6. 관리자 알림 (필요한 경우)
      await this.notifyAdminIfNeeded(companyInfo, result)

      return result

    } catch (error) {
      await globalErrorHandler.handleError(
        createEchoMailError.companyNotRegistered({
          senderEmail,
          subject: emailContent.subject
        }),
        { companyId: senderEmail }
      )

      return {
        action: 'BLOCKED',
        companyInfo: undefined
      }
    }
  }

  /**
   * 새로운 미등록 업체 정보 생성
   */
  private async createUnregisteredCompanyInfo(
    email: string,
    emailContent: {
      subject: string
      body: string
      attachments?: Array<{ name: string; content?: Buffer; contentType?: string }>
    }
  ): Promise<UnregisteredCompanyInfo> {
    const now = new Date()

    return {
      email,
      companyName: undefined,
      extractedFromEmail: {
        subject: emailContent.subject,
        body: emailContent.body?.substring(0, 1000), // 처음 1000자만 저장
        attachments: emailContent.attachments?.map(att => att.name) || []
      },
      firstSeenAt: now,
      lastSeenAt: now,
      emailCount: 1,
      suggestedActions: []
    }
  }

  /**
   * 기존 미등록 업체 정보 업데이트
   */
  private async updateUnregisteredCompanyInfo(
    companyInfo: UnregisteredCompanyInfo,
    emailContent: {
      subject: string
      body: string
      attachments?: Array<{ name: string; content?: Buffer; contentType?: string }>
    }
  ): Promise<UnregisteredCompanyInfo> {
    companyInfo.lastSeenAt = new Date()
    companyInfo.emailCount += 1

    // 최근 이메일 정보로 업데이트
    companyInfo.extractedFromEmail = {
      subject: emailContent.subject,
      body: emailContent.body?.substring(0, 1000),
      attachments: emailContent.attachments?.map(att => att.name) || []
    }

    return companyInfo
  }

  /**
   * 이메일에서 업체 정보 추출
   */
  private async extractCompanyInfo(emailContent: {
    subject: string
    body: string
    attachments?: Array<{ name: string; content?: Buffer; contentType?: string }>
  }): Promise<CompanyExtractionResult> {
    const results: CompanyExtractionResult[] = []

    // 1. 제목에서 업체명 추출
    const subjectResult = await this.extractFromSubject(emailContent.subject)
    if (subjectResult.companyName) {
      results.push(subjectResult)
    }

    // 2. 본문에서 업체명 추출
    const bodyResult = await this.extractFromBody(emailContent.body)
    if (bodyResult.companyName) {
      results.push(bodyResult)
    }

    // 3. 첨부파일에서 업체명 추출
    if (emailContent.attachments) {
      for (const attachment of emailContent.attachments) {
        const attachmentResult = await this.extractFromAttachment(attachment)
        if (attachmentResult.companyName) {
          results.push(attachmentResult)
        }
      }
    }

    // 가장 신뢰도가 높은 결과 반환
    return results.reduce(
      (best, current) => current.confidence > best.confidence ? current : best,
      { confidence: 0, source: 'SUBJECT' as const }
    )
  }

  /**
   * 이메일 제목에서 업체명 추출
   */
  private async extractFromSubject(subject: string): Promise<CompanyExtractionResult> {
    const patterns = [
      // [업체명] 패턴
      /\[([^\]]+)\]/g,
      // (주) 패턴
      /\(주\)\s*([가-힣A-Za-z0-9\s]+)/g,
      // 주식회사 패턴
      /주식회사\s*([가-힣A-Za-z0-9\s]+)/g,
      // 일반적인 회사 패턴
      /([가-힣A-Za-z0-9\s]+)(?:회사|상사|기업|코퍼레이션|Corp|Inc|Ltd)/g
    ]

    for (const pattern of patterns) {
      const matches = [...subject.matchAll(pattern)]
      if (matches.length > 0) {
        const companyName = matches[0][1]?.trim()
        if (companyName && companyName.length > 1 && companyName.length < 50) {
          return {
            companyName,
            confidence: 0.7,
            source: 'SUBJECT'
          }
        }
      }
    }

    return { confidence: 0, source: 'SUBJECT' }
  }

  /**
   * 이메일 본문에서 업체명 추출
   */
  private async extractFromBody(body: string): Promise<CompanyExtractionResult> {
    // 본문이 너무 길면 처음 2000자만 분석
    const analyzedBody = body.substring(0, 2000)

    const patterns = [
      // 서명 영역의 회사명
      /(?:회사명|업체명|상호)[\s:]*([가-힣A-Za-z0-9\s()]+)/g,
      // 이메일 서명의 회사명
      /^([가-힣A-Za-z0-9\s()]+)(?:\s*회사|\s*상사|\s*기업)$/gm,
      // 발신자 정보의 회사명
      /보내는\s*(?:곳|회사)[\s:]*([가-힣A-Za-z0-9\s()]+)/g
    ]

    for (const pattern of patterns) {
      const matches = [...analyzedBody.matchAll(pattern)]
      if (matches.length > 0) {
        const companyName = matches[0][1]?.trim()
        if (companyName && companyName.length > 1 && companyName.length < 50) {
          return {
            companyName,
            confidence: 0.6,
            source: 'BODY'
          }
        }
      }
    }

    return { confidence: 0, source: 'BODY' }
  }

  /**
   * 첨부파일에서 업체명 추출
   */
  private async extractFromAttachment(attachment: {
    name: string
    content?: Buffer
    contentType?: string
  }): Promise<CompanyExtractionResult> {
    // 파일명에서 업체명 추출 시도
    const fileName = attachment.name
    const patterns = [
      // 파일명에 포함된 업체명
      /([가-힣A-Za-z0-9]+)(?:_|-|\s)*(?:발주|주문|견적|invoice)/i,
      // 파일명 자체가 업체명인 경우
      /^([가-힣A-Za-z0-9\s()]{2,20})(?:\.(pdf|xlsx?|docx?|hwp))?$/i
    ]

    for (const pattern of patterns) {
      const match = fileName.match(pattern)
      if (match) {
        const companyName = match[1]?.trim()
        if (companyName && companyName.length > 1 && companyName.length < 30) {
          return {
            companyName,
            confidence: 0.5,
            source: 'ATTACHMENT'
          }
        }
      }
    }

    // TODO: PDF, Excel 파일 내용 분석 (필요한 경우)
    // 현재는 파일명만 분석

    return { confidence: 0, source: 'ATTACHMENT' }
  }

  /**
   * 처리 액션 결정
   */
  private async determineActions(
    companyInfo: UnregisteredCompanyInfo,
    extractionResult: CompanyExtractionResult
  ): Promise<UnregisteredCompanyAction[]> {
    const actions: UnregisteredCompanyAction[] = []

    // 1. 자동 등록 가능성 평가
    if (this.canAutoRegister(companyInfo, extractionResult)) {
      actions.push({
        type: 'AUTO_REGISTER',
        description: '신뢰도가 높은 정보로 자동 등록 가능',
        confidence: extractionResult.confidence,
        metadata: {
          companyName: extractionResult.companyName,
          source: extractionResult.source
        }
      })
    }

    // 2. 수동 검토 필요성 평가
    if (this.needsManualReview(companyInfo, extractionResult)) {
      actions.push({
        type: 'MANUAL_REVIEW',
        description: '관리자 검토가 필요한 케이스',
        confidence: extractionResult.confidence,
        metadata: {
          reason: this.getManualReviewReason(companyInfo, extractionResult),
          emailCount: companyInfo.emailCount
        }
      })
    }

    // 3. 차단 필요성 평가
    if (this.shouldBlock(companyInfo)) {
      actions.push({
        type: 'BLOCK',
        description: '스팸 또는 악성 이메일로 의심',
        confidence: 0.9,
        metadata: {
          reason: '과도한 이메일 발송 또는 의심스러운 패턴'
        }
      })
    }

    // 4. 관리자 알림 필요성 평가
    if (this.needsAdminNotification(companyInfo, extractionResult)) {
      actions.push({
        type: 'NOTIFY_ADMIN',
        description: '관리자에게 알림 필요',
        confidence: 0.8,
        metadata: {
          priority: this.getNotificationPriority(companyInfo),
          emailCount: companyInfo.emailCount
        }
      })
    }

    // 액션이 없는 경우 기본 액션
    if (actions.length === 0) {
      actions.push({
        type: 'MANUAL_REVIEW',
        description: '기본 수동 검토',
        confidence: 0.3,
        metadata: {}
      })
    }

    return actions
  }

  /**
   * 자동 등록 가능 여부 확인
   */
  private canAutoRegister(
    companyInfo: UnregisteredCompanyInfo,
    extractionResult: CompanyExtractionResult
  ): boolean {
    return (
      extractionResult.confidence >= this.autoRegisterThreshold &&
      extractionResult.companyName &&
      extractionResult.companyName.length > 1 &&
      companyInfo.emailCount >= 2 // 최소 2회 이메일 수신
    )
  }

  /**
   * 수동 검토 필요 여부 확인
   */
  private needsManualReview(
    companyInfo: UnregisteredCompanyInfo,
    extractionResult: CompanyExtractionResult
  ): boolean {
    return (
      extractionResult.confidence >= this.reviewThreshold &&
      extractionResult.confidence < this.autoRegisterThreshold
    ) || companyInfo.emailCount >= 3
  }

  /**
   * 차단 필요 여부 확인
   */
  private shouldBlock(companyInfo: UnregisteredCompanyInfo): boolean {
    // 과도한 이메일 발송 (하루에 10개 이상)
    const daysSinceFirst = Math.floor(
      (Date.now() - companyInfo.firstSeenAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    const emailsPerDay = daysSinceFirst > 0 ? companyInfo.emailCount / daysSinceFirst : companyInfo.emailCount

    return emailsPerDay > 10
  }

  /**
   * 관리자 알림 필요 여부 확인
   */
  private needsAdminNotification(
    companyInfo: UnregisteredCompanyInfo,
    extractionResult: CompanyExtractionResult
  ): boolean {
    return (
      companyInfo.emailCount >= 5 || // 5회 이상 수신
      extractionResult.confidence >= 0.8 || // 높은 신뢰도
      this.shouldBlock(companyInfo) // 차단 대상
    )
  }

  /**
   * 수동 검토 이유 생성
   */
  private getManualReviewReason(
    companyInfo: UnregisteredCompanyInfo,
    extractionResult: CompanyExtractionResult
  ): string {
    if (extractionResult.confidence < this.autoRegisterThreshold) {
      return '업체 정보 추출 신뢰도 부족'
    }
    if (!extractionResult.companyName) {
      return '업체명 추출 실패'
    }
    return '추가 검증 필요'
  }

  /**
   * 알림 우선순위 결정
   */
  private getNotificationPriority(companyInfo: UnregisteredCompanyInfo): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (companyInfo.emailCount >= 10) return 'HIGH'
    if (companyInfo.emailCount >= 5) return 'MEDIUM'
    return 'LOW'
  }

  /**
   * 액션 실행
   */
  private async executeActions(
    companyInfo: UnregisteredCompanyInfo,
    actions: UnregisteredCompanyAction[]
  ): Promise<{
    action: 'PROCESSED' | 'QUEUED_FOR_REVIEW' | 'AUTO_REGISTERED' | 'BLOCKED'
    companyInfo: UnregisteredCompanyInfo
    registrationResult?: any
  }> {
    // 가장 높은 신뢰도의 액션 실행
    const primaryAction = actions.reduce(
      (best, current) => current.confidence > best.confidence ? current : best
    )

    switch (primaryAction.type) {
      case 'AUTO_REGISTER':
        const registrationResult = await this.autoRegisterCompany(companyInfo)
        return {
          action: 'AUTO_REGISTERED',
          companyInfo,
          registrationResult
        }

      case 'BLOCK':
        await this.blockCompany(companyInfo)
        return {
          action: 'BLOCKED',
          companyInfo
        }

      case 'MANUAL_REVIEW':
      default:
        await this.queueForReview(companyInfo)
        return {
          action: 'QUEUED_FOR_REVIEW',
          companyInfo
        }
    }
  }

  /**
   * 자동 업체 등록
   */
  private async autoRegisterCompany(companyInfo: UnregisteredCompanyInfo): Promise<any> {
    try {
      // TODO: 실제 업체 등록 로직 구현
      logger.info('Auto-registering company', {
        email: companyInfo.email,
        companyName: companyInfo.companyName
      })

      // 기본 정보로 업체 등록
      const newCompany = {
        name: companyInfo.companyName || `업체_${companyInfo.email}`,
        email: companyInfo.email,
        region: '기타', // 기본값
        isActive: true,
        autoRegistered: true,
        registeredAt: new Date()
      }

      // 기본 담당자 정보 생성
      const defaultContact = {
        name: '담당자',
        email: companyInfo.email,
        phone: '',
        isActive: true,
        smsEnabled: false,
        kakaoEnabled: false
      }

      return {
        company: newCompany,
        contact: defaultContact,
        success: true
      }

    } catch (error) {
      logger.error('Auto-registration failed', {
        email: companyInfo.email,
        error: error
      })

      throw error
    }
  }

  /**
   * 업체 차단
   */
  private async blockCompany(companyInfo: UnregisteredCompanyInfo): Promise<void> {
    try {
      // TODO: 차단 목록에 추가
      logger.warn('Blocking company', {
        email: companyInfo.email,
        emailCount: companyInfo.emailCount
      })

      // 메모리에서 제거
      this.unregisteredCompanies.delete(companyInfo.email)

    } catch (error) {
      logger.error('Failed to block company', {
        email: companyInfo.email,
        error: error
      })
    }
  }

  /**
   * 수동 검토 대기열에 추가
   */
  private async queueForReview(companyInfo: UnregisteredCompanyInfo): Promise<void> {
    try {
      // TODO: 검토 대기열에 추가
      logger.info('Queued company for manual review', {
        email: companyInfo.email,
        companyName: companyInfo.companyName,
        emailCount: companyInfo.emailCount
      })

    } catch (error) {
      logger.error('Failed to queue company for review', {
        email: companyInfo.email,
        error: error
      })
    }
  }

  /**
   * 관리자 알림 (필요한 경우)
   */
  private async notifyAdminIfNeeded(
    companyInfo: UnregisteredCompanyInfo,
    result: any
  ): Promise<void> {
    const needsNotification = companyInfo.suggestedActions.some(
      action => action.type === 'NOTIFY_ADMIN'
    )

    if (needsNotification) {
      const priority = this.getNotificationPriority(companyInfo)

      await globalErrorHandler.handleError(
        createEchoMailError.companyNotRegistered({
          email: companyInfo.email,
          companyName: companyInfo.companyName,
          emailCount: companyInfo.emailCount,
          action: result.action,
          priority
        }),
        { companyId: companyInfo.email }
      )
    }
  }

  /**
   * 미등록 업체 목록 조회
   */
  async getUnregisteredCompanies(
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    companies: UnregisteredCompanyInfo[]
    total: number
  }> {
    const companies = Array.from(this.unregisteredCompanies.values())
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .slice(offset, offset + limit)

    return {
      companies,
      total: this.unregisteredCompanies.size
    }
  }

  /**
   * 특정 미등록 업체 정보 조회
   */
  async getUnregisteredCompany(email: string): Promise<UnregisteredCompanyInfo | null> {
    return this.unregisteredCompanies.get(email) || null
  }

  /**
   * 미등록 업체 수동 승인
   */
  async approveUnregisteredCompany(
    email: string,
    companyData: {
      name: string
      region: string
      contacts: Array<{
        name: string
        phone: string
        email?: string
        position?: string
      }>
    }
  ): Promise<any> {
    try {
      // TODO: 실제 업체 등록 로직
      logger.info('Manually approving unregistered company', {
        email,
        companyData
      })

      // 미등록 업체 목록에서 제거
      this.unregisteredCompanies.delete(email)

      return { success: true }

    } catch (error) {
      logger.error('Failed to approve unregistered company', {
        email,
        error
      })
      throw error
    }
  }

  /**
   * 미등록 업체 거부
   */
  async rejectUnregisteredCompany(email: string, reason: string): Promise<void> {
    try {
      logger.info('Rejecting unregistered company', { email, reason })

      // 차단 목록에 추가하고 미등록 목록에서 제거
      await this.blockCompany({ email } as UnregisteredCompanyInfo)

    } catch (error) {
      logger.error('Failed to reject unregistered company', {
        email,
        error
      })
      throw error
    }
  }
}

// 싱글톤 인스턴스 내보내기
export const unregisteredCompanyHandler = UnregisteredCompanyHandler.getInstance()