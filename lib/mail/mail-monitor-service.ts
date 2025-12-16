import { PrismaClient } from '@prisma/client'
import { ImapFlow } from 'imapflow'
import { simpleParser, ParsedMail, Attachment } from 'mailparser'
// @ts-ignore - libmime에 타입 정의 파일이 없음
import { decode as decodeMailHeader } from 'libmime'
import { logger } from '@/lib/utils/logger'
import { createImapClient } from '@/lib/imap/connection'
import { parseOrderEmail, KeywordOptions } from './email-parser'
import { sendOrderReceivedNotification } from '@/lib/notifications/notification-service'
import { getKSTStartOfDaysAgo, isKSTToday, formatKSTDate } from '@/lib/utils/date'
import { canAccessFullMailbox } from '@/lib/subscription/plan-checker'
import { SubscriptionPlan } from '@/lib/subscription/plans'
// TODO: 미등록 업체 알림 로직 - 순환 참조 또는 런타임 에러로 인해 임시 비활성화
// import { unregisteredCompanyHandler } from '@/lib/unregistered-company-handler'

const prisma = new PrismaClient()

/**
 * MIME 인코딩된 메일 헤더 디코딩 (제목, 발신자명 등)
 * 예: =?UTF-8?B?7ZWc6riA7YWM7Iqk7Yq4?= → 한글테스트
 * 예: =?euc-kr?Q?=C7=D1=B1=DB?= → 한글
 */
