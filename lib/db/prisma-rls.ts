import { Prisma, PrismaClient } from '@prisma/client'
import { AsyncLocalStorage } from 'async_hooks'

/**
 * RLS (Row Level Security) 세션 컨텍스트
 * Prisma 쿼리 실행 전에 Postgres 세션 변수 설정
 */
interface RLSContext {
  userId?: string
  role?: 'authenticated' | 'service_role' | 'anon'
}

// AsyncLocalStorage for RLS context
const rlsStorage = new AsyncLocalStorage<RLSContext>()

/**
 * RLS 컨텍스트 가져오기
 */
export function getRLSContext(): RLSContext | undefined {
  return rlsStorage.getStore()
}

/**
 * RLS 컨텍스트 설정하여 함수 실행
 */
export function withRLSContext<T>(context: RLSContext, fn: () => T): T {
  return rlsStorage.run(context, fn)
}

/**
 * Prisma에 RLS 세션 주입
 * 모든 쿼리 실행 전에 request.jwt.claim.* 세션 변수 설정
 */
export function createPrismaWithRLS(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'rls-extension',
    query: {
      async $allOperations({ operation, model, args, query }) {
        const context = getRLSContext()

        // RLS 컨텍스트가 없으면 그냥 실행 (service role)
        if (!context) {
          return query(args)
        }

        // 트랜잭션 시작하여 세션 변수 설정 후 쿼리 실행
        return prisma.$transaction(async (tx) => {
          // 1. Set JWT claims as session variables
          if (context.userId) {
            await (tx as any)
              .$executeRawUnsafe(`SELECT set_config('request.jwt.claim.sub', '${context.userId}', true)`)
          }

          if (context.role) {
            await (tx as any)
              .$executeRawUnsafe(`SELECT set_config('request.jwt.claim.role', '${context.role}', true)`)
          }

          // 2. Execute the actual query
          // Note: We need to use the original query here, not tx
          // because query is already bound to the right context
          return query(args)
        })
      },
    },
  })
}

/**
 * Service role로 쿼리 실행 (RLS bypass)
 */
export function asServiceRole<T>(fn: () => T): T {
  return withRLSContext({ role: 'service_role' }, fn)
}

/**
 * 인증된 사용자로 쿼리 실행
 */
export function asAuthenticatedUser<T>(userId: string, fn: () => T): T {
  return withRLSContext({ userId, role: 'authenticated' }, fn)
}
