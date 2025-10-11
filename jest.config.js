const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Next.js 앱의 경로 (package.json과 next.config.js가 있는 위치)
  dir: './',
})

// Jest에 전달할 커스텀 설정
const customJestConfig = {
  // 테스트 환경 설정
  testEnvironment: 'jsdom',

  // 모듈 경로 매핑 (Next.js alias 지원)
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
  },

  // 테스트 파일 패턴
  testMatch: ['**/__tests__/**/*.(ts|tsx|js|jsx)', '**/*.(test|spec).(ts|tsx|js|jsx)'],

  // 테스트 환경 설정 파일
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // 커버리지 수집 설정
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/*.config.{js,ts}',
    '!**/setup.ts',
    '!**/seed.ts',
  ],

  // 커버리지 리포트 형식
  coverageReporters: ['text', 'lcov', 'html'],

  // 커버리지 임계값
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // 테스트 타임아웃
  testTimeout: 10000,

  // 모듈 변환 무시 패턈
  transformIgnorePatterns: ['node_modules/(?!((@supabase|@hookform|cmdk|date-fns)/.*|.*\\.mjs$))'],

  // 전역 변수 설정
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },

  // 모듈 디렉토리
  moduleDirectories: ['node_modules', '<rootDir>/'],

  // 테스트 실행 전 정리
  clearMocks: true,
  restoreMocks: true,

  // 병렬 실행 설정
  maxWorkers: '50%',

  // 자세한 출력
  verbose: true,
}

// Next.js와 Jest 설정을 병합하여 내보내기
module.exports = createJestConfig(customJestConfig)
