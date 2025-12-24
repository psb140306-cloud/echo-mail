import { ImapFlow } from 'imapflow'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createImapClient } from '@/lib/imap/connection'

/**
 * IMAP 동기화 서비스
 * - DB에 저장된 메일이 IMAP에서 삭제/이동되었는지 확인
 * - 스팸함으로 이동된 메일 감지
 */

interface SyncResult {
  checked: number
  deleted: number
  movedToSpam: number
  errors: string[]
}

export class ImapSyncService {
  /**
   * 특정 테넌트의 메일 동기화
   * - 최근 N일 내 메일만 확인 (성능 최적화)
   */
  async syncTenantMails(
    tenantId: string,
    config: {
      host: string
      port: number
      username: string
      password: string
      useSSL: boolean
    },
    daysToCheck: number = 7
  ): Promise<SyncResult> {
    const result: SyncResult = {
      checked: 0,
      deleted: 0,
      movedToSpam: 0,
      errors: [],
    }

    let client: ImapFlow | null = null

    try {
      // IMAP 연결
      client = createImapClient(config)
      await client.connect()

      // DB에서 최근 N일 메일 조회 (IMAP UID가 있는 것만)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToCheck)

      const dbMails = await prisma.emailLog.findMany({
        where: {
          tenantId,
          receivedAt: { gte: cutoffDate },
          imapUid: { not: null },
          status: { not: 'IGNORED' }, // 이미 무시된 메일 제외
        },
        select: {
          id: true,
          imapUid: true,
          sender: true,
          subject: true,
          folder: true,
        },
      })

      result.checked = dbMails.length
      logger.info(`[ImapSync] 동기화 시작 - ${dbMails.length}개 메일 확인`, {
        tenantId,
        daysToCheck,
      })

      // INBOX 확인
      const lock = await client.getMailboxLock('INBOX')
      try {
        const inboxUids = await this.getMailboxUids(client)

        // DB에는 있지만 INBOX에 없는 메일 찾기
        const missingMails = dbMails.filter(
          (mail) => mail.imapUid && !inboxUids.has(mail.imapUid)
        )

        logger.info(`[ImapSync] INBOX에서 누락된 메일 ${missingMails.length}개 발견`)

        // 스팸함 확인 (폴더 존재 여부 체크)
        let spamUids = new Set<number>()
        try {
          await lock.release()
          const spamLock = await client.getMailboxLock('Spam') // 또는 'Junk', '[Gmail]/Spam'
          try {
            spamUids = await this.getMailboxUids(client)
            logger.info(`[ImapSync] 스팸함 UID ${spamUids.size}개 확인`)
          } finally {
            spamLock.release()
          }

          // 다시 INBOX lock (후속 작업용)
          const inboxLock = await client.getMailboxLock('INBOX')
          try {
            // 누락된 메일 처리
            for (const mail of missingMails) {
              if (!mail.imapUid) continue

              // 스팸함으로 이동되었는지 확인
              if (spamUids.has(mail.imapUid)) {
                // 스팸함으로 이동됨 - 상태 업데이트
                await prisma.emailLog.update({
                  where: { id: mail.id },
                  data: {
                    status: 'IGNORED',
                    folder: 'Spam',
                    errorMessage: '스팸 메일로 분류됨 (IMAP 동기화)',
                  },
                })
                result.movedToSpam++

                logger.info(`[ImapSync] 스팸함 이동 감지`, {
                  mailId: mail.id,
                  uid: mail.imapUid,
                  subject: mail.subject.substring(0, 50),
                })
              } else {
                // 완전히 삭제됨 - 상태 업데이트
                await prisma.emailLog.update({
                  where: { id: mail.id },
                  data: {
                    status: 'IGNORED',
                    errorMessage: 'IMAP에서 삭제됨 (동기화)',
                  },
                })
                result.deleted++

                logger.info(`[ImapSync] 삭제된 메일 감지`, {
                  mailId: mail.id,
                  uid: mail.imapUid,
                  subject: mail.subject.substring(0, 50),
                })
              }
            }
          } finally {
            inboxLock.release()
          }
        } catch (spamError) {
          // 스팸함이 없거나 접근 불가 - 모두 삭제로 간주
          logger.warn('[ImapSync] 스팸함 접근 실패, 모두 삭제로 처리', spamError)

          for (const mail of missingMails) {
            await prisma.emailLog.update({
              where: { id: mail.id },
              data: {
                status: 'IGNORED',
                errorMessage: 'IMAP에서 삭제됨 (동기화)',
              },
            })
            result.deleted++
          }
        }
      } finally {
        if (lock) {
          try {
            await lock.release()
          } catch (e) {
            // lock이 이미 해제되었을 수 있음
          }
        }
      }

      logger.info('[ImapSync] 동기화 완료', {
        tenantId,
        ...result,
      })

      return result
    } catch (error) {
      logger.error('[ImapSync] 동기화 실패', { tenantId, error })
      result.errors.push(error instanceof Error ? error.message : '알 수 없는 오류')
      return result
    } finally {
      if (client) {
        try {
          await client.logout()
        } catch (e) {
          // 무시
        }
      }
    }
  }

  /**
   * 현재 메일함의 모든 UID 가져오기
   */
  private async getMailboxUids(client: ImapFlow): Promise<Set<number>> {
    const uids = new Set<number>()

    try {
      // 전체 메일의 UID 조회
      const searchResult = await client.search({ all: true }, { uid: true })
      const searchedUids = Array.isArray(searchResult) ? searchResult : []

      for (const uid of searchedUids) {
        if (typeof uid === 'number') {
          uids.add(uid)
        }
      }

      logger.debug(`[ImapSync] 메일함 UID ${uids.size}개 조회`)
    } catch (error) {
      logger.error('[ImapSync] UID 조회 실패', error)
    }

    return uids
  }
}

// 싱글톤 인스턴스
export const imapSyncService = new ImapSyncService()
