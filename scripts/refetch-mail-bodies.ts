/**
 * 오염된 메일 본문 재수집 스크립트
 *
 * IMAP에서 Message-ID로 메일을 다시 찾아서 본문을 올바르게 업데이트합니다.
 *
 * 실행: npx tsx scripts/refetch-mail-bodies.ts
 */

import { PrismaClient } from '@prisma/client'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

const prisma = new PrismaClient()

interface MailConfig {
  tenantId: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  username: string
  password: string
}

async function refetchMailBodies() {
  console.log('=== 메일 본문 재수집 시작 ===\n')

  try {
    // 모든 테넌트의 메일 설정 조회
    const mailConfigs = await prisma.mailConfig.findMany({
      where: {
        imapHost: { not: null },
      },
      select: {
        tenantId: true,
        imapHost: true,
        imapPort: true,
        imapSecure: true,
        username: true,
        password: true,
      },
    })

    console.log(`${mailConfigs.length}개 테넌트 메일 설정 발견\n`)

    for (const config of mailConfigs) {
      if (!config.imapHost) continue

      console.log(`\n--- 테넌트 ${config.tenantId} 처리 중 ---`)

      // 해당 테넌트의 모든 메일 조회
      const emails = await prisma.emailLog.findMany({
        where: { tenantId: config.tenantId },
        select: {
          id: true,
          messageId: true,
          subject: true,
          sender: true,
        },
        orderBy: { receivedAt: 'desc' },
      })

      console.log(`${emails.length}개 메일 발견`)

      if (emails.length === 0) continue

      // IMAP 연결
      const client = new ImapFlow({
        host: config.imapHost,
        port: config.imapPort,
        secure: config.imapSecure,
        auth: {
          user: config.username,
          pass: config.password,
        },
        logger: false,
      })

      try {
        await client.connect()
        await client.mailboxOpen('INBOX')

        let updatedCount = 0
        let notFoundCount = 0
        let errorCount = 0

        for (const email of emails) {
          try {
            // Message-ID로 검색
            const cleanMessageId = email.messageId.replace(/^<|>$/g, '')
            const searchResult = await client.search({
              header: { 'message-id': cleanMessageId },
            })

            if (searchResult.length === 0) {
              notFoundCount++
              continue
            }

            // UID 모드로 fetch (중요!)
            const messages = client.fetch(searchResult[0], {
              envelope: true,
              source: true,
            }, { uid: true })

            for await (const msg of messages) {
              if (!msg.source) continue

              const parsed = await simpleParser(msg.source)

              // 제목 비교 (불일치 확인)
              const imapSubject = parsed.subject || ''
              const dbSubject = email.subject || ''

              if (imapSubject !== dbSubject) {
                console.log(`\n⚠️  불일치 발견!`)
                console.log(`   DB 제목: ${dbSubject}`)
                console.log(`   IMAP 제목: ${imapSubject}`)
              }

              // 본문 및 발신자 이름 업데이트
              const senderName = parsed.from?.value?.[0]?.name || null
              const body = parsed.text || null
              const bodyHtml = parsed.html || null

              await prisma.emailLog.update({
                where: { id: email.id },
                data: {
                  subject: imapSubject || dbSubject, // IMAP 제목으로 업데이트
                  senderName,
                  body,
                  bodyHtml,
                },
              })

              updatedCount++
              break
            }
          } catch (error) {
            errorCount++
            console.error(`메일 처리 오류 (${email.messageId}):`, error)
          }
        }

        console.log(`\n✅ 테넌트 ${config.tenantId} 완료`)
        console.log(`   업데이트: ${updatedCount}개`)
        console.log(`   IMAP에서 못 찾음: ${notFoundCount}개`)
        console.log(`   오류: ${errorCount}개`)

        await client.logout()
      } catch (error) {
        console.error(`IMAP 연결 오류 (${config.tenantId}):`, error)
      }
    }

    console.log('\n=== 메일 본문 재수집 완료 ===')
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

refetchMailBodies()
