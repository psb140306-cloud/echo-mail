import { ImapFlow } from 'imapflow'
import { logger } from '@/lib/utils/logger'

export interface ImapConfig {
  host: string
  port: number
  username: string
  password: string
  useSSL: boolean
}

export interface MailboxInfo {
  exists: number
  messages: number
  path: string
}

export interface ImapTestResult {
  success: boolean
  mailbox?: MailboxInfo
  error?: string
}

/**
 * IMAP 서버 연결 테스트
 * @param config IMAP 서버 설정
 * @param timeoutMs 연결 타임아웃 (기본값: 10초)
 * @returns 테스트 결과
 */
export async function testImapConnection(
  config: ImapConfig,
  timeoutMs: number = 10000
): Promise<ImapTestResult> {
  const { host, port, username, password, useSSL } = config

  logger.info('IMAP 서버 연결 테스트 시작', {
    host,
    port,
    username,
    useSSL,
  })

  const client = new ImapFlow({
    host,
    port,
    secure: useSSL,
    auth: {
      user: username,
      pass: password,
    },
    logger: false,
    tls: {
      rejectUnauthorized: false, // 자체 서명 인증서 허용
    },
  })

  try {
    // 연결 시도 (타임아웃 적용)
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('연결 타임아웃')), timeoutMs)
      ),
    ])

    const mailboxName = 'INBOX'
    const lock = await client.getMailboxLock(mailboxName)
    let mailboxInfo: MailboxInfo

    try {
      // STATUS 명령으로 기본 정보 확인
      const status = await client.status(mailboxName, {
        messages: true,
        unseen: true,
      })

      console.log(
        '[IMAP] STATUS 명령 결과:',
        JSON.stringify(
          {
            messages: String(status?.messages ?? 0),
            unseen: String(status?.unseen ?? 0),
          },
          null,
          2
        )
      )

      let totalMessages = Number(status?.messages ?? 0)

      // 일부 IMAP 서버(네이버 등)는 STATUS 응답을 1,000개로 제한하므로 SEARCH ALL로 실제 개수 확인
      try {
        const searchResult = await client.search({ all: true })
        if (Array.isArray(searchResult)) {
          totalMessages = searchResult.length
          console.log('[IMAP] SEARCH ALL 결과:', totalMessages)
        }
      } catch (searchError: any) {
        logger.warn('IMAP SEARCH ALL 실행 실패, STATUS 결과 사용', {
          host,
          username,
          error: searchError?.message,
        })
      }

      mailboxInfo = {
        exists: totalMessages,
        messages: Number(status?.unseen ?? 0),
        path: client.mailbox?.path || mailboxName,
      }

      console.log('[IMAP] mailbox 최종 값:', JSON.stringify(mailboxInfo, null, 2))
    } finally {
      lock.release()
    }

    logger.info('IMAP 서버 연결 성공', {
      host,
      username,
      mailboxInfo,
    })

    return {
      success: true,
      mailbox: mailboxInfo,
    }
  } catch (err: any) {
    const errorMessage = err.message || '알 수 없는 오류'
    logger.error('IMAP 서버 연결 실패', {
      host,
      username,
      error: errorMessage,
    })

    return {
      success: false,
      error: errorMessage,
    }
  } finally {
    // 연결 종료
    try {
      await client.logout()
    } catch (err) {
      // 로그아웃 실패는 무시
      logger.debug('IMAP 로그아웃 실패 (무시됨)', err)
    }
  }
}

/**
 * IMAP 클라이언트 생성
 * @param config IMAP 서버 설정
 * @returns ImapFlow 클라이언트 인스턴스
 */
export function createImapClient(config: ImapConfig): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.useSSL,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
    tls: {
      rejectUnauthorized: false,
    },
  })
}
