import { PrismaClient } from '@prisma/client'
import { createTenantMiddleware } from './tenant-middleware'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty',
  })

// 멀티테넌트 미들웨어 적용
if (!globalForPrisma.prisma) {
  createTenantMiddleware(prisma)
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 테넌트 컨텍스트 관리 함수들 export
export { TenantContext, validateTenantAccess, checkUsageLimit } from './tenant-middleware'
