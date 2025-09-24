// Echo Mail 알림 발송 시스템 테스트 스크립트
const API_BASE = 'http://localhost:3000/api'

async function testNotificationSystem() {
  console.log('🧪 알림 발송 시스템 테스트 시작...\n')

  try {
    // =============================================================================
    // 1. 시스템 상태 확인
    // =============================================================================
    console.log('📋 1. 시스템 상태 확인')

    // 1-1. 전체 시스템 상태
    console.log('\n1-1. 전체 시스템 상태 조회')
    const statusResponse = await fetch(`${API_BASE}/notifications/status`)
    const statusData = await statusResponse.json()

    if (statusData.success) {
      console.log('✅ 시스템 상태 조회 성공:')
      console.log(`   - SMS: ${statusData.data.sms.available ? '사용 가능' : '사용 불가'} (잔액: ${statusData.data.sms.balance}개)`)
      console.log(`   - 카카오: ${statusData.data.kakao.available ? '사용 가능' : '사용 불가'}`)
      console.log(`   - 큐 처리: ${statusData.data.queue.processing ? '실행 중' : '중지'}`)
    } else {
      console.log('❌ 시스템 상태 조회 실패:', statusData.error)
    }

    // 1-2. 템플릿 목록 조회
    console.log('\n1-2. 템플릿 목록 조회')
    const templatesResponse = await fetch(`${API_BASE}/notifications/status?action=templates`)
    const templatesData = await templatesResponse.json()

    if (templatesData.success) {
      console.log(`✅ 템플릿 목록 조회 성공: ${templatesData.data.count}개`)
      Object.entries(templatesData.data.byType).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count}개`)
      })

      if (templatesData.data.templates.length > 0) {
        console.log('\n   📝 사용 가능한 템플릿:')
        templatesData.data.templates.forEach((template, index) => {
          console.log(`   ${index + 1}. ${template.name} (${template.type})${template.isDefault ? ' [기본]' : ''}`)
        })
      }
    } else {
      console.log('❌ 템플릿 목록 조회 실패:', templatesData.error)
    }

    // =============================================================================
    // 2. SMS 알림 테스트
    // =============================================================================
    console.log('\n\n📋 2. SMS 알림 테스트')

    // 2-1. 단일 SMS 발송
    console.log('\n2-1. 단일 SMS 발송 (테스트 모드)')
    const smsNotification = {
      type: 'SMS',
      recipient: '010-1234-5678',
      templateName: 'ORDER_RECEIVED_SMS',
      variables: {
        companyName: '테스트상사',
        deliveryDate: '2025년 1월 20일',
        deliveryTime: '오전'
      },
      priority: 'normal'
    }

    const smsResponse = await fetch(`${API_BASE}/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(smsNotification)
    })

    const smsData = await smsResponse.json()
    if (smsData.success) {
      console.log(`✅ SMS 발송 성공: ${smsData.data.provider}`)
      console.log(`   - 메시지 ID: ${smsData.data.messageId}`)
      console.log(`   - 폴백 사용: ${smsData.data.failoverUsed ? '예' : '아니오'}`)
    } else {
      console.log('❌ SMS 발송 실패:', smsData.error)
    }

    // 2-2. 큐를 통한 SMS 발송
    console.log('\n2-2. 큐를 통한 SMS 발송')
    const queuedSmsNotification = {
      ...smsNotification,
      recipient: '010-2345-6789',
      useQueue: true,
      priority: 'high'
    }

    const queuedSmsResponse = await fetch(`${API_BASE}/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queuedSmsNotification)
    })

    const queuedSmsData = await queuedSmsResponse.json()
    if (queuedSmsData.success) {
      console.log(`✅ SMS 큐 등록 성공: ${queuedSmsData.data.jobId}`)
      console.log(`   - 메시지: ${queuedSmsData.data.message}`)
    } else {
      console.log('❌ SMS 큐 등록 실패:', queuedSmsData.error)
    }

    // =============================================================================
    // 3. 카카오톡 알림 테스트
    // =============================================================================
    console.log('\n\n📋 3. 카카오톡 알림 테스트')

    // 3-1. 카카오 알림톡 발송
    console.log('\n3-1. 카카오 알림톡 발송 (테스트 모드)')
    const kakaoNotification = {
      type: 'KAKAO_ALIMTALK',
      recipient: '010-3456-7890',
      templateName: 'ORDER_RECEIVED_KAKAO',
      variables: {
        companyName: '부산물산',
        deliveryDate: '2025년 1월 21일',
        deliveryTime: '오후'
      },
      enableFailover: true
    }

    const kakaoResponse = await fetch(`${API_BASE}/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(kakaoNotification)
    })

    const kakaoData = await kakaoResponse.json()
    if (kakaoData.success) {
      console.log(`✅ 카카오 알림톡 발송 성공: ${kakaoData.data.provider}`)
      console.log(`   - 메시지 ID: ${kakaoData.data.messageId}`)
      console.log(`   - 폴백 사용: ${kakaoData.data.failoverUsed ? '예' : '아니오'}`)
    } else {
      console.log('❌ 카카오 알림톡 발송 실패:', kakaoData.error)
    }

    // =============================================================================
    // 4. 대량 알림 테스트
    // =============================================================================
    console.log('\n\n📋 4. 대량 알림 테스트')

    // 4-1. 대량 알림 발송
    console.log('\n4-1. 대량 알림 발송 (5개)')
    const bulkNotifications = {
      notifications: [
        {
          type: 'SMS',
          recipient: '010-1000-0001',
          templateName: 'ORDER_RECEIVED_SMS',
          variables: { companyName: '업체1', deliveryDate: '2025년 1월 20일', deliveryTime: '오전' }
        },
        {
          type: 'SMS',
          recipient: '010-1000-0002',
          templateName: 'ORDER_RECEIVED_SMS',
          variables: { companyName: '업체2', deliveryDate: '2025년 1월 20일', deliveryTime: '오후' }
        },
        {
          type: 'KAKAO_ALIMTALK',
          recipient: '010-1000-0003',
          templateName: 'ORDER_RECEIVED_KAKAO',
          variables: { companyName: '업체3', deliveryDate: '2025년 1월 21일', deliveryTime: '오전' },
          enableFailover: true
        },
        {
          type: 'SMS',
          recipient: '010-1000-0004',
          templateName: 'ORDER_RECEIVED_SMS',
          variables: { companyName: '업체4', deliveryDate: '2025년 1월 21일', deliveryTime: '오후' }
        },
        {
          type: 'SMS',
          recipient: '010-1000-0005',
          templateName: 'ORDER_RECEIVED_SMS',
          variables: { companyName: '업체5', deliveryDate: '2025년 1월 22일', deliveryTime: '오전' }
        }
      ],
      batchSize: 3
    }

    const bulkResponse = await fetch(`${API_BASE}/notifications/send?action=bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bulkNotifications)
    })

    const bulkData = await bulkResponse.json()
    if (bulkData.success) {
      console.log(`✅ 대량 알림 발송 완료:`)
      console.log(`   - 총 발송: ${bulkData.data.totalCount}개`)
      console.log(`   - 성공: ${bulkData.data.successCount}개`)
      console.log(`   - 실패: ${bulkData.data.failureCount}개`)
    } else {
      console.log('❌ 대량 알림 발송 실패:', bulkData.error)
    }

    // =============================================================================
    // 5. 발주 접수 알림 테스트
    // =============================================================================
    console.log('\n\n📋 5. 발주 접수 알림 테스트')

    // 먼저 테스트 업체가 있는지 확인
    console.log('\n5-1. 테스트 업체 조회')
    const companiesResponse = await fetch(`${API_BASE}/companies?limit=1`)
    const companiesData = await companiesResponse.json()

    if (companiesData.success && companiesData.data.length > 0) {
      const testCompany = companiesData.data[0]
      console.log(`✅ 테스트 업체 확인: ${testCompany.name} (담당자: ${testCompany._count.contacts}명)`)

      // 5-2. 발주 접수 알림 발송
      console.log('\n5-2. 발주 접수 알림 발송')
      const orderNotification = {
        companyId: testCompany.id
      }

      const orderResponse = await fetch(`${API_BASE}/notifications/send?action=order-received`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderNotification)
      })

      const orderData = await orderResponse.json()
      if (orderData.success) {
        console.log(`✅ 발주 접수 알림 발송 완료:`)
        console.log(`   - 업체: ${testCompany.name}`)
        console.log(`   - 총 발송: ${orderData.data.totalCount}개`)
        console.log(`   - 성공: ${orderData.data.successCount}개`)
        console.log(`   - 실패: ${orderData.data.failureCount}개`)
      } else {
        console.log('❌ 발주 접수 알림 발송 실패:', orderData.error)
      }
    } else {
      console.log('⚠️ 테스트할 업체가 없습니다. 먼저 업체를 등록해주세요.')
    }

    // =============================================================================
    // 6. 큐 관리 테스트
    // =============================================================================
    console.log('\n\n📋 6. 큐 관리 테스트')

    // 6-1. 큐 상태 조회
    console.log('\n6-1. 큐 상태 조회')
    const queueStatusResponse = await fetch(`${API_BASE}/notifications/status?action=queue`)
    const queueStatusData = await queueStatusResponse.json()

    if (queueStatusData.success) {
      console.log('✅ 큐 상태 조회 성공:')
      console.log(`   - 처리 중: ${queueStatusData.data.processing ? '예' : '아니오'}`)
      console.log(`   - 대기: ${queueStatusData.data.stats.pending}개`)
      console.log(`   - 처리 중: ${queueStatusData.data.stats.processing}개`)
      console.log(`   - 완료: ${queueStatusData.data.stats.completed}개`)
      console.log(`   - 실패: ${queueStatusData.data.stats.failed}개`)
    } else {
      console.log('❌ 큐 상태 조회 실패:', queueStatusData.error)
    }

    // 6-2. 큐 시작/중지 테스트
    console.log('\n6-2. 큐 제어 테스트')

    // 큐 시작
    const startQueueResponse = await fetch(`${API_BASE}/notifications/status?action=start-queue`, {
      method: 'POST'
    })
    const startQueueData = await startQueueResponse.json()

    if (startQueueData.success) {
      console.log('✅ 큐 시작 성공:', startQueueData.data.message)
    } else {
      console.log('❌ 큐 시작 실패:', startQueueData.error)
    }

    // 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 큐 중지
    const stopQueueResponse = await fetch(`${API_BASE}/notifications/status?action=stop-queue`, {
      method: 'POST'
    })
    const stopQueueData = await stopQueueResponse.json()

    if (stopQueueData.success) {
      console.log('✅ 큐 중지 성공:', stopQueueData.data.message)
    } else {
      console.log('❌ 큐 중지 실패:', stopQueueData.error)
    }

    // =============================================================================
    // 7. 에러 처리 테스트
    // =============================================================================
    console.log('\n\n📋 7. 에러 처리 테스트')

    // 7-1. 잘못된 템플릿으로 알림 발송
    console.log('\n7-1. 존재하지 않는 템플릿 테스트')
    const invalidTemplateNotification = {
      type: 'SMS',
      recipient: '010-9999-9999',
      templateName: 'NON_EXISTENT_TEMPLATE',
      variables: {}
    }

    const invalidTemplateResponse = await fetch(`${API_BASE}/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidTemplateNotification)
    })

    const invalidTemplateData = await invalidTemplateResponse.json()
    if (!invalidTemplateData.success) {
      console.log('✅ 존재하지 않는 템플릿 에러 처리 성공:', invalidTemplateData.error)
    } else {
      console.log('❌ 존재하지 않는 템플릿 에러 처리 실패')
    }

    // 7-2. 잘못된 수신자로 알림 발송
    console.log('\n7-2. 잘못된 수신자 테스트')
    const invalidRecipientNotification = {
      type: 'SMS',
      recipient: '', // 빈 수신자
      templateName: 'ORDER_RECEIVED_SMS',
      variables: {
        companyName: '테스트상사',
        deliveryDate: '2025년 1월 20일',
        deliveryTime: '오전'
      }
    }

    const invalidRecipientResponse = await fetch(`${API_BASE}/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidRecipientNotification)
    })

    const invalidRecipientData = await invalidRecipientResponse.json()
    if (!invalidRecipientData.success) {
      console.log('✅ 잘못된 수신자 에러 처리 성공:', invalidRecipientData.error)
    } else {
      console.log('❌ 잘못된 수신자 에러 처리 실패')
    }

    console.log('\n🎉 알림 발송 시스템 테스트 완료!')

  } catch (error) {
    console.error('\n❌ 테스트 중 오류 발생:', error.message)
  }
}

// 개발 서버가 실행 중인지 확인
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/notifications/status`)
    return response.ok || response.status === 404
  } catch (error) {
    return false
  }
}

// 메인 실행
async function main() {
  console.log('🔍 개발 서버 확인 중...')

  const serverRunning = await checkServer()
  if (!serverRunning) {
    console.log('❌ 개발 서버가 실행되지 않았습니다.')
    console.log('다음 명령어로 서버를 시작해주세요:')
    console.log('  npm run dev')
    console.log('')
    console.log('서버가 시작되면 http://localhost:3000 에서 확인할 수 있습니다.')
    return
  }

  console.log('✅ 개발 서버 확인 완료\n')
  await testNotificationSystem()
}

main().catch(console.error)