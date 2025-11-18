import { PrismaClient } from '@prisma/client'
import { createTenantMiddleware } from './tenant-middleware'
import { createPrismaWithRLS } from './db/prisma-rls'

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaWithRLS> | undefined
}

// Base Prisma client
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: 'pretty',
})

// Apply RLS extension
export const prisma = globalForPrisma.prisma ?? createPrismaWithRLS(basePrisma)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 테넌트 컨텍스트 관리 함수들 export
export { TenantContext, validateTenantAccess, checkUsageLimit } from './tenant-middleware'

// RLS 헬퍼 함수들 export
export { withRLSContext, asServiceRole, asAuthenticatedUser, getRLSContext } from './db/prisma-rls'
