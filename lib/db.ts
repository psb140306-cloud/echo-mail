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

// 멀티테넌트 미들웨어는 런타임에서만 적용 (빌드 시점 제외)
// Prisma 6에서는 $use가 지원되지 않으므로 임시로 비활성화
// TODO: Prisma 6의 $extends를 사용하도록 마이그레이션 필요
// if (!globalForPrisma.prisma && process.env.NODE_ENV === 'development') {
//   createTenantMiddleware(prisma)
// }

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 테넌트 컨텍스트 관리 함수들 export
export { TenantContext, validateTenantAccess, checkUsageLimit } from './tenant-middleware'
