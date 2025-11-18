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
 *
 * CRITICAL: Interactive Transaction을 사용하여 같은 커넥션에서 실행
 * - set_config()와 실제 쿼리를 같은 트랜잭션 세션에서 실행
 * - tx 객체를 통해 쿼리하여 RLS 정책 적용
 */
export function createPrismaWithRLS(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'rls-extension',
    client: {
      /**
       * RLS 컨텍스트 내에서 쿼리 실행
       * 내부적으로 트랜잭션을 사용하여 세션 변수 설정
       */
      async $withRLS<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        const context = getRLSContext()

        return (prisma as any).$transaction(async (tx: Prisma.TransactionClient) => {
          // 1. Set JWT claims as session variables
          if (context?.userId) {
            await tx.$executeRawUnsafe(
              `SELECT set_config('request.jwt.claim.sub', $1, true)`,
              context.userId
            )
          }

          if (context?.role) {
            await tx.$executeRawUnsafe(
              `SELECT set_config('request.jwt.claim.role', $1, true)`,
              context.role
            )
          }

          // 2. Execute user's query function on same transaction
          return fn(tx)
        })
      },
    },
    query: {
      async $allOperations({ operation, model, args, query }) {
        const context = getRLSContext()

        // RLS 컨텍스트가 없으면 그냥 실행
        if (!context) {
          return query(args)
        }

        // 트랜잭션으로 세션 변수 설정 후 쿼리 실행
        return (prisma as any).$transaction(async (tx: any) => {
          // 1. Set session variables on transaction connection
          if (context.userId) {
            await tx.$executeRawUnsafe(
              `SELECT set_config('request.jwt.claim.sub', $1, true)`,
              context.userId
            )
          }

          if (context.role) {
            await tx.$executeRawUnsafe(
              `SELECT set_config('request.jwt.claim.role', $1, true)`,
              context.role
            )
          }

          // 2. Execute query on SAME transaction connection
          if (!model) {
            return query(args)
          }

          const txModel = tx[model]
          if (!txModel || typeof txModel[operation] !== 'function') {
            return query(args)
          }

          return txModel[operation](args)
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
