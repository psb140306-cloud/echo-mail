import { notificationQueue, NotificationJob } from '@/lib/queue'
import { prisma } from '@/lib/db'
import { sendSMS } from '@/lib/services/sms'
import { sendKakaoAlimtalk, sendKakaoFriendtalk } from '@/lib/services/kakao'

// SMS 발송 처리
notificationQueue.process('send-sms', async (job) => {
  const data = job.data as NotificationJob
  console.log(`[SMS] 발송 시작: ${data.recipient}`)

  try {
    // 발송 로그 생성
    const log = await prisma.notificationLog.create({
      data: {
        type: 'SMS',
        recipient: data.recipient,
        message: data.message,
        status: 'SENDING',
        companyId: data.companyId,
        emailLogId: data.emailLogId,
      },
    })

    // SMS 발송
    const result = await sendSMS({
      to: data.recipient,
      message: data.message,
    })

    // 발송 결과 업데이트
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        errorMessage: result.error,
      },
    })

    console.log(`[SMS] 발송 완료: ${data.recipient}`)
    return result
  } catch (error) {
    console.error(`[SMS] 발송 실패: ${data.recipient}`, error)
    throw error
  }
})

// 카카오톡 알림톡 발송 처리
notificationQueue.process('send-kakao-alimtalk', async (job) => {
  const data = job.data as NotificationJob
  console.log(`[알림톡] 발송 시작: ${data.recipient}`)

  try {
    // 발송 로그 생성
    const log = await prisma.notificationLog.create({
      data: {
        type: 'KAKAO_ALIMTALK',
        recipient: data.recipient,
        message: data.message,
        status: 'SENDING',
        companyId: data.companyId,
        emailLogId: data.emailLogId,
      },
    })

    // 알림톡 발송
    const result = await sendKakaoAlimtalk({
      to: data.recipient,
      message: data.message,
      templateData: data.templateData,
    })

    // 발송 결과 업데이트
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        errorMessage: result.error,
      },
    })

    // 실패 시 SMS 폴백
    if (!result.success && process.env.ENABLE_SMS_FALLBACK === 'true') {
      console.log(`[알림톡] SMS 폴백 시작: ${data.recipient}`)
      await addSmsJob({
        recipient: data.recipient,
        message: data.message,
        companyId: data.companyId,
        emailLogId: data.emailLogId,
      })
    }

    console.log(`[알림톡] 발송 완료: ${data.recipient}`)
    return result
  } catch (error) {
    console.error(`[알림톡] 발송 실패: ${data.recipient}`, error)
    throw error
  }
})

// 카카오톡 친구톡 발송 처리
notificationQueue.process('send-kakao-friendtalk', async (job) => {
  const data = job.data as NotificationJob
  console.log(`[친구톡] 발송 시작: ${data.recipient}`)

  try {
    // 발송 로그 생성
    const log = await prisma.notificationLog.create({
      data: {
        type: 'KAKAO_FRIENDTALK',
        recipient: data.recipient,
        message: data.message,
        status: 'SENDING',
        companyId: data.companyId,
        emailLogId: data.emailLogId,
      },
    })

    // 친구톡 발송
    const result = await sendKakaoFriendtalk({
      to: data.recipient,
      message: data.message,
    })

    // 발송 결과 업데이트
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        errorMessage: result.error,
      },
    })

    console.log(`[친구톡] 발송 완료: ${data.recipient}`)
    return result
  } catch (error) {
    console.error(`[친구톡] 발송 실패: ${data.recipient}`, error)
    throw error
  }
})

// 큐 이벤트 리스너
notificationQueue.on('completed', (job, result) => {
  console.log(`✅ 작업 완료: ${job.name} (ID: ${job.id})`)
})

notificationQueue.on('failed', (job, err) => {
  console.error(`❌ 작업 실패: ${job.name} (ID: ${job.id})`, err)
})

notificationQueue.on('stalled', (job) => {
  console.warn(`⚠️ 작업 지연: ${job.name} (ID: ${job.id})`)
})

export default notificationQueue
