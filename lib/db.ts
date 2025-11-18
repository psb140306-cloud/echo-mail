import { PrismaClient } from '@prisma/client'
import { createTenantMiddleware } from './tenant-middleware'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prisma client - postgres 유저로 직접 연결 (RLS 우회)
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty',
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 테넌트 컨텍스트 관리 함수들 export
export { TenantContext, validateTenantAccess, checkUsageLimit } from './tenant-middleware'
