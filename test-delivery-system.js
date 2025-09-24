// Echo Mail 납품 일정 관리 시스템 테스트 스크립트
const API_BASE = 'http://localhost:3000/api'

async function testDeliverySystem() {
  console.log('🧪 납품 일정 관리 시스템 테스트 시작...\n')

  let createdRuleId = null
  let createdHolidayIds = []

  try {
    // =============================================================================
    // 1. 납품 규칙 API 테스트
    // =============================================================================
    console.log('📋 1. 납품 규칙 API 테스트')

    // 1-1. 납품 규칙 목록 조회
    console.log('\n1-1. 납품 규칙 목록 조회')
    const rulesResponse = await fetch(`${API_BASE}/delivery-rules`)
    const rulesData = await rulesResponse.json()

    if (rulesData.success) {
      console.log(`✅ 납품 규칙 목록 조회 성공: ${rulesData.data.length}개`)
      rulesData.data.forEach((rule, index) => {
        console.log(`   ${index + 1}. ${rule.region}: 오전 ${rule.morningCutoff}(${rule.morningDeliveryDays}일), 오후 ${rule.afternoonCutoff}(${rule.afternoonDeliveryDays}일)`)
      })
    } else {
      console.log('❌ 납품 규칙 목록 조회 실패:', rulesData.error)
    }

    // 1-2. 납품 규칙 생성
    console.log('\n1-2. 납품 규칙 생성')
    const newRule = {
      region: '테스트지역',
      morningCutoff: '11:00',
      afternoonCutoff: '16:00',
      morningDeliveryDays: 1,
      afternoonDeliveryDays: 2,
      isActive: true
    }

    const createRuleResponse = await fetch(`${API_BASE}/delivery-rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newRule)
    })

    const createRuleData = await createRuleResponse.json()
    if (createRuleData.success) {
      createdRuleId = createRuleData.data.id
      console.log(`✅ 납품 규칙 생성 성공: ${createRuleData.data.region} (ID: ${createdRuleId})`)
    } else {
      console.log('❌ 납품 규칙 생성 실패:', createRuleData.error)
    }

    // 1-3. 납품 규칙 상세 조회
    if (createdRuleId) {
      console.log('\n1-3. 납품 규칙 상세 조회')
      const ruleDetailResponse = await fetch(`${API_BASE}/delivery-rules/${createdRuleId}`)
      const ruleDetailData = await ruleDetailResponse.json()

      if (ruleDetailData.success) {
        console.log(`✅ 납품 규칙 상세 조회 성공: ${ruleDetailData.data.region}`)
        console.log(`   - 오전 마감: ${ruleDetailData.data.morningCutoff} (${ruleDetailData.data.morningDeliveryDays}일 후 배송)`)
        console.log(`   - 오후 마감: ${ruleDetailData.data.afternoonCutoff} (${ruleDetailData.data.afternoonDeliveryDays}일 후 배송)`)
      } else {
        console.log('❌ 납품 규칙 상세 조회 실패:', ruleDetailData.error)
      }
    }

    // 1-4. 납품 규칙 수정
    if (createdRuleId) {
      console.log('\n1-4. 납품 규칙 수정')
      const updateRuleData = {
        morningCutoff: '10:30',
        afternoonDeliveryDays: 3
      }

      const updateRuleResponse = await fetch(`${API_BASE}/delivery-rules/${createdRuleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateRuleData)
      })

      const updateRuleResult = await updateRuleResponse.json()
      if (updateRuleResult.success) {
        console.log(`✅ 납품 규칙 수정 성공: ${updateRuleResult.data.region}`)
        console.log(`   - 오전 마감시간 변경: ${updateRuleResult.data.morningCutoff}`)
        console.log(`   - 오후 배송일 변경: ${updateRuleResult.data.afternoonDeliveryDays}일`)
      } else {
        console.log('❌ 납품 규칙 수정 실패:', updateRuleResult.error)
      }
    }

    // =============================================================================
    // 2. 공휴일 API 테스트
    // =============================================================================
    console.log('\n\n📋 2. 공휴일 API 테스트')

    // 2-1. 공휴일 목록 조회
    console.log('\n2-1. 공휴일 목록 조회 (2025년)')
    const holidaysResponse = await fetch(`${API_BASE}/holidays?year=2025&limit=5`)
    const holidaysData = await holidaysResponse.json()

    if (holidaysData.success) {
      console.log(`✅ 공휴일 목록 조회 성공: ${holidaysData.data.length}개`)
      holidaysData.data.forEach((holiday, index) => {
        const date = new Date(holiday.date).toLocaleDateString('ko-KR')
        console.log(`   ${index + 1}. ${date} - ${holiday.name} ${holiday.isRecurring ? '(매년 반복)' : ''}`)
      })
    } else {
      console.log('❌ 공휴일 목록 조회 실패:', holidaysData.error)
    }

    // 2-2. 공휴일 생성
    console.log('\n2-2. 공휴일 생성')
    const newHoliday = {
      date: '2025-12-31',
      name: '테스트 공휴일',
      isRecurring: false
    }

    const createHolidayResponse = await fetch(`${API_BASE}/holidays`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newHoliday)
    })

    const createHolidayData = await createHolidayResponse.json()
    if (createHolidayData.success) {
      createdHolidayIds.push(createHolidayData.data.id)
      console.log(`✅ 공휴일 생성 성공: ${createHolidayData.data.name}`)
      console.log(`   - 날짜: ${createHolidayData.data.date}`)
    } else {
      console.log('❌ 공휴일 생성 실패:', createHolidayData.error)
    }

    // 2-3. 공휴일 일괄 생성
    console.log('\n2-3. 공휴일 일괄 생성')
    const bulkHolidays = {
      holidays: [
        { date: '2025-11-20', name: '테스트 공휴일 1', isRecurring: false },
        { date: '2025-11-21', name: '테스트 공휴일 2', isRecurring: false }
      ]
    }

    const bulkCreateResponse = await fetch(`${API_BASE}/holidays`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bulkHolidays)
    })

    const bulkCreateData = await bulkCreateResponse.json()
    if (bulkCreateData.success) {
      console.log(`✅ 공휴일 일괄 생성 성공: ${bulkCreateData.data.count}개`)
      bulkCreateData.data.holidays.forEach((holiday, index) => {
        console.log(`   ${index + 1}. ${holiday.date} - ${holiday.name}`)
      })
    } else {
      console.log('❌ 공휴일 일괄 생성 실패:', bulkCreateData.error)
    }

    // =============================================================================
    // 3. 납품일 계산 API 테스트
    // =============================================================================
    console.log('\n\n📋 3. 납품일 계산 API 테스트')

    // 3-1. 오전 주문 납품일 계산
    console.log('\n3-1. 오전 주문 납품일 계산')
    const morningOrder = {
      region: '서울',
      orderDateTime: '2025-01-15T09:30:00.000Z', // 오전 9:30
      excludeWeekends: true
    }

    const morningCalcResponse = await fetch(`${API_BASE}/delivery/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(morningOrder)
    })

    const morningCalcData = await morningCalcResponse.json()
    if (morningCalcData.success) {
      console.log('✅ 오전 주문 납품일 계산 성공:')
      console.log(`   - 주문일시: ${new Date(morningOrder.orderDateTime).toLocaleString('ko-KR')}`)
      console.log(`   - 납품일: ${morningCalcData.data.deliveryDateKR}`)
      console.log(`   - 납품시간: ${morningCalcData.data.deliveryTimeKR}`)
      console.log(`   - 영업일: ${morningCalcData.data.businessDaysUsed}일`)
    } else {
      console.log('❌ 오전 주문 납품일 계산 실패:', morningCalcData.error)
    }

    // 3-2. 오후 늦은 시간 주문 납품일 계산
    console.log('\n3-2. 오후 늦은 시간 주문 납품일 계산')
    const eveningOrder = {
      region: '서울',
      orderDateTime: '2025-01-15T19:30:00.000Z', // 오후 7:30
      excludeWeekends: true
    }

    const eveningCalcResponse = await fetch(`${API_BASE}/delivery/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eveningOrder)
    })

    const eveningCalcData = await eveningCalcResponse.json()
    if (eveningCalcData.success) {
      console.log('✅ 오후 늦은 시간 주문 납품일 계산 성공:')
      console.log(`   - 주문일시: ${new Date(eveningOrder.orderDateTime).toLocaleString('ko-KR')}`)
      console.log(`   - 납품일: ${eveningCalcData.data.deliveryDateKR}`)
      console.log(`   - 납품시간: ${eveningCalcData.data.deliveryTimeKR}`)
      console.log(`   - 영업일: ${eveningCalcData.data.businessDaysUsed}일`)
    } else {
      console.log('❌ 오후 늦은 시간 주문 납품일 계산 실패:', eveningCalcData.error)
    }

    // 3-3. 다음 영업일 조회
    console.log('\n3-3. 다음 영업일 조회')
    const nextBusinessDayResponse = await fetch(`${API_BASE}/delivery/calculate?action=next-business-day&date=2025-01-15`)
    const nextBusinessDayData = await nextBusinessDayResponse.json()

    if (nextBusinessDayData.success) {
      console.log('✅ 다음 영업일 조회 성공:')
      console.log(`   - 기준일: ${new Date(nextBusinessDayData.data.baseDate).toLocaleDateString('ko-KR')}`)
      console.log(`   - 다음 영업일: ${nextBusinessDayData.data.nextBusinessDayKR}`)
    } else {
      console.log('❌ 다음 영업일 조회 실패:', nextBusinessDayData.error)
    }

    // 3-4. 영업일 간격 계산
    console.log('\n3-4. 영업일 간격 계산')
    const businessDaysResponse = await fetch(`${API_BASE}/delivery/calculate?action=business-days-between&startDate=2025-01-15&endDate=2025-01-25`)
    const businessDaysData = await businessDaysResponse.json()

    if (businessDaysData.success) {
      console.log('✅ 영업일 간격 계산 성공:')
      console.log(`   - 시작일: ${new Date(businessDaysData.data.startDate).toLocaleDateString('ko-KR')}`)
      console.log(`   - 종료일: ${new Date(businessDaysData.data.endDate).toLocaleDateString('ko-KR')}`)
      console.log(`   - 총 일수: ${businessDaysData.data.totalDays}일`)
      console.log(`   - 영업일: ${businessDaysData.data.businessDays}일`)
    } else {
      console.log('❌ 영업일 간격 계산 실패:', businessDaysData.error)
    }

    // =============================================================================
    // 4. 에러 처리 테스트
    // =============================================================================
    console.log('\n\n📋 4. 에러 처리 테스트')

    // 4-1. 잘못된 시간 형식으로 납품 규칙 생성
    console.log('\n4-1. 잘못된 시간 형식 테스트')
    const invalidTimeRule = {
      region: '잘못된지역',
      morningCutoff: '25:00', // 잘못된 시간
      afternoonCutoff: '16:00',
      morningDeliveryDays: 1,
      afternoonDeliveryDays: 2
    }

    const invalidTimeResponse = await fetch(`${API_BASE}/delivery-rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidTimeRule)
    })

    const invalidTimeData = await invalidTimeResponse.json()
    if (!invalidTimeData.success) {
      console.log('✅ 잘못된 시간 형식 에러 처리 성공:', invalidTimeData.error)
    } else {
      console.log('❌ 잘못된 시간 형식 에러 처리 실패')
    }

    // 4-2. 존재하지 않는 지역으로 납품일 계산
    console.log('\n4-2. 존재하지 않는 지역 테스트')
    const invalidRegionOrder = {
      region: '존재하지않는지역',
      orderDateTime: '2025-01-15T09:30:00.000Z'
    }

    const invalidRegionResponse = await fetch(`${API_BASE}/delivery/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidRegionOrder)
    })

    const invalidRegionData = await invalidRegionResponse.json()
    if (!invalidRegionData.success) {
      console.log('✅ 존재하지 않는 지역 에러 처리 성공:', invalidRegionData.error)
    } else {
      console.log('❌ 존재하지 않는 지역 에러 처리 실패')
    }

    // =============================================================================
    // 5. 정리 (생성된 테스트 데이터 삭제)
    // =============================================================================
    console.log('\n\n📋 5. 정리')

    // 5-1. 테스트 공휴일 삭제
    if (createdHolidayIds.length > 0) {
      console.log('\n5-1. 테스트 공휴일 삭제')
      for (const holidayId of createdHolidayIds) {
        const deleteHolidayResponse = await fetch(`${API_BASE}/holidays/${holidayId}`, {
          method: 'DELETE'
        })

        const deleteHolidayData = await deleteHolidayResponse.json()
        if (deleteHolidayData.success) {
          console.log(`✅ 공휴일 삭제 성공: ${deleteHolidayData.data.deletedHoliday}`)
        }
      }
    }

    // 5-2. 테스트 납품 규칙 삭제
    if (createdRuleId) {
      console.log('\n5-2. 테스트 납품 규칙 삭제')
      const deleteRuleResponse = await fetch(`${API_BASE}/delivery-rules/${createdRuleId}`, {
        method: 'DELETE'
      })

      const deleteRuleData = await deleteRuleResponse.json()
      if (deleteRuleData.success) {
        console.log(`✅ 납품 규칙 삭제 성공: ${deleteRuleData.data.deletedRegion}`)
      } else {
        console.log('❌ 납품 규칙 삭제 실패:', deleteRuleData.error)
      }
    }

    console.log('\n🎉 납품 일정 관리 시스템 테스트 완료!')

  } catch (error) {
    console.error('\n❌ 테스트 중 오류 발생:', error.message)
  }
}

// 개발 서버가 실행 중인지 확인
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/delivery-rules`)
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
  await testDeliverySystem()
}

main().catch(console.error)