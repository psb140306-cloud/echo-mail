import { emailQueue, EmailJob } from '@/lib/queue'
import { prisma } from '@/lib/db'
import { addSmsJob, addKakaoAlimtalkJob } from '@/lib/queue'
import { calculateDeliveryDate } from '@/lib/utils/delivery'

// 메일 처리
emailQueue.process('process-email', async (job) => {
  const data = job.data as EmailJob
  console.log(`[메일] 처리 시작: ${data.messageId}`)

  try {
    // 이미 처리된 메일인지 확인
    const existingLog = await prisma.emailLog.findUnique({
      where: { messageId: data.messageId },
    })

    if (existingLog) {
      console.log(`[메일] 이미 처리됨: ${data.messageId}`)
      return { skipped: true, reason: 'Already processed' }
    }

    // 메일 로그 생성
    const emailLog = await prisma.emailLog.create({
      data: {
        messageId: data.messageId,
        subject: data.subject,
        sender: data.sender,
        recipient: data.recipient,
        receivedAt: new Date(data.receivedAt),
        hasAttachment: data.hasAttachment,
        attachments: data.attachments || null,
        status: 'RECEIVED',
      },
    })

    // 업체 매칭
    const company = await prisma.company.findUnique({
      where: { email: data.sender },
      include: {
        contacts: {
          where: { isActive: true },
        },
      },
    })

    if (!company) {
      console.log(`[메일] 미등록 업체: ${data.sender}`)

      // 메일 상태 업데이트
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'IGNORED',
          processedAt: new Date(),
        },
      })

      // 관리자에게 알림
      await notifyAdmin(`미등록 업체로부터 메일 수신: ${data.sender}`)

      return { processed: true, matched: false }
    }

    // 메일 상태 업데이트 (업체 매칭됨)
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: 'MATCHED',
        companyId: company.id,
        processedAt: new Date(),
      },
    })

    // 납품 일정 계산
    const deliveryRule = await prisma.deliveryRule.findUnique({
      where: { region: company.region },
    })

    if (!deliveryRule) {
      console.error(`[메일] 납품 규칙 없음: ${company.region}`)
      return { processed: true, matched: true, error: 'No delivery rule' }
    }

    const deliveryDate = await calculateDeliveryDate(new Date(data.receivedAt), deliveryRule)

    // 메시지 템플릿 가져오기
    const smsTemplate = await prisma.messageTemplate.findFirst({
      where: {
        type: 'SMS',
        isDefault: true,
      },
    })

    const kakaoTemplate = await prisma.messageTemplate.findFirst({
      where: {
        type: 'KAKAO_ALIMTALK',
        isDefault: true,
      },
    })

    // 알림 발송
    for (const contact of company.contacts) {
      const templateData = {
        companyName: company.name,
        deliveryDate: deliveryDate.date,
        deliveryTime: deliveryDate.time,
      }

      // SMS 발송
      if (contact.smsEnabled && contact.phone) {
        const message = replacePlaceholders(smsTemplate?.content || '', templateData)

        await addSmsJob({
          recipient: contact.phone,
          message,
          companyId: company.id,
          emailLogId: emailLog.id,
        })
      }

      // 카카오톡 발송
      if (contact.kakaoEnabled && contact.phone) {
        const message = replacePlaceholders(kakaoTemplate?.content || '', templateData)

        await addKakaoAlimtalkJob({
          recipient: contact.phone,
          message,
          companyId: company.id,
          emailLogId: emailLog.id,
          templateData,
        })
      }
    }

    // 메일 상태 최종 업데이트
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: 'PROCESSED',
      },
    })

    console.log(`[메일] 처리 완료: ${data.messageId}`)
    return {
      processed: true,
      matched: true,
      company: company.name,
      notifications: company.contacts.length,
    }
  } catch (error) {
    console.error(`[메일] 처리 실패: ${data.messageId}`, error)

    // 오류 상태 업데이트
    await prisma.emailLog.updateMany({
      where: { messageId: data.messageId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    throw error
  }
})

// 플레이스홀더 치환
function replacePlaceholders(template: string, data: Record<string, any>): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`
    result = result.replace(new RegExp(placeholder, 'g'), String(value))
  }
  return result
}

// 관리자 알림
async function notifyAdmin(message: string): Promise<void> {
  // TODO: 관리자 알림 구현
  console.log(`[관리자 알림] ${message}`)

  // 시스템 설정에서 관리자 연락처 조회
  const adminConfig = await prisma.systemConfig.findUnique({
    where: { key: 'ADMIN_PHONE' },
  })

  if (adminConfig?.value) {
    await addSmsJob({
      recipient: adminConfig.value,
      message: `[Echo Mail 시스템]\n${message}`,
      priority: 0, // 최우선 순위
    })
  }
}

// 큐 이벤트 리스너
emailQueue.on('completed', (job, result) => {
  console.log(`✅ 메일 처리 완료: ${job.id}`, result)
})

emailQueue.on('failed', (job, err) => {
  console.error(`❌ 메일 처리 실패: ${job.id}`, err)
})

export default emailQueue
