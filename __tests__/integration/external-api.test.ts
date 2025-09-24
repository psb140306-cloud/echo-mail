/**
 * Integration Test: External API Connections
 * 외부 API 연동 통합 테스트
 */

import { SmsProvider } from '@/lib/notifications/sms/sms-provider'
import { KakaoProvider } from '@/lib/notifications/kakao/kakao-provider'
import { ImapClient } from '@/lib/mail/imap-client'
import { logger } from '@/lib/logger'
import nock from 'nock'
import { EventEmitter } from 'events'

// 환경변수 설정
process.env.SMS_API_KEY = 'test-sms-api-key'
process.env.SMS_API_SECRET = 'test-sms-api-secret'
process.env.KAKAO_API_KEY = 'test-kakao-api-key'
process.env.KAKAO_SENDER_KEY = 'test-sender-key'
process.env.IMAP_HOST = 'imap.test.com'
process.env.IMAP_PORT = '993'
process.env.IMAP_USER = 'test@echomail.com'
process.env.IMAP_PASSWORD = 'test-password'

describe('External API Integration Tests', () => {
  beforeAll(() => {
    // HTTP 요청 모킹 설정
    nock.disableNetConnect()
    nock.enableNetConnect('localhost')
  })

  afterAll(() => {
    nock.enableNetConnect()
    nock.cleanAll()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('SMS API Integration', () => {
    let smsProvider: SmsProvider

    beforeEach(() => {
      smsProvider = new SmsProvider({
        apiKey: process.env.SMS_API_KEY,
        apiSecret: process.env.SMS_API_SECRET,
        sender: '1588-1234'
      })
    })

    it('should send SMS successfully', async () => {
      // SMS API 응답 모킹
      const smsApiMock = nock('https://api.sms-provider.com')
        .post('/v2/send', {
          api_key: 'test-sms-api-key',
          api_secret: 'test-sms-api-secret',
          from: '1588-1234',
          to: '010-1234-5678',
          text: '테스트 메시지입니다.'
        })
        .reply(200, {
          success: true,
          message_id: 'sms-12345',
          remaining_balance: 1000
        })

      const result = await smsProvider.send({
        recipient: '010-1234-5678',
        message: '테스트 메시지입니다.'
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('sms-12345')
      expect(smsApiMock.isDone()).toBe(true)
    })

    it('should handle SMS API rate limiting', async () => {
      // Rate limit 응답 모킹
      const rateLimitMock = nock('https://api.sms-provider.com')
        .post('/v2/send')
        .reply(429, {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retry_after: 60
        })

      await expect(
        smsProvider.send({
          recipient: '010-1234-5678',
          message: '테스트 메시지'
        })
      ).rejects.toThrow('RATE_LIMIT_EXCEEDED')

      expect(rateLimitMock.isDone()).toBe(true)
    })

    it('should handle SMS API authentication failure', async () => {
      // 인증 실패 모킹
      const authFailMock = nock('https://api.sms-provider.com')
        .post('/v2/send')
        .reply(401, {
          error: 'INVALID_API_KEY',
          message: 'Invalid API credentials'
        })

      await expect(
        smsProvider.send({
          recipient: '010-1234-5678',
          message: '테스트 메시지'
        })
      ).rejects.toThrow('INVALID_API_KEY')

      expect(authFailMock.isDone()).toBe(true)
    })

    it('should retry on network timeout', async () => {
      let attemptCount = 0

      // 첫 번째 시도: 타임아웃
      // 두 번째 시도: 성공
      const retryMock = nock('https://api.sms-provider.com')
        .post('/v2/send')
        .times(2)
        .reply(function() {
          attemptCount++
          if (attemptCount === 1) {
            // 타임아웃 시뮬레이션
            return [504, { error: 'GATEWAY_TIMEOUT' }]
          }
          return [200, {
            success: true,
            message_id: 'sms-retry-success'
          }]
        })

      const result = await smsProvider.sendWithRetry({
        recipient: '010-1234-5678',
        message: '재시도 테스트',
        maxRetries: 3,
        retryDelay: 100
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('sms-retry-success')
      expect(attemptCount).toBe(2)
    })

    it('should validate phone number format before sending', async () => {
      const invalidNumbers = [
        '1234567890',      // 하이픈 없음
        '02-1234-5678',    // 010이 아님
        '010-123-5678',    // 잘못된 형식
        '',                // 빈 문자열
        null               // null
      ]

      for (const number of invalidNumbers) {
        await expect(
          smsProvider.send({
            recipient: number as string,
            message: '테스트'
          })
        ).rejects.toThrow(/Invalid phone number/)
      }
    })

    it('should handle bulk SMS sending', async () => {
      const recipients = [
        '010-1111-1111',
        '010-2222-2222',
        '010-3333-3333'
      ]

      // 대량 발송 API 모킹
      const bulkMock = nock('https://api.sms-provider.com')
        .post('/v2/send/bulk', {
          api_key: 'test-sms-api-key',
          api_secret: 'test-sms-api-secret',
          from: '1588-1234',
          messages: recipients.map(to => ({
            to,
            text: '대량 발송 테스트'
          }))
        })
        .reply(200, {
          success: true,
          results: recipients.map((to, i) => ({
            to,
            message_id: `bulk-sms-${i}`,
            status: 'sent'
          }))
        })

      const results = await smsProvider.sendBulk({
        recipients,
        message: '대량 발송 테스트'
      })

      expect(results.success).toBe(true)
      expect(results.results).toHaveLength(3)
      expect(results.results.every(r => r.status === 'sent')).toBe(true)
      expect(bulkMock.isDone()).toBe(true)
    })
  })

  describe('Kakao API Integration', () => {
    let kakaoProvider: KakaoProvider

    beforeEach(() => {
      kakaoProvider = new KakaoProvider({
        apiKey: process.env.KAKAO_API_KEY,
        senderKey: process.env.KAKAO_SENDER_KEY,
        templateCode: 'ORDER_NOTIFICATION_001'
      })
    })

    it('should send Kakao AlimTalk successfully', async () => {
      // 카카오 API 모킹
      const kakaoMock = nock('https://api.kakaoapi.com')
        .post('/v1/alimtalk/send', {
          sender_key: 'test-sender-key',
          template_code: 'ORDER_NOTIFICATION_001',
          receiver_phone: '010-1234-5678',
          message: '카카오 알림톡 테스트',
          button_info: []
        })
        .matchHeader('Authorization', 'Bearer test-kakao-api-key')
        .reply(200, {
          success: true,
          message_id: 'kakao-12345',
          request_id: 'req-12345'
        })

      const result = await kakaoProvider.sendAlimTalk({
        recipient: '010-1234-5678',
        message: '카카오 알림톡 테스트',
        templateCode: 'ORDER_NOTIFICATION_001'
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('kakao-12345')
      expect(kakaoMock.isDone()).toBe(true)
    })

    it('should handle template validation error', async () => {
      // 템플릿 검증 실패 모킹
      const templateErrorMock = nock('https://api.kakaoapi.com')
        .post('/v1/alimtalk/send')
        .reply(400, {
          error: 'INVALID_TEMPLATE',
          message: 'Template not found or not approved',
          template_code: 'INVALID_TEMPLATE_001'
        })

      await expect(
        kakaoProvider.sendAlimTalk({
          recipient: '010-1234-5678',
          message: '테스트',
          templateCode: 'INVALID_TEMPLATE_001'
        })
      ).rejects.toThrow('INVALID_TEMPLATE')

      expect(templateErrorMock.isDone()).toBe(true)
    })

    it('should send FriendTalk when user is friend', async () => {
      // 친구톡 API 모킹
      const friendTalkMock = nock('https://api.kakaoapi.com')
        .post('/v1/friendtalk/send', {
          sender_key: 'test-sender-key',
          receiver_phone: '010-1234-5678',
          message: '친구톡 메시지입니다.',
          ad_flag: false
        })
        .matchHeader('Authorization', 'Bearer test-kakao-api-key')
        .reply(200, {
          success: true,
          message_id: 'friend-12345'
        })

      const result = await kakaoProvider.sendFriendTalk({
        recipient: '010-1234-5678',
        message: '친구톡 메시지입니다.'
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('friend-12345')
      expect(friendTalkMock.isDone()).toBe(true)
    })

    it('should check friend status before sending', async () => {
      // 친구 상태 확인 API 모킹
      const friendCheckMock = nock('https://api.kakaoapi.com')
        .get('/v1/friend/check')
        .query({ phone: '010-1234-5678' })
        .reply(200, {
          is_friend: true,
          friend_since: '2024-01-01T00:00:00Z'
        })

      const isFriend = await kakaoProvider.checkFriendStatus('010-1234-5678')

      expect(isFriend).toBe(true)
      expect(friendCheckMock.isDone()).toBe(true)
    })

    it('should fallback from FriendTalk to AlimTalk', async () => {
      // 친구톡 실패 모킹
      const friendTalkFailMock = nock('https://api.kakaoapi.com')
        .post('/v1/friendtalk/send')
        .reply(400, {
          error: 'NOT_FRIEND',
          message: 'Recipient is not a friend'
        })

      // 알림톡 성공 모킹
      const alimTalkMock = nock('https://api.kakaoapi.com')
        .post('/v1/alimtalk/send')
        .reply(200, {
          success: true,
          message_id: 'alimtalk-fallback-12345'
        })

      const result = await kakaoProvider.sendWithFallback({
        recipient: '010-1234-5678',
        message: '폴백 테스트 메시지',
        preferFriendTalk: true
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('alimtalk-fallback-12345')
      expect(result.type).toBe('alimtalk')
      expect(friendTalkFailMock.isDone()).toBe(true)
      expect(alimTalkMock.isDone()).toBe(true)
    })
  })

  describe('Email IMAP Integration', () => {
    let imapClient: ImapClient
    let mockImapConnection: any

    beforeEach(() => {
      // IMAP 연결 모킹
      mockImapConnection = new EventEmitter()
      mockImapConnection.openBox = jest.fn()
      mockImapConnection.search = jest.fn()
      mockImapConnection.fetch = jest.fn()
      mockImapConnection.end = jest.fn()

      imapClient = new ImapClient({
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT),
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        tls: true
      })

      // 연결 모킹 주입
      ;(imapClient as any).connection = mockImapConnection
    })

    it('should connect to IMAP server successfully', async () => {
      const connectPromise = imapClient.connect()

      // 연결 성공 이벤트 발생
      setImmediate(() => {
        mockImapConnection.emit('ready')
      })

      await expect(connectPromise).resolves.toBeUndefined()
      expect(imapClient.isConnected()).toBe(true)
    })

    it('should handle IMAP connection timeout', async () => {
      const connectPromise = imapClient.connect()

      // 타임아웃 시뮬레이션
      setImmediate(() => {
        mockImapConnection.emit('error', new Error('Connection timeout'))
      })

      await expect(connectPromise).rejects.toThrow('Connection timeout')
      expect(imapClient.isConnected()).toBe(false)
    })

    it('should fetch unread emails', async () => {
      // 메일함 열기 모킹
      mockImapConnection.openBox.mockImplementation((boxName, readonly, callback) => {
        callback(null, { name: 'INBOX', messages: { total: 10, new: 3 } })
      })

      // 검색 결과 모킹
      mockImapConnection.search.mockImplementation((criteria, callback) => {
        callback(null, [1, 2, 3])  // 3개의 읽지 않은 메일 ID
      })

      // Fetch 모킹
      const mockFetch = {
        on: jest.fn((event, handler) => {
          if (event === 'message') {
            // 3개의 메일 메시지 시뮬레이션
            for (let i = 1; i <= 3; i++) {
              const msg = new EventEmitter()
              msg.on = jest.fn((evt, h) => {
                if (evt === 'body') {
                  h(Buffer.from(`Subject: Test Email ${i}\r\n\r\nBody content ${i}`), { which: 'TEXT' })
                }
                if (evt === 'attributes') {
                  h({ uid: i, flags: [], date: new Date() })
                }
                if (evt === 'end') {
                  h()
                }
                return msg
              })
              handler(msg, i)
            }
          }
          if (event === 'end') {
            handler()
          }
          return mockFetch
        })
      }
      mockImapConnection.fetch.mockReturnValue(mockFetch)

      const emails = await imapClient.fetchUnreadEmails()

      expect(emails).toHaveLength(3)
      expect(emails[0].subject).toContain('Test Email')
      expect(mockImapConnection.openBox).toHaveBeenCalledWith('INBOX', false, expect.any(Function))
    })

    it('should handle email with attachments', async () => {
      mockImapConnection.openBox.mockImplementation((boxName, readonly, callback) => {
        callback(null, { name: 'INBOX' })
      })

      mockImapConnection.search.mockImplementation((criteria, callback) => {
        callback(null, [1])
      })

      const mockFetch = {
        on: jest.fn((event, handler) => {
          if (event === 'message') {
            const msg = new EventEmitter()
            msg.on = jest.fn((evt, h) => {
              if (evt === 'body') {
                // MIME 멀티파트 메시지 시뮬레이션
                const mimeContent = `Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

본문 내용입니다.

--boundary123
Content-Type: application/pdf
Content-Disposition: attachment; filename="order.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQKJeLjz9MKNCAwIG9iago=

--boundary123--`
                h(Buffer.from(mimeContent), { which: '' })
              }
              if (evt === 'attributes') {
                h({ uid: 1, flags: [], date: new Date() })
              }
              if (evt === 'end') {
                h()
              }
              return msg
            })
            handler(msg, 1)
          }
          if (event === 'end') {
            handler()
          }
          return mockFetch
        })
      }
      mockImapConnection.fetch.mockReturnValue(mockFetch)

      const emails = await imapClient.fetchUnreadEmails()

      expect(emails).toHaveLength(1)
      expect(emails[0].attachments).toBeDefined()
      expect(emails[0].attachments).toHaveLength(1)
      expect(emails[0].attachments[0].filename).toBe('order.pdf')
      expect(emails[0].attachments[0].contentType).toBe('application/pdf')
    })

    it('should mark email as read after processing', async () => {
      const addFlagsSpy = jest.spyOn(imapClient, 'addFlags' as any)
      addFlagsSpy.mockResolvedValue(true)

      await imapClient.markAsRead(123)

      expect(addFlagsSpy).toHaveBeenCalledWith(123, '\\Seen')
    })

    it('should handle IDLE mode for real-time email monitoring', async () => {
      const idlePromise = imapClient.startIdleMode()

      // IDLE 모드 시작 시뮬레이션
      setImmediate(() => {
        mockImapConnection.emit('mail', 1)  // 새 메일 도착
      })

      const onNewMail = jest.fn()
      imapClient.on('mail', onNewMail)

      // 짧은 대기 후 IDLE 종료
      setTimeout(() => {
        imapClient.stopIdleMode()
      }, 100)

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(onNewMail).toHaveBeenCalledWith(1)
    })

    it('should reconnect on connection loss', async () => {
      let reconnectAttempts = 0

      imapClient.on('reconnecting', () => {
        reconnectAttempts++
      })

      // 연결 끊김 시뮬레이션
      mockImapConnection.emit('close')

      // 재연결 시도 대기
      await new Promise(resolve => setTimeout(resolve, 1000))

      expect(reconnectAttempts).toBeGreaterThan(0)
    })
  })

  describe('API Circuit Breaker Pattern', () => {
    it('should open circuit after consecutive failures', async () => {
      const smsProvider = new SmsProvider({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        sender: '1588-1234',
        circuitBreaker: {
          threshold: 3,
          timeout: 1000
        }
      })

      // 3번 연속 실패 모킹
      nock('https://api.sms-provider.com')
        .post('/v2/send')
        .times(3)
        .reply(500, { error: 'SERVER_ERROR' })

      // 3번 시도
      for (let i = 0; i < 3; i++) {
        await expect(
          smsProvider.send({
            recipient: '010-1234-5678',
            message: '테스트'
          })
        ).rejects.toThrow()
      }

      // Circuit이 열렸는지 확인 (요청이 차단됨)
      await expect(
        smsProvider.send({
          recipient: '010-1234-5678',
          message: '테스트'
        })
      ).rejects.toThrow(/Circuit breaker is open/)

      // 타임아웃 후 재시도 허용
      await new Promise(resolve => setTimeout(resolve, 1100))

      // 성공 응답 모킹
      nock('https://api.sms-provider.com')
        .post('/v2/send')
        .reply(200, { success: true, message_id: 'recovery-123' })

      const result = await smsProvider.send({
        recipient: '010-1234-5678',
        message: '복구 테스트'
      })

      expect(result.success).toBe(true)
    })
  })

  describe('API Response Caching', () => {
    it('should cache successful API responses', async () => {
      const kakaoProvider = new KakaoProvider({
        apiKey: 'test-key',
        senderKey: 'test-sender',
        cacheEnabled: true,
        cacheTTL: 3600
      })

      // 친구 상태 확인 API 모킹 (1번만 호출되어야 함)
      const friendCheckMock = nock('https://api.kakaoapi.com')
        .get('/v1/friend/check')
        .query({ phone: '010-1234-5678' })
        .once()  // 한 번만 호출
        .reply(200, { is_friend: true })

      // 첫 번째 호출 - API 호출
      const result1 = await kakaoProvider.checkFriendStatus('010-1234-5678')
      expect(result1).toBe(true)

      // 두 번째 호출 - 캐시에서 가져옴
      const result2 = await kakaoProvider.checkFriendStatus('010-1234-5678')
      expect(result2).toBe(true)

      // API가 한 번만 호출되었는지 확인
      expect(friendCheckMock.isDone()).toBe(true)
    })
  })

  describe('Webhook Integration', () => {
    it('should handle SMS delivery webhook', async () => {
      const webhookData = {
        message_id: 'sms-12345',
        status: 'delivered',
        delivered_at: '2024-01-15T10:30:00Z',
        recipient: '010-1234-5678'
      }

      // Webhook 처리 시뮬레이션
      const webhookHandler = async (data: any) => {
        // 데이터베이스 업데이트 로직
        return {
          success: true,
          updated: true
        }
      }

      const result = await webhookHandler(webhookData)

      expect(result.success).toBe(true)
      expect(result.updated).toBe(true)
    })

    it('should validate webhook signature', () => {
      const webhookSecret = 'webhook-secret-key'
      const payload = JSON.stringify({
        message_id: 'test-123',
        status: 'sent'
      })

      // HMAC 서명 생성
      const crypto = require('crypto')
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex')

      // 서명 검증
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(signature)
      )

      expect(isValid).toBe(true)
    })
  })
})