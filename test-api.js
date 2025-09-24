// Echo Mail API 테스트 스크립트
const API_BASE = 'http://localhost:3000/api'

async function testAPI() {
  console.log('🧪 Echo Mail API 테스트 시작...\n')

  let createdCompanyId = null
  let createdContactId = null

  try {
    // =============================================================================
    // 1. 업체 API 테스트
    // =============================================================================
    console.log('📋 1. 업체 API 테스트')

    // 1-1. 업체 목록 조회
    console.log('\n1-1. 업체 목록 조회')
    const companiesResponse = await fetch(`${API_BASE}/companies`)
    const companiesData = await companiesResponse.json()

    if (companiesData.success) {
      console.log(`✅ 업체 목록 조회 성공: ${companiesData.data.length}개`)
      console.log(`   - 총 ${companiesData.pagination.total}개 업체`)
    } else {
      console.log('❌ 업체 목록 조회 실패:', companiesData.error)
    }

    // 1-2. 업체 생성
    console.log('\n1-2. 업체 생성')
    const newCompany = {
      name: '테스트상사',
      email: 'test@testcompany.co.kr',
      region: '서울',
      isActive: true
    }

    const createResponse = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newCompany)
    })

    const createData = await createResponse.json()
    if (createData.success) {
      createdCompanyId = createData.data.id
      console.log(`✅ 업체 생성 성공: ${createData.data.name} (ID: ${createdCompanyId})`)
    } else {
      console.log('❌ 업체 생성 실패:', createData.error)
      if (createData.details) {
        createData.details.forEach(detail => {
          console.log(`   - ${detail.field}: ${detail.message}`)
        })
      }
    }

    // 1-3. 업체 상세 조회
    if (createdCompanyId) {
      console.log('\n1-3. 업체 상세 조회')
      const detailResponse = await fetch(`${API_BASE}/companies/${createdCompanyId}`)
      const detailData = await detailResponse.json()

      if (detailData.success) {
        console.log(`✅ 업체 상세 조회 성공: ${detailData.data.name}`)
        console.log(`   - 이메일: ${detailData.data.email}`)
        console.log(`   - 지역: ${detailData.data.region}`)
      } else {
        console.log('❌ 업체 상세 조회 실패:', detailData.error)
      }
    }

    // 1-4. 업체 수정
    if (createdCompanyId) {
      console.log('\n1-4. 업체 수정')
      const updateData = {
        name: '테스트상사(수정됨)',
        region: '부산'
      }

      const updateResponse = await fetch(`${API_BASE}/companies/${createdCompanyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const updateResult = await updateResponse.json()
      if (updateResult.success) {
        console.log(`✅ 업체 수정 성공: ${updateResult.data.name}`)
        console.log(`   - 지역 변경: ${updateResult.data.region}`)
      } else {
        console.log('❌ 업체 수정 실패:', updateResult.error)
      }
    }

    // =============================================================================
    // 2. 담당자 API 테스트
    // =============================================================================
    console.log('\n\n📋 2. 담당자 API 테스트')

    // 2-1. 담당자 목록 조회
    console.log('\n2-1. 담당자 목록 조회')
    const contactsResponse = await fetch(`${API_BASE}/contacts`)
    const contactsData = await contactsResponse.json()

    if (contactsData.success) {
      console.log(`✅ 담당자 목록 조회 성공: ${contactsData.data.length}개`)
      console.log(`   - 총 ${contactsData.pagination.total}개 담당자`)
    } else {
      console.log('❌ 담당자 목록 조회 실패:', contactsData.error)
    }

    // 2-2. 담당자 생성
    if (createdCompanyId) {
      console.log('\n2-2. 담당자 생성')
      const newContact = {
        name: '김테스트',
        phone: '010-1234-5678',
        email: 'kim@testcompany.co.kr',
        position: '구매담당',
        companyId: createdCompanyId,
        smsEnabled: true,
        kakaoEnabled: false
      }

      const createContactResponse = await fetch(`${API_BASE}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newContact)
      })

      const createContactData = await createContactResponse.json()
      if (createContactData.success) {
        createdContactId = createContactData.data.id
        console.log(`✅ 담당자 생성 성공: ${createContactData.data.name} (ID: ${createdContactId})`)
        console.log(`   - 전화번호: ${createContactData.data.phone}`)
        console.log(`   - 업체: ${createContactData.data.company.name}`)
      } else {
        console.log('❌ 담당자 생성 실패:', createContactData.error)
      }
    }

    // 2-3. 담당자 상세 조회
    if (createdContactId) {
      console.log('\n2-3. 담당자 상세 조회')
      const contactDetailResponse = await fetch(`${API_BASE}/contacts/${createdContactId}`)
      const contactDetailData = await contactDetailResponse.json()

      if (contactDetailData.success) {
        console.log(`✅ 담당자 상세 조회 성공: ${contactDetailData.data.name}`)
        console.log(`   - 전화번호: ${contactDetailData.data.phone}`)
        console.log(`   - 직책: ${contactDetailData.data.position}`)
      } else {
        console.log('❌ 담당자 상세 조회 실패:', contactDetailData.error)
      }
    }

    // 2-4. 담당자 수정
    if (createdContactId) {
      console.log('\n2-4. 담당자 수정')
      const updateContactData = {
        name: '김테스트(수정됨)',
        position: '구매과장',
        kakaoEnabled: true
      }

      const updateContactResponse = await fetch(`${API_BASE}/contacts/${createdContactId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateContactData)
      })

      const updateContactResult = await updateContactResponse.json()
      if (updateContactResult.success) {
        console.log(`✅ 담당자 수정 성공: ${updateContactResult.data.name}`)
        console.log(`   - 직책: ${updateContactResult.data.position}`)
        console.log(`   - 카카오 알림: ${updateContactResult.data.kakaoEnabled ? '활성화' : '비활성화'}`)
      } else {
        console.log('❌ 담당자 수정 실패:', updateContactResult.error)
      }
    }

    // =============================================================================
    // 3. 검색 및 필터링 테스트
    // =============================================================================
    console.log('\n\n📋 3. 검색 및 필터링 테스트')

    // 3-1. 업체 검색
    console.log('\n3-1. 업체 검색 (이름: "테스트")')
    const searchResponse = await fetch(`${API_BASE}/companies?search=테스트&limit=5`)
    const searchData = await searchResponse.json()

    if (searchData.success) {
      console.log(`✅ 업체 검색 성공: ${searchData.data.length}개 발견`)
      searchData.data.forEach((company, index) => {
        console.log(`   ${index + 1}. ${company.name} (${company.email})`)
      })
    } else {
      console.log('❌ 업체 검색 실패:', searchData.error)
    }

    // 3-2. 지역별 업체 조회
    console.log('\n3-2. 지역별 업체 조회 (지역: "부산")')
    const regionResponse = await fetch(`${API_BASE}/companies?region=부산`)
    const regionData = await regionResponse.json()

    if (regionData.success) {
      console.log(`✅ 지역별 조회 성공: ${regionData.data.length}개 업체`)
    } else {
      console.log('❌ 지역별 조회 실패:', regionData.error)
    }

    // =============================================================================
    // 4. 에러 처리 테스트
    // =============================================================================
    console.log('\n\n📋 4. 에러 처리 테스트')

    // 4-1. 잘못된 데이터로 업체 생성
    console.log('\n4-1. 잘못된 데이터로 업체 생성')
    const invalidCompany = {
      name: '', // 빈 이름
      email: 'invalid-email', // 잘못된 이메일
      region: ''
    }

    const invalidResponse = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidCompany)
    })

    const invalidData = await invalidResponse.json()
    if (!invalidData.success) {
      console.log('✅ 검증 에러 처리 성공:')
      if (invalidData.details) {
        invalidData.details.forEach(detail => {
          console.log(`   - ${detail.field}: ${detail.message}`)
        })
      }
    } else {
      console.log('❌ 검증 에러 처리 실패: 잘못된 데이터가 통과됨')
    }

    // 4-2. 존재하지 않는 업체 조회
    console.log('\n4-2. 존재하지 않는 업체 조회')
    const notFoundResponse = await fetch(`${API_BASE}/companies/nonexistent-id`)
    const notFoundData = await notFoundResponse.json()

    if (!notFoundData.success && notFoundResponse.status === 404) {
      console.log('✅ 404 에러 처리 성공:', notFoundData.error)
    } else {
      console.log('❌ 404 에러 처리 실패')
    }

    // =============================================================================
    // 5. 정리 (생성된 테스트 데이터 삭제)
    // =============================================================================
    console.log('\n\n📋 5. 정리')

    // 5-1. 담당자 삭제
    if (createdContactId) {
      console.log('\n5-1. 테스트 담당자 삭제')
      const deleteContactResponse = await fetch(`${API_BASE}/contacts/${createdContactId}`, {
        method: 'DELETE'
      })

      const deleteContactData = await deleteContactResponse.json()
      if (deleteContactData.success) {
        console.log('✅ 담당자 삭제 성공:', deleteContactData.message)
      } else {
        console.log('❌ 담당자 삭제 실패:', deleteContactData.error)
      }
    }

    // 5-2. 업체 삭제
    if (createdCompanyId) {
      console.log('\n5-2. 테스트 업체 삭제')
      const deleteResponse = await fetch(`${API_BASE}/companies/${createdCompanyId}`, {
        method: 'DELETE'
      })

      const deleteData = await deleteResponse.json()
      if (deleteData.success) {
        console.log('✅ 업체 삭제 성공:', deleteData.message)
      } else {
        console.log('❌ 업체 삭제 실패:', deleteData.error)
      }
    }

    console.log('\n🎉 API 테스트 완료!')

  } catch (error) {
    console.error('\n❌ API 테스트 중 오류 발생:', error.message)
  }
}

// 개발 서버가 실행 중인지 확인
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/companies`)
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
  await testAPI()
}

main().catch(console.error)