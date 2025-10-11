// Jest DOM matchers 추가
import '@testing-library/jest-dom'

// 환경변수 모킹
process.env.NODE_ENV = 'test'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.TOSS_CLIENT_KEY = 'test_ck_key'
process.env.TOSS_SECRET_KEY = 'test_sk_key'

// Next.js router 모킹
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Next.js navigation 모킹 (App Router)
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Winston 로거 모킹
jest.mock('./lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    system: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    email: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    notification: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  },
}))

// Prisma Client 모킹
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn((callback) =>
      callback({
        company: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
          updateMany: jest.fn(),
          count: jest.fn(),
          createMany: jest.fn(),
        },
        contact: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
          updateMany: jest.fn(),
          count: jest.fn(),
          createMany: jest.fn(),
        },
        tenant: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
          updateMany: jest.fn(),
          count: jest.fn(),
          createMany: jest.fn(),
        },
        user: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
          updateMany: jest.fn(),
          count: jest.fn(),
          createMany: jest.fn(),
        },
      })
    ),
    company: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
    contact: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
    tenant: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
  })),
}))

// Tenant middleware 상태 모킹
const mockTenantContext = {
  tenantId: null,
  userId: null,
  getTenantId: jest.fn(() => mockTenantContext.tenantId),
  getUserId: jest.fn(() => mockTenantContext.userId),
  setTenant: jest.fn((tenantId, userId) => {
    mockTenantContext.tenantId = tenantId
    mockTenantContext.userId = userId || null
  }),
  clear: jest.fn(() => {
    mockTenantContext.tenantId = null
    mockTenantContext.userId = null
  }),
}

// Prisma DB instance 모킹
const createPrismaModelMock = (modelName) => ({
  create: jest.fn((args) => {
    if (!mockTenantContext.tenantId && modelName !== 'tenant' && modelName !== 'user') {
      return Promise.reject(new Error('Tenant context required'))
    }
    return Promise.resolve({
      id: `mock-${modelName}-${Date.now()}`,
      tenantId: mockTenantContext.tenantId,
      ...args.data,
    })
  }),
  findMany: jest.fn((args) => {
    if (!mockTenantContext.tenantId && modelName !== 'tenant' && modelName !== 'user') {
      return Promise.reject(new Error('Tenant context required'))
    }
    if (modelName === 'tenant') {
      return Promise.resolve([
        { id: 'tenant-a-test-id', name: 'Tenant A', subdomain: 'tenant-a' },
        { id: 'tenant-b-test-id', name: 'Tenant B', subdomain: 'tenant-b' },
      ])
    }
    return Promise.resolve([])
  }),
  findUnique: jest.fn((args) => {
    if (
      !mockTenantContext.tenantId &&
      modelName !== 'tenant' &&
      modelName !== 'user' &&
      modelName !== 'subscription'
    ) {
      return Promise.reject(new Error('Tenant context required'))
    }
    return Promise.resolve({
      id: args.where.id,
      tenantId: mockTenantContext.tenantId,
    })
  }),
  update: jest.fn((args) => {
    if (!mockTenantContext.tenantId && modelName !== 'tenant' && modelName !== 'user') {
      return Promise.reject(new Error('Tenant context required'))
    }
    return Promise.resolve({
      id: args.where.id,
      tenantId: mockTenantContext.tenantId,
      ...args.data,
    })
  }),
  updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
  delete: jest.fn(() => Promise.resolve({ id: 'deleted-id' })),
  deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
  count: jest.fn((args) => {
    if (!mockTenantContext.tenantId && modelName !== 'tenant' && modelName !== 'user') {
      return Promise.reject(new Error('Tenant context required'))
    }
    return Promise.resolve(0)
  }),
  createMany: jest.fn(() => Promise.resolve({ count: 0 })),
})