function decodeMimeHeader(header: string | undefined): string {
  if (!header) return ''

  try {
    // libmime의 decode 함수 사용
    const decoded = decodeMailHeader(header)
    return decoded || header
  } catch (error) {
    logger.warn('[MailMonitor] MIME 헤더 디코딩 실패, 원본 반환:', {
      header: header.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return header
  }
}

// 파싱된 이메일 정보 인터페이스
interface ParsedEmailContent {
  textBody: string | null
  htmlBody: string | null
  attachments: {
    filename: string
    contentType: string
    size: number
    content: Buffer
  }[]
  // 발신자 정보 (mailparser에서 추출)
  fromName: string | null
  fromAddress: string | null
}

export interface MailCheckResult {
  success: boolean
  newMailsCount: number
  processedCount: number
  failedCount: number
  errors: string[]
}

export interface TenantMailConfig {
  tenantId: string
  host: string
  port: number
  username: string
  password: string
  useSSL: boolean
  enabled: boolean
  // mailMode 지원을 위한 추가 필드
  subscriptionPlan: SubscriptionPlan
  mailMode: 'ORDER_ONLY' | 'FULL_INBOX'
  effectiveMailMode: 'ORDER_ONLY' | 'FULL_INBOX' // 플랜 제한 적용된 실제 모드
  // 키워드 설정
  orderKeywords: string[]
  keywordsDisabled: boolean
}

/**
 * 메일 모니터링 서비스
 * 각 테넌트의 메일함을 주기적으로 확인하고 새 발주 메일을 감지
 */
export class MailMonitorService {
  private isRunning = false
  private lastCheckTimes = new Map<string, Date>()
  private companyEmailsCache = new Map<string, { emails: string[]; updatedAt: Date }>()
  // 처리 완료된 UID 캐시 (테넌트별, 오늘 날짜 기준) - egress 절감용
  private processedUidsCache = new Map<string, { uids: Set<number>; date: string }>()

  /**
   * 모든 활성 테넌트의 메일 확인
   */
  async checkAllTenants(): Promise<Map<string, MailCheckResult>> {
    if (this.isRunning) {
      logger.warn('[MailMonitor] 이미 실행 중입니다')
      return new Map()
    }

    this.isRunning = true
    const results = new Map<string, MailCheckResult>()

    try {
      logger.info('[MailMonitor] 전체 테넌트 메일 확인 시작')

      // 활성화된 메일 서버 설정이 있는 테넌트 조회
      const configs = await this.getActiveTenantConfigs()

      logger.info(`[MailMonitor] 활성 테넌트 ${configs.length}개 발견`)

      // 각 테넌트 순차 처리
      for (const config of configs) {
        try {
          const result = await this.checkTenantMails(config)
          results.set(config.tenantId, result)

          logger.info(`[MailMonitor] 테넌트 ${config.tenantId} 처리 완료`, {
            newMails: result.newMailsCount,
            processed: result.processedCount,
            failed: result.failedCount,
          })
        } catch (error) {
          logger.error(`[MailMonitor] 테넌트 ${config.tenantId} 처리 실패:`, error)
          results.set(config.tenantId, {
            success: false,
            newMailsCount: 0,
            processedCount: 0,
            failedCount: 0,
            errors: [error instanceof Error ? error.message : '알 수 없는 오류'],
          })
        }
      }

      logger.info('[MailMonitor] 전체 테넌트 메일 확인 완료', {
        totalTenants: configs.length,
        successCount: Array.from(results.values()).filter((r) => r.success).length,
      })

      return results
    } finally {
      this.isRunning = false
    }
  }

  /**
   * 특정 테넌트의 메일 확인
   * - FULL_INBOX 모드: 모든 메일 수집
   * - ORDER_ONLY 모드: 등록된 업체 메일만 수집
   */
  async checkTenantMails(config: TenantMailConfig): Promise<MailCheckResult> {
    const errors: string[] = []
    let newMailsCount = 0
    let processedCount = 0
    let failedCount = 0

    let client: ImapFlow | null = null

    try {
      // IMAP 클라이언트 생성 및 연결
      client = createImapClient({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        useSSL: config.useSSL,
      })

      await client.connect()
      logger.info(`[MailMonitor] 테넌트 ${config.tenantId} IMAP 연결 성공`, {
        effectiveMailMode: config.effectiveMailMode,
      })

      // INBOX 열기
      const lock = await client.getMailboxLock('INBOX')

      try {
        const messages = []
        // 3일 전(KST)부터 검색 - 워커 재시작/에러/누락 방지 (중복은 Message-ID로 필터링)
        const since = getKSTStartOfDaysAgo(3)

        if (config.effectiveMailMode === 'FULL_INBOX') {
          // FULL_INBOX 모드: 모든 메일 수집 (등록된 업체 제한 없음)
          logger.info(`[MailMonitor] FULL_INBOX 모드 - 모든 메일 수집`, {
            tenantId: config.tenantId,
          })

          const searchCriteria = {
            since, // 3일 전부터 검색 (누락 방지, 중복은 Message-ID로 필터링)
            // unseen 조건 제거 - 읽은 메일도 수집
          }

          logger.info(`[MailMonitor] IMAP 전체 검색 시작:`, { searchCriteria })

          try {
            // ========== 2단계 Fetch 최적화 ==========
            // Stage 1: 헤더만 먼저 조회 (본문 제외 - 트래픽 절감)
            const headerList: { uid: number; envelope: any; internalDate: Date; headers: any }[] = []

            for await (const message of client.fetch(searchCriteria, {
              envelope: true,
              uid: true,
              internalDate: true,
              headers: ['message-id', 'x-spam-status', 'x-spam-flag', 'x-daum-spam'],
              // source: false (기본값) - 본문 다운로드 안 함
              markSeen: false,
            })) {
              // 스팸 메일 필터링
              const isSpam = this.checkIfSpam(message.headers)
              if (isSpam) {
                logger.debug(`[MailMonitor] 스팸 메일 스킵 (Stage 1):`, { uid: message.uid })
                continue
              }

              // 메모리 캐시 체크 (런타임 중복 방지)
              if (this.isUidProcessed(config.tenantId, message.uid)) {
                continue
              }

              headerList.push({
                uid: message.uid,
                envelope: message.envelope,
                internalDate: message.internalDate,
                headers: message.headers,
              })
            }

            logger.info(`[MailMonitor] Stage 1 완료 - 헤더 ${headerList.length}개 조회`, {
              tenantId: config.tenantId,
            })

            if (headerList.length === 0) {
              // 새 메일 없음 - 여기서 종료
            } else {
              // Stage 2: DB에서 기존 UID 확인
              const uidsToCheck = headerList.map(h => h.uid)
              const existingEmails = await prisma.emailLog.findMany({
                where: {
                  tenantId: config.tenantId,
                  imapUid: { in: uidsToCheck },
                },
                select: { imapUid: true },
              })
              const existingUidSet = new Set(existingEmails.map(e => e.imapUid).filter((uid): uid is number => uid !== null))

              // 새 메일 UID 필터링
              const newHeaders = headerList.filter(h => !existingUidSet.has(h.uid))

              logger.info(`[MailMonitor] Stage 2 완료 - DB 중복 체크`, {
                tenantId: config.tenantId,
                totalHeaders: headerList.length,
                existingInDb: existingUidSet.size,
                newMails: newHeaders.length,
              })

              if (newHeaders.length > 0) {
                // Stage 3: 새 메일만 본문 다운로드
                const newUids = newHeaders.map(h => h.uid)

                for await (const message of client.fetch(newUids, {
                  envelope: true,
                  uid: true,
                  internalDate: true,
                  source: true, // 새 메일만 본문 다운로드
                  headers: ['message-id', 'x-spam-status', 'x-spam-flag', 'x-daum-spam'],
                  markSeen: false,
                })) {
                  logger.info(`[MailMonitor] 메일 발견 (Stage 3):`, {
                    uid: message.uid,
                    from: message.envelope?.from?.[0]?.address,
                    subject: message.envelope?.subject,
                  })
                  messages.push(message)
                }
              }
            }
            // ========== 2단계 Fetch 최적화 끝 ==========
          } catch (error) {
            logger.warn(`[MailMonitor] 전체 메일 검색 실패:`, error)
          }
        } else {
          // ORDER_ONLY 모드: 등록된 업체 이메일만 수집 (2단계 Fetch 최적화 적용)
          const registeredEmails = await this.getRegisteredCompanyEmails(config.tenantId)

          if (registeredEmails.length === 0) {
            logger.info(`[MailMonitor] 테넌트 ${config.tenantId} 등록된 업체 없음`)
            return {
              success: true,
              newMailsCount: 0,
              processedCount: 0,
              failedCount: 0,
              errors: [],
            }
          }

          logger.info(`[MailMonitor] ORDER_ONLY 모드 - 등록된 업체 ${registeredEmails.length}개 메일만 수집`, {
            tenantId: config.tenantId,
          })

          // ========== 2단계 Fetch 최적화 (ORDER_ONLY) ==========
          // Stage 1: 모든 등록 업체 메일의 헤더만 수집
          const allHeaderList: { uid: number; envelope: any; internalDate: Date; headers: any }[] = []

          for (const email of registeredEmails) {
            try {
              const searchCriteria = {
                from: email,
                since, // 3일 전부터 검색 (누락 방지, 중복은 Message-ID로 필터링)
              }

              logger.debug(`[MailMonitor] IMAP 헤더 검색 (Stage 1):`, { email })

              for await (const message of client.fetch(searchCriteria, {
                envelope: true,
                uid: true,
                internalDate: true,
                headers: ['message-id', 'x-spam-status', 'x-spam-flag', 'x-daum-spam'],
                // source: false (기본값) - 본문 다운로드 안 함
                markSeen: false,
              })) {
                // 스팸 메일 필터링
                const isSpam = this.checkIfSpam(message.headers)
                if (isSpam) {
                  logger.debug(`[MailMonitor] 스팸 메일 스킵 (Stage 1):`, { uid: message.uid })
                  continue
                }

                // 메모리 캐시 체크 (런타임 중복 방지)
                if (this.isUidProcessed(config.tenantId, message.uid)) {
                  continue
                }

                allHeaderList.push({
                  uid: message.uid,
                  envelope: message.envelope,
                  internalDate: message.internalDate,
                  headers: message.headers,
                })
              }
            } catch (error) {
              logger.warn(`[MailMonitor] ${email} 헤더 검색 실패:`, error)
            }
          }

          logger.info(`[MailMonitor] Stage 1 완료 - 헤더 ${allHeaderList.length}개 조회`, {
            tenantId: config.tenantId,
            registeredEmails: registeredEmails.length,
          })

          if (allHeaderList.length > 0) {
            // Stage 2: DB에서 기존 UID 확인
            const uidsToCheck = allHeaderList.map(h => h.uid)
            const existingEmails = await prisma.emailLog.findMany({
              where: {
                tenantId: config.tenantId,
                imapUid: { in: uidsToCheck },
              },
              select: { imapUid: true },
            })
            const existingUidSet = new Set(existingEmails.map(e => e.imapUid).filter((uid): uid is number => uid !== null))

            // 새 메일 UID 필터링
            const newHeaders = allHeaderList.filter(h => !existingUidSet.has(h.uid))

            logger.info(`[MailMonitor] Stage 2 완료 - DB 중복 체크`, {
              tenantId: config.tenantId,
              totalHeaders: allHeaderList.length,
              existingInDb: existingUidSet.size,
              newMails: newHeaders.length,
            })

            if (newHeaders.length > 0) {
              // Stage 3: 새 메일만 본문 다운로드
              const newUids = newHeaders.map(h => h.uid)

              for await (const message of client.fetch(newUids, {
                envelope: true,
                uid: true,
                internalDate: true,
                source: true, // 새 메일만 본문 다운로드
                headers: ['message-id', 'x-spam-status', 'x-spam-flag', 'x-daum-spam'],
                markSeen: false,
              })) {
                logger.info(`[MailMonitor] 메일 발견 (Stage 3):`, {
                  uid: message.uid,
                  from: message.envelope?.from?.[0]?.address,
                  subject: message.envelope?.subject,
                })
                messages.push(message)
              }
            }
          }
          // ========== 2단계 Fetch 최적화 끝 (ORDER_ONLY) ==========
        }

        newMailsCount = messages.length
        logger.info(`[MailMonitor] 테넌트 ${config.tenantId} 새 메일 ${newMailsCount}개 발견`, {
          effectiveMailMode: config.effectiveMailMode,
        })

        // 각 메일 처리
        for (const message of messages) {
          try {
            await this.processEmail(config.tenantId, message, client, config)
            processedCount++
          } catch (error) {
            failedCount++
            const errorMsg = error instanceof Error ? error.message : '메일 처리 실패'
            errors.push(`UID ${message.uid}: ${errorMsg}`)
            logger.error(`[MailMonitor] 메일 처리 실패 (UID: ${message.uid}):`, error)
          }
        }

        // 마지막 확인 시간 업데이트
        this.lastCheckTimes.set(config.tenantId, new Date())
      } finally {
        lock.release()
      }

      return {
        success: true,
        newMailsCount,
        processedCount,
        failedCount,
        errors,
      }
    } catch (error) {
      logger.error(`[MailMonitor] 테넌트 ${config.tenantId} 메일 확인 실패:`, error)
      return {
        success: false,
        newMailsCount,
        processedCount,
        failedCount,
        errors: [...errors, error instanceof Error ? error.message : '알 수 없는 오류'],
      }
    } finally {
      // IMAP 연결 종료
      if (client) {
        try {
          await client.logout()
        } catch (error) {
          logger.debug('[MailMonitor] IMAP 로그아웃 실패 (무시됨)', error)
        }
      }
    }
  }

  /**
   * 개별 이메일 처리 (재시도 로직 포함)
   * - FULL_INBOX 모드: 발주 메일 여부와 관계없이 모두 저장
   * - ORDER_ONLY 모드: 발주 메일만 저장, 알림 발송
   */
  private async processEmail(
    tenantId: string,
    message: any,
    client: ImapFlow,
    config: TenantMailConfig
  ): Promise<void> {
    const effectiveMailMode = config.effectiveMailMode
    const from = message.envelope.from?.[0]
    // MIME 인코딩된 제목 디코딩 (예: =?utf-8?B?...?= → 한글)
    const rawSubject = message.envelope.subject
    const subject = decodeMimeHeader(rawSubject)
    // internalDate: 메일이 서버에 도착한 실제 시간 (IMAP INTERNALDATE)
    // envelope.date: 발신자가 메일을 보낸 시간 (Date 헤더) - 부정확할 수 있음
    const receivedDate = message.internalDate || message.envelope.date
    const sentDate = message.envelope.date // 발송 시간은 별도 보관
    const maxRetries = 3
    let lastError: Error | null = null

    // 제목 디코딩 로깅
    if (rawSubject !== subject) {
      logger.info('[MailMonitor] 제목 MIME 디코딩 완료', {
        raw: rawSubject?.substring(0, 50),
        decoded: subject.substring(0, 50),
      })
    }

    // autoMarkAsRead 설정 조회
    const mailConfig = await this.getMailConfig(tenantId)

    // [KST 날짜 확인] 오늘 메일인지 확인 (알림 발송 여부 결정용)
    // 어제 메일도 저장은 하되, 알림은 오늘 메일만 발송
    const isTodayMail = receivedDate ? isKSTToday(receivedDate) : true

    // 실제 Message-ID 헤더 추출
    let messageIdHeader = message.headers?.['message-id']?.[0]

    // Message-ID가 없으면 안정적인 fallback ID 생성
    // 중요: bodyHash 대신 UID 사용 (IMAP UID는 같은 메일함에서 고유하고 안정적)
    // 이전 문제: bodyHash가 IMAP fetch마다 달라져서 같은 메일에 다른 emailLogId 생성
    if (!messageIdHeader) {
      const dateStr = receivedDate ? receivedDate.toISOString().split('T')[0] : 'unknown'
      const sender = from?.address || 'unknown'

      // UID 기반 fallback ID (안정적)
      messageIdHeader = `fallback-${tenantId}-uid${message.uid}-${sender}-${dateStr}`
      logger.warn('[MailMonitor] Message-ID 헤더 없음 - UID 기반 fallback ID 사용', {
        uid: message.uid,
        fallbackId: messageIdHeader,
      })
    }

    logger.info('[MailMonitor] 메일 처리 시작', {
      tenantId,
      uid: message.uid,
      messageId: messageIdHeader,
      from: from?.address,
      subject,
      receivedDate, // IMAP INTERNALDATE (실제 수신 시간)
      sentDate, // envelope.date (발신 시간)
    })

    let emailLogId: string | undefined

    try {
      // 중복 이메일 체크 (Message-ID 기반 + 알림 발송 여부 확인)
      // select로 필요한 필드만 조회하여 egress 절감 (본문 제외)
      const existingEmail = await prisma.emailLog.findFirst({
        where: {
          messageId: messageIdHeader,
          tenantId,
        },
        select: {
          id: true,
          messageId: true,
          status: true,
          notifications: {
            select: {
              id: true,
              status: true,
              createdAt: true,
            },
          },
        },
      })

      if (existingEmail) {
        // 발송 성공한 알림이 있는지 확인
        const hasSuccessfulNotification = existingEmail.notifications.some(
          (n) => n.status === 'SENT' || n.status === 'DELIVERED'
        )

        if (hasSuccessfulNotification) {
          // 알림 발송 완료 → 스킵
          logger.info('[중복 방지] 알림 발송 완료된 메일 - DB 기반 스킵', {
            messageId: messageIdHeader,
            existingLogId: existingEmail.id,
            sentAt: existingEmail.notifications[0].createdAt,
          })

          // 설정에 따라 읽음 처리
          if (mailConfig.autoMarkAsRead) {
            await this.safeMarkAsRead(client, message.uid)
          }
          return
        } else {
          // 알림 미발송 → 재처리
          logger.info('[재시도] 알림 미발송 메일 재처리', {
            messageId: messageIdHeader,
            existingLogId: existingEmail.id,
            previousAttempts: existingEmail.notifications.length,
          })
          emailLogId = existingEmail.id // 기존 EmailLog 재사용
        }
      }
      // 메일 파싱하여 키워드 정보 추출 (테넌트 커스텀 키워드 사용)
      const emailContent = message.source?.toString() || ''
      const keywordOptions: KeywordOptions = {
        customKeywords: config.orderKeywords.length > 0 ? config.orderKeywords : undefined,
        keywordsDisabled: config.keywordsDisabled,
      }
      const parsedData = await parseOrderEmail({
        from: from?.address || '',
        fromName: from?.name || '',
        subject: subject || '',
        body: emailContent,
        receivedDate: receivedDate,
      }, keywordOptions)

      // 1단계: 등록된 업체인지 확인
      const company = await this.findCompanyByEmail(tenantId, parsedData)

      // 2단계: 발주 메일 판단 = (등록된 업체) AND (키워드 포함)
      // 핵심: 등록된 업체가 아니면 키워드가 있어도 발주 메일이 아님
      const isOrderEmail = company !== null && parsedData.hasOrderKeywords

      if (company) {
        logger.info('[MailMonitor] 업체 매칭 성공', {
          companyId: company.id,
          companyName: company.name,
          hasOrderKeywords: parsedData.hasOrderKeywords,
          isOrderEmail,
          emailReceivedAt: receivedDate,
        })
      }

      // ORDER_ONLY 모드: 등록 업체의 발주 메일만 저장
      if (effectiveMailMode === 'ORDER_ONLY') {
        if (!isOrderEmail) {
          logger.info('[MailMonitor] ORDER_ONLY 모드 - 발주 메일이 아님, 스킵', {
            uid: message.uid,
            subject,
            hasCompany: !!company,
            hasOrderKeywords: parsedData.hasOrderKeywords,
          })
          if (mailConfig.autoMarkAsRead) {
            await this.safeMarkAsRead(client, message.uid)
          }
          return
        }
      }

      // FULL_INBOX 모드: 모든 메일 저장 (발주 여부는 위에서 계산된 isOrderEmail 사용)
      if (!company && effectiveMailMode === 'FULL_INBOX') {
        logger.info('[MailMonitor] FULL_INBOX 모드 - 미등록 업체 메일, 일반 메일로 저장', {
          tenantId,
          from: from?.address,
          hasOrderKeywords: parsedData.hasOrderKeywords,
        })
      }

      // EmailLog 생성 (재처리가 아닌 경우만)
      let emailLog
      if (emailLogId) {
        // 재처리: 기존 EmailLog 사용
        emailLog = await prisma.emailLog.findUnique({
          where: { id: emailLogId },
        })
        logger.info('[MailMonitor] 기존 EmailLog 재사용', {
          emailLogId,
        })
      } else {
        // 신규: EmailLog 생성
        // mailparser를 사용하여 본문 및 첨부파일 파싱
        const emailSource = message.source
        const parsedEmail = await this.parseEmailWithMailparser(emailSource)
        const emailSize = message.size || (emailSource ? emailSource.length : 0)

        // 상태 결정: 업체 매칭되면 MATCHED, 아니면 RECEIVED
        const status = company ? 'MATCHED' : 'RECEIVED'

        // 발신자 이름: mailparser에서 추출 (MIME 자동 디코딩) → IMAP envelope fallback
        // mailparser가 MIME 인코딩을 제대로 디코딩하므로 우선 사용
        const senderName = parsedEmail.fromName || decodeMimeHeader(from?.name || '') || null

        // 디버그: senderName 로그
        logger.info('[MailMonitor] 발신자 정보', {
          tenantId,
          uid: message.uid,
          'from.address': from?.address,
          'imap from.name': from?.name,
          'mailparser fromName': parsedEmail.fromName,
          'senderName (final)': senderName,
        })

        emailLog = await prisma.emailLog.create({
          data: {
            messageId: messageIdHeader, // 실제 Message-ID 사용
            sender: from?.address || '',
            senderName: senderName, // 발신자 이름 (예: "잡코리아 | AI추천")
            recipient: '', // IMAP에서는 수신자 정보 없음
            subject: subject || '',
            receivedAt: receivedDate, // IMAP INTERNALDATE (실제 수신 시간)
            body: parsedEmail.textBody, // Plain text 본문
            bodyHtml: parsedEmail.htmlBody, // HTML 본문
            isRead: false, // 새 메일은 읽지 않음
            folder: 'INBOX', // 기본 메일함
            size: emailSize, // 메일 크기
            isOrder: isOrderEmail, // 발주 메일 여부 (등록 업체 + 키워드)
            imapUid: message.uid, // IMAP UID 저장 (첨부파일 실시간 fetch용)
            hasAttachment: parsedEmail.attachments.length > 0,
            attachments: parsedEmail.attachments.length > 0
              ? parsedEmail.attachments.map((att, index) => ({
                  id: `att-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                  filename: att.filename,
                  contentType: att.contentType,
                  size: att.size,
                  partId: String(index + 1), // 첨부파일 파트 번호 (IMAP fetch용)
                  // content는 저장하지 않음 - 다운로드 시 IMAP에서 실시간 fetch
                }))
              : [],
            status,
            companyId: company?.id || null, // 업체 없으면 null
            tenantId,
          },
        })

        logger.info('[MailMonitor] EmailLog 생성 완료', {
          emailLogId: emailLog.id,
          isOrder: parsedData.isOrderEmail,
          hasCompany: !!company,
          status,
          hasBody: !!parsedEmail.textBody || !!parsedEmail.htmlBody,
          attachmentCount: parsedEmail.attachments.length,
        })
      }

      if (!emailLog) {
        throw new Error('EmailLog를 찾을 수 없습니다')
      }

      // 알림 발송: 등록 업체의 발주 메일 + 오늘 메일인 경우에만
      // 어제 메일은 저장만 하고 알림 발송 안 함 (중복 알림 방지)
      if (isOrderEmail && company && isTodayMail) {
        try {
          logger.info('[MailMonitor] 알림 발송 시작', {
            companyId: company.id,
            companyName: company.name,
            emailLogId: emailLog.id,
          })

          // 주문 시간은 메일 처리 시점(현재 시간)을 사용
          const results = await sendOrderReceivedNotification(company.id, new Date(), emailLog.id)
          const successCount = results.filter((r) => r.success).length
          const failedResultCount = results.filter((r) => !r.success).length

          logger.info('[MailMonitor] 알림 발송 완료', {
            companyId: company.id,
            companyName: company.name,
            totalContacts: results.length,
            successCount,
            failedCount: failedResultCount,
            results: results.map((r) => ({
              success: r.success,
              error: r.error,
              errorCode: r.errorCode,
              provider: r.provider,
            })),
          })

          if (results.length === 0) {
            logger.info('[MailMonitor] 알림 발송 스킵 - 담당자 없음 또는 이미 성공 상태', {
              companyId: company.id,
              emailLogId: emailLog.id,
            })
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('알림 발송 실패')
          logger.error('[MailMonitor] 알림 발송 중 예외 발생:', {
            companyId: company.id,
            emailLogId: emailLog.id,
            error: lastError.message,
          })
        }
      } else if (isOrderEmail && company && !isTodayMail) {
        // 어제 발주 메일 - 저장만 하고 알림 발송 안 함
        logger.info('[MailMonitor] 어제 발주 메일 저장 완료 (알림 스킵)', {
          emailLogId: emailLog.id,
          companyId: company.id,
          companyName: company.name,
          mailReceivedAt: receivedDate?.toISOString(),
          mailReceivedAtKST: receivedDate ? formatKSTDate(receivedDate) : 'unknown',
        })
      } else {
        // 일반 메일 (FULL_INBOX 모드) - 알림 없이 저장만
        logger.info('[MailMonitor] 일반 메일 저장 완료 (알림 없음)', {
          emailLogId: emailLog.id,
          isOrder: isOrderEmail,
          hasCompany: !!company,
        })
      }

      // 설정에 따라 읽음 처리
      if (mailConfig.autoMarkAsRead) {
        await this.safeMarkAsRead(client, message.uid)
        logger.info('[MailMonitor] 메일 읽음 처리 완료', { uid: message.uid })
      } else {
        logger.info('[MailMonitor] 읽음 처리 스킵 (설정 OFF)', { uid: message.uid })
      }

      // 알림 발송 실패해도 메일은 처리된 것으로 간주
      if (lastError && company) {
        logger.warn('[MailMonitor] 알림 발송 실패, 다음 스케줄에서 재시도 예정', {
          companyId: company.id,
          emailLogId: emailLog.id,
          error: lastError.message,
        })
      }

      // 처리 완료된 UID를 캐시에 추가 (재조회 방지)
      this.markUidAsProcessed(tenantId, message.uid)
    } catch (error) {
      logger.error('[MailMonitor] 메일 처리 최종 실패:', error)
      // 에러 발생 시에도 설정에 따라 읽음 처리
      if (mailConfig.autoMarkAsRead) {
        await this.safeMarkAsRead(client, message.uid)
      }
      throw error
    }
  }

  /**
   * 안전한 읽음 처리 (에러 무시)
   */
  private async safeMarkAsRead(client: ImapFlow, uid: number): Promise<void> {
    try {
      // uid를 배열로 전달
      await client.messageFlagsAdd([uid], ['\\Seen'], { uid: true })
      logger.info('[MailMonitor] 읽음 처리 성공', { uid })
    } catch (error) {
      logger.error('[MailMonitor] 읽음 처리 실패 - 재시도', { uid, error })

      // 다른 방법으로 재시도
      try {
        await client.store(`${uid}`, '+FLAGS', ['\\Seen'], { uid: true })
        logger.info('[MailMonitor] 읽음 처리 성공 (재시도)', { uid })
      } catch (retryError) {
        logger.error('[MailMonitor] 읽음 처리 완전 실패', { uid, error: retryError })
      }
    }
  }

  /**
   * 테넌트의 등록된 업체 및 담당자 이메일 목록 조회 (캐싱)
   */
  private async getRegisteredCompanyEmails(tenantId: string): Promise<string[]> {
    const CACHE_TTL = 5 * 60 * 1000 // 5분

    // 캐시 확인
    const cached = this.companyEmailsCache.get(tenantId)
    if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL) {
      logger.debug('[MailMonitor] 캐시된 업체 이메일 사용', {
        tenantId,
        count: cached.emails.length,
      })
      return cached.emails
    }

    // 1. 업체 이메일 가져오기
    const companies = await prisma.company.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        email: true,
      },
    })

    const companyEmails = companies.map((c) => c.email).filter((email): email is string => !!email)

    // 2. 담당자 이메일 가져오기
    const contacts = await prisma.contact.findMany({
      where: {
        company: {
          tenantId,
          isActive: true,
        },
        isActive: true,
      },
      select: {
        email: true,
      },
    })

    const contactEmails = contacts.map((c) => c.email).filter((email): email is string => !!email)

    // 3. 중복 제거하여 합치기
    const allEmails = Array.from(new Set([...companyEmails, ...contactEmails]))

    // 캐시 업데이트
    this.companyEmailsCache.set(tenantId, {
      emails: allEmails,
      updatedAt: new Date(),
    })

    logger.info('[MailMonitor] 등록된 업체 및 담당자 이메일 로드 완료', {
      tenantId,
      companyEmails: companyEmails.length,
      contactEmails: contactEmails.length,
      totalUnique: allEmails.length,
    })

    return allEmails
  }

  /**
   * 이메일 정보로 업체 찾기
   */
  private async findCompanyByEmail(
    tenantId: string,
    parsedData: {
      companyName?: string
      senderEmail?: string
      senderDomain?: string
    }
  ) {
    // 1순위: 이메일 주소로 찾기
    if (parsedData.senderEmail) {
      const company = await prisma.company.findFirst({
        where: {
          tenantId,
          email: parsedData.senderEmail,
          isActive: true,
        },
      })
      if (company) return company
    }

    // 도메인 매칭 제거 - 이메일 전체 주소가 정확히 일치해야만 매칭
    // (같은 도메인의 다른 이메일이 잘못 매칭되는 문제 방지)

    return null
  }

  /**
   * 테넌트의 메일 설정 조회 (autoMarkAsRead 포함)
   */
  private async getMailConfig(tenantId: string): Promise<{
    autoMarkAsRead: boolean
  }> {
    const config = await prisma.systemConfig.findFirst({
      where: {
        tenantId,
        key: 'mailServer.autoMarkAsRead',
      },
    })

    const autoMarkAsRead = config ? JSON.parse(config.value) : true

    logger.info('[MailMonitor] autoMarkAsRead 설정 조회', {
      tenantId,
      configFound: !!config,
      configValue: config?.value,
      parsedValue: autoMarkAsRead,
    })

    return {
      autoMarkAsRead, // 기본값 true (처리된 메일 자동 읽음 처리)
    }
  }

  /**
   * 활성화된 테넌트의 메일 설정 조회 (플랜 및 mailMode 포함)
   */
  private async getActiveTenantConfigs(): Promise<TenantMailConfig[]> {
    // SystemConfig에서 메일 설정 조회
    const mailConfigs = await prisma.systemConfig.findMany({
      where: {
        key: {
          startsWith: 'mailServer.',
        },
      },
    })

    // 테넌트별로 그룹화
    const tenantConfigMap = new Map<string, Record<string, any>>()

    for (const config of mailConfigs) {
      if (!tenantConfigMap.has(config.tenantId)) {
        tenantConfigMap.set(config.tenantId, {})
      }

      const [, field] = config.key.split('.')
      const tenantConfig = tenantConfigMap.get(config.tenantId)!

      try {
        tenantConfig[field] = JSON.parse(config.value)
      } catch {
        tenantConfig[field] = config.value
      }
    }

    // 활성화되고 필수 설정이 모두 있는 테넌트만 반환
    const activeConfigs: TenantMailConfig[] = []

    // 활성 테넌트 ID 목록
    const activeTenantIds = Array.from(tenantConfigMap.entries())
      .filter(([, config]) => config.enabled === true && config.host && config.port && config.username && config.password)
      .map(([tenantId]) => tenantId)

    // 테넌트 플랜, mailMode, 키워드 설정 일괄 조회
    const tenants = await prisma.tenant.findMany({
      where: {
        id: { in: activeTenantIds },
      },
      select: {
        id: true,
        subscriptionPlan: true,
        mailMode: true,
        orderKeywords: true,
        keywordsDisabled: true,
      },
    })

    const tenantInfoMap = new Map(tenants.map((t) => [t.id, t]))

    for (const [tenantId, config] of tenantConfigMap.entries()) {
      if (
        config.enabled === true &&
        config.host &&
        config.port &&
        config.username &&
        config.password
      ) {
        const tenantInfo = tenantInfoMap.get(tenantId)
        const plan = (tenantInfo?.subscriptionPlan || 'FREE') as SubscriptionPlan
        const mailMode = (tenantInfo?.mailMode || 'ORDER_ONLY') as 'ORDER_ONLY' | 'FULL_INBOX'

        // 플랜 제한 적용: 플랜이 전체 메일함을 지원하지 않으면 강제로 ORDER_ONLY
        const effectiveMailMode = canAccessFullMailbox(plan) ? mailMode : 'ORDER_ONLY'

        // 키워드 설정
        const orderKeywords = tenantInfo?.orderKeywords || ['발주', '주문', '구매', '납품', 'order', 'purchase', 'po']
        const keywordsDisabled = tenantInfo?.keywordsDisabled || false

        activeConfigs.push({
          tenantId,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          useSSL: config.useSSL ?? true,
          enabled: config.enabled,
          subscriptionPlan: plan,
          mailMode,
          effectiveMailMode,
          orderKeywords,
          keywordsDisabled,
        })

        logger.info('[MailMonitor] 테넌트 설정 로드', {
          tenantId,
          plan,
          mailMode,
          effectiveMailMode,
          keywordsDisabled,
          keywordCount: orderKeywords.length,
        })
      }
    }

    return activeConfigs
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheckTimes: Object.fromEntries(this.lastCheckTimes),
    }
  }

  /**
   * 스팸 메일 여부 확인 (헤더 기반)
   * - X-Spam-Flag: YES
   * - X-Spam-Status: Yes, ...
   * - X-Daum-Spam: YES (다음 메일 전용)
   */
  private checkIfSpam(headers: Buffer | Map<string, string[]> | undefined): boolean {
    if (!headers) return false

    let headerText = ''

    // Buffer인 경우 문자열로 변환
    if (Buffer.isBuffer(headers)) {
      headerText = headers.toString('utf-8').toLowerCase()
    } else if (headers instanceof Map) {
      // Map인 경우 문자열로 변환
      for (const [key, values] of headers) {
        headerText += `${key}: ${values.join(', ')}\n`
      }
      headerText = headerText.toLowerCase()
    }

    // X-Spam-Flag: YES 확인
    if (/x-spam-flag:\s*yes/i.test(headerText)) {
      return true
    }

    // X-Spam-Status: Yes 확인 (SpamAssassin 등)
    if (/x-spam-status:\s*yes/i.test(headerText)) {
      return true
    }

    // X-Daum-Spam 확인 (다음 메일 전용)
    if (/x-daum-spam:\s*(yes|true|1)/i.test(headerText)) {
      return true
    }

    // X-Naver-Spam 확인 (네이버 메일)
    if (/x-naver-spam:\s*(yes|true|1)/i.test(headerText)) {
      return true
    }

    return false
  }

  /**
   * mailparser를 사용하여 이메일 파싱 (본문 + 첨부파일)
   */
  private async parseEmailWithMailparser(emailSource: Buffer | undefined): Promise<ParsedEmailContent> {
    const result: ParsedEmailContent = {
      textBody: null,
      htmlBody: null,
      attachments: [],
      fromName: null,
      fromAddress: null,
    }

    if (!emailSource) {
      logger.warn('[MailMonitor] 이메일 소스가 없습니다')
      return result
    }

    try {
      const parsed: ParsedMail = await simpleParser(emailSource)

      // 발신자 정보 추출 (mailparser가 MIME 인코딩 자동 디코딩)
      if (parsed.from && parsed.from.value && parsed.from.value.length > 0) {
        const fromInfo = parsed.from.value[0]
        result.fromName = fromInfo.name || null
        result.fromAddress = fromInfo.address || null

        logger.info('[MailMonitor] mailparser 발신자 정보', {
          'from.name': fromInfo.name,
          'from.address': fromInfo.address,
        })
      }

      // Plain text 본문
      if (parsed.text) {
        result.textBody = parsed.text
      }

      // HTML 본문
      if (parsed.html) {
        result.htmlBody = parsed.html as string
      }

      // 첨부파일 추출
      if (parsed.attachments && parsed.attachments.length > 0) {
        result.attachments = parsed.attachments.map((att: Attachment) => ({
          filename: att.filename || 'unknown',
          contentType: att.contentType || 'application/octet-stream',
          size: att.size || 0,
          content: att.content,
        }))

        logger.info('[MailMonitor] 첨부파일 감지', {
          count: result.attachments.length,
          files: result.attachments.map((a) => ({ name: a.filename, size: a.size })),
        })
      }

      logger.info('[MailMonitor] 이메일 파싱 완료', {
        hasTextBody: !!result.textBody,
        textBodyLength: result.textBody?.length || 0,
        hasHtmlBody: !!result.htmlBody,
        htmlBodyLength: result.htmlBody?.length || 0,
        attachmentCount: result.attachments.length,
        fromName: result.fromName,
      })

      return result
    } catch (error) {
      logger.error('[MailMonitor] mailparser 파싱 실패:', error)
      return result
    }
  }

  /**
   * 메일 본문의 해시 생성 (앞 500자 기준)
   * Message-ID가 없을 때 fallback ID 생성에 사용
   */
  private generateBodyHash(emailBody: string): string {
    const crypto = require('crypto')
    // 본문 앞 500자만 사용 (성능 및 일관성)
    const contentToHash = emailBody.substring(0, 500)
    return crypto.createHash('md5').update(contentToHash).digest('hex').substring(0, 12)
  }

  /**
   * UID가 이미 처리되었는지 확인 (캐시 기반)
   * 오늘 날짜가 바뀌면 캐시 리셋
   */
  private isUidProcessed(tenantId: string, uid: number): boolean {
    const today = formatKSTDate(new Date())
    const cache = this.processedUidsCache.get(tenantId)

    // 날짜가 다르면 캐시 리셋
    if (!cache || cache.date !== today) {
      return false
    }

    return cache.uids.has(uid)
  }

  /**
   * 처리 완료된 UID를 캐시에 추가
   */
  private markUidAsProcessed(tenantId: string, uid: number): void {
    const today = formatKSTDate(new Date())
    let cache = this.processedUidsCache.get(tenantId)

    // 날짜가 다르면 새 캐시 생성
    if (!cache || cache.date !== today) {
      cache = { uids: new Set(), date: today }
      this.processedUidsCache.set(tenantId, cache)
    }

    cache.uids.add(uid)
  }
}

// 싱글톤 인스턴스
export const mailMonitorService = new MailMonitorService()
