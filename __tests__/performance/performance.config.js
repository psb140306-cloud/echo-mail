/**
 * Performance Test Configuration
 * 성능 테스트 설정
 */

module.exports = {
  // 테스트 환경 설정
  testEnvironment: 'node',

  // 테스트 타임아웃 (10분)
  testTimeout: 600000,

  // 메모리 사용량 모니터링
  detectOpenHandles: true,
  detectLeaks: true,

  // 성능 테스트 기준값
  performanceThresholds: {
    // 이메일 처리 성능
    emailProcessing: {
      singleEmail: 2000,        // 단일 이메일 2초 이내
      bulkEmail100: 30000,      // 100개 이메일 30초 이내
      bulkEmail1000: 300000,    // 1000개 이메일 5분 이내
    },

    // 알림 발송 성능
    notification: {
      singleSms: 3000,          // SMS 3초 이내
      singleKakao: 5000,        // 카카오톡 5초 이내
      bulkSms100: 60000,        // 100개 SMS 1분 이내
      bulkKakao100: 120000,     // 100개 카카오톡 2분 이내
    },

    // 데이터베이스 성능
    database: {
      companyCreate: 1000,      // 업체 생성 1초 이내
      companyQuery: 500,        // 업체 조회 0.5초 이내
      bulkInsert100: 5000,      // 100개 일괄 생성 5초 이내
      complexQuery: 2000,       // 복잡 쿼리 2초 이내
    },

    // API 응답 시간
    api: {
      simpleGet: 500,           // 단순 GET 0.5초 이내
      complexGet: 2000,         // 복잡 GET 2초 이내
      post: 1000,               // POST 1초 이내
      put: 1000,                // PUT 1초 이내
      delete: 500,              // DELETE 0.5초 이내
    },

    // 메모리 사용량 (MB)
    memory: {
      baseline: 100,            // 기본 메모리 100MB
      afterBulkProcessing: 500, // 대량 처리 후 500MB 이내
      maxHeapUsed: 1024,        // 최대 힙 사용량 1GB
    }
  },

  // 부하 테스트 설정
  loadTest: {
    concurrentUsers: [1, 5, 10, 25, 50, 100],
    rampUpTime: 60000,          // 1분 증가
    sustainTime: 300000,        // 5분 유지
    rampDownTime: 60000,        // 1분 감소
  },

  // 스트레스 테스트 설정
  stressTest: {
    maxConcurrentEmails: 1000,
    maxConcurrentNotifications: 500,
    memoryLimitMB: 2048,
    cpuThresholdPercent: 80,
  }
}