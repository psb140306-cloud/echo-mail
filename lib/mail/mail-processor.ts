import { ProcessedEmail } from './imap-client'
import { logger } from '@/lib/utils/logger'
import { prisma } from '@/lib/db'

export interface EmailMatchResult {
  isMatch: boolean
  companyId?: string
  companyName?: string
  companyEmail?: string
  matchType: 'domain' | 'exact' | 'keyword' | 'none'
  confidence: number
}

export interface ProcessingResult {
  success: boolean
  action: 'ignored' | 'processed' | 'error'
  reason?: string
  company?: {
    id: string
    name: string
    email: string
  }
}

export class MailProcessor {
  constructor() {}

  async processEmail(email: ProcessedEmail): Promise<ProcessingResult> {
    try {
      logger.info('메일 처리 시작', {
        from: email.from,
        subject: email.subject,
        messageId: email.messageId,
      })

      // 1. 업체 매칭
      const matchResult = await this.matchCompany(email)

      if (!matchResult.isMatch) {
        logger.info('매칭되는 업체가 없음', { from: email.from })

        // 미등록 업체 로그 기록
        await this.logUnmatchedEmail(email)

        return {
          success: true,
          action: 'ignored',
          reason: '등록되지 않은 업체',
        }
      }

      // 2. 발주 확인 옵션에 따른 검증
      const isValidOrder = await this.validateOrder(email, matchResult)

      if (!isValidOrder) {
        logger.info('발주서 검증 실패', {
          from: email.from,
          company: matchResult.companyName,
        })

        return {
          success: true,
          action: 'ignored',
          reason: '발주서 검증 실패',
        }
      }

      // 3. 메일 로그 기록
      await this.logReceivedEmail(email, matchResult)

      // 4. 알림 발송 트리거 (향후 구현)
      // await this.triggerNotification(email, matchResult)

      logger.info('메일 처리 완료', {
        company: matchResult.companyName,
        action: 'processed',
      })

      return {
        success: true,
        action: 'processed',
        company: {
          id: matchResult.companyId!,
          name: matchResult.companyName!,
          email: matchResult.companyEmail!,
        },
      }
    } catch (error) {
      logger.error('메일 처리 중 오류 발생:', error)

      return {
        success: false,
        action: 'error',
        reason: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  private async matchCompany(email: ProcessedEmail): Promise<EmailMatchResult> {
    try {
      // 1. 정확한 이메일 매칭 (가장 높은 신뢰도)
      const exactMatch = await prisma.company.findFirst({
        where: {
          email: email.from,
          isActive: true,
        },
      })

      if (exactMatch) {
        return {
          isMatch: true,
          companyId: exactMatch.id,
          companyName: exactMatch.name,
          companyEmail: exactMatch.email,
          matchType: 'exact',
          confidence: 1.0,
        }
      }

      // 2. 도메인 매칭
      const fromDomain = email.from.split('@')[1]
      if (fromDomain) {
        const domainMatch = await prisma.company.findFirst({
          where: {
            email: {
              endsWith: `@${fromDomain}`,
            },
            isActive: true,
          },
        })

        if (domainMatch) {
          return {
            isMatch: true,
            companyId: domainMatch.id,
            companyName: domainMatch.name,
            companyEmail: domainMatch.email,
            matchType: 'domain',
            confidence: 0.8,
          }
        }
      }

      // 3. 키워드 매칭 (제목이나 본문에서 업체명 찾기)
      const companies = await prisma.company.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
      })

      const searchText = `${email.subject} ${email.body.text || ''}`.toLowerCase()

      for (const company of companies) {
        const companyKeywords = [
          company.name,
          company.name.replace(/주식회사|㈜|\(주\)|유한회사|㈜/g, ''),
          company.email.split('@')[0],
        ]

        for (const keyword of companyKeywords) {
          if (keyword && searchText.includes(keyword.toLowerCase())) {
            return {
              isMatch: true,
              companyId: company.id,
              companyName: company.name,
              companyEmail: company.email,
              matchType: 'keyword',
              confidence: 0.6,
            }
          }
        }
      }

      // 매칭 실패
      return {
        isMatch: false,
        matchType: 'none',
        confidence: 0,
      }
    } catch (error) {
      logger.error('업체 매칭 중 오류:', error)
      return {
        isMatch: false,
        matchType: 'none',
        confidence: 0,
      }
    }
  }

  private async validateOrder(
    email: ProcessedEmail,
    matchResult: EmailMatchResult
  ): Promise<boolean> {
    try {
      // 시스템 설정에서 메일 확인 옵션 가져오기
      const mailCheckOption = await prisma.systemConfig.findUnique({
        where: { key: 'MAIL_CHECK_OPTION' },
      })

      const checkOption = mailCheckOption?.value || 'simple'

      switch (checkOption) {
        case 'simple':
          // 단순 수신 확인 - 항상 true
          return true

        case 'keyword':
          // 키워드 매칭
          return this.checkKeywords(email)

        case 'attachment':
          // 첨부파일 검증
          return this.checkAttachments(email)

        case 'content':
          // 본문 내용 검증
          return this.checkContent(email)

        default:
          return true
      }
    } catch (error) {
      logger.error('발주서 검증 중 오류:', error)
      return false
    }
  }

  private checkKeywords(email: ProcessedEmail): boolean {
    const orderKeywords = [
      '발주',
      '주문',
      '구매',
      '납품',
      '요청',
      'order',
      'purchase',
      'buy',
      '구매요청서',
      '발주서',
      '주문서',
    ]

    const searchText = `${email.subject} ${email.body.text || ''}`.toLowerCase()

    return orderKeywords.some((keyword) => searchText.includes(keyword.toLowerCase()))
  }

  private checkAttachments(email: ProcessedEmail): boolean {
    if (email.attachments.length === 0) {
      return false
    }

    const validExtensions = ['.pdf', '.xls', '.xlsx', '.doc', '.docx', '.hwp']

    return email.attachments.some(
      (attachment) =>
        attachment.filename &&
        validExtensions.some((ext) => attachment.filename!.toLowerCase().endsWith(ext))
    )
  }

  private checkContent(email: ProcessedEmail): boolean {
    const contentPatterns = [
      /품목|수량|단가|금액/,
      /납품일|납기일|배송일/,
      /\d{1,3}(,\d{3})*원|\d+개|\d+EA/i,
      /견적|단가|총액/,
    ]

    const searchText = `${email.subject} ${email.body.text || ''}`

    return contentPatterns.some((pattern) => pattern.test(searchText))
  }

  private async logReceivedEmail(
    email: ProcessedEmail,
    matchResult: EmailMatchResult
  ): Promise<void> {
    try {
      // EmailLog 테이블에 기록 (테이블이 생성되면 활성화)
      /*
      await prisma.emailLog.create({
        data: {
          messageId: email.messageId,
          fromEmail: email.from,
          toEmail: email.to.join(','),
          subject: email.subject,
          receivedAt: email.receivedAt,
          companyId: matchResult.companyId,
          matchType: matchResult.matchType,
          confidence: matchResult.confidence,
          hasAttachment: email.attachments.length > 0,
          attachmentCount: email.attachments.length,
          isProcessed: true
        }
      })
      */

      logger.info('메일 로그 기록', {
        messageId: email.messageId,
        company: matchResult.companyName,
        matchType: matchResult.matchType,
      })
    } catch (error) {
      logger.error('메일 로그 기록 실패:', error)
    }
  }

  private async logUnmatchedEmail(email: ProcessedEmail): Promise<void> {
    try {
      // UnmatchedEmail 테이블에 기록 (향후 추가)
      logger.warn('미매칭 메일 기록', {
        from: email.from,
        subject: email.subject,
        messageId: email.messageId,
      })
    } catch (error) {
      logger.error('미매칭 메일 로그 실패:', error)
    }
  }
}

export const mailProcessor = new MailProcessor()