jest.mock('@/lib/db', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn((callback) => {
      const txPrisma = {
        company: createPrismaModelMock('company'),
        contact: createPrismaModelMock('contact'),
        tenant: createPrismaModelMock('tenant'),
        user: createPrismaModelMock('user'),
        subscription: createPrismaModelMock('subscription'),
        invoice: createPrismaModelMock('invoice'),
        tenantUser: createPrismaModelMock('tenantUser'),
        emailLog: createPrismaModelMock('emailLog'),
        notificationLog: createPrismaModelMock('notificationLog'),
      }
      return callback(txPrisma)
    }),
    company: createPrismaModelMock('company'),
    contact: createPrismaModelMock('contact'),
    tenant: createPrismaModelMock('tenant'),
    user: createPrismaModelMock('user'),
    subscription: createPrismaModelMock('subscription'),
    invoice: createPrismaModelMock('invoice'),
    tenantUser: createPrismaModelMock('tenantUser'),
    emailLog: createPrismaModelMock('emailLog'),
    notificationLog: createPrismaModelMock('notificationLog'),
  },
  TenantContext: {
    getInstance: jest.fn(() => mockTenantContext),
  },
  validateTenantAccess: jest.fn(),
  checkUsageLimit: jest.fn(() => Promise.resolve({ allowed: true, current: 10, limit: 100 })),
}))

jest.mock('@/lib/tenant-middleware', () => ({
  TenantContext: {
    getInstance: jest.fn(() => mockTenantContext),
  },
  createTenantMiddleware: jest.fn(),
  validateTenantAccess: jest.fn(),
  checkUsageLimit: jest.fn(() => Promise.resolve({ allowed: true, current: 10, limit: 100 })),
}))

// Fetch 모킹
global.fetch = jest.fn()

// Request/Response 모킹 (Node.js 환경용)
global.Request = jest.fn().mockImplementation((url, options = {}) => ({
  url,
  method: options.method || 'GET',
  headers: {
    get: jest.fn((name) => {
      if (name === 'host') {
        try {
          const urlObj = new URL(url)
          return urlObj.host
        } catch {
          return null
        }
      }
      return options.headers?.[name] || null
    }),
    ...options.headers,
  },
  ...options,
}))

global.Response = jest.fn().mockImplementation((body, options = {}) => ({
  body,
  status: options.status || 200,
  statusText: options.statusText || 'OK',
  headers: options.headers || {},
  ...options,
}))

// NextRequest 모킹 (Next.js 전용)
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url, options = {}) => {
    const mockHeaders = new Map()
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        mockHeaders.set(key.toLowerCase(), value)
      })
    }

    // Host 헤더 추가
    try {
      const urlObj = new URL(url)
      mockHeaders.set('host', urlObj.host)
    } catch {
      // URL 파싱 실패 시 무시
    }

    return {
      url,
      method: options.method || 'GET',
      headers: {
        get: jest.fn((name) => mockHeaders.get(name?.toLowerCase()) || null),
        has: jest.fn((name) => mockHeaders.has(name?.toLowerCase())),
        delete: jest.fn((name) => mockHeaders.delete(name?.toLowerCase())),
        set: jest.fn((name, value) => mockHeaders.set(name?.toLowerCase(), value)),
        entries: jest.fn(() => mockHeaders.entries()),
        forEach: jest.fn((callback) => mockHeaders.forEach(callback)),
      },
      body: options.body,
      json: jest.fn(() => Promise.resolve(JSON.parse(options.body || '{}'))),
      ...options,
    }
  }),
  NextResponse: {
    json: jest.fn((data, options = {}) => ({
      json: () => Promise.resolve(data),
      status: options.status || 200,
      ...options,
    })),
  },
}))

// ResizeObserver 모킹 (차트 테스트용)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// IntersectionObserver 모킹
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// matchMedia 모킹
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// console 출력 정리 (테스트 실행 시 깨끗한 출력)
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning: ReactDOM.render is deprecated')) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

// 각 테스트 후 정리
afterEach(() => {
  jest.clearAllMocks()
})
