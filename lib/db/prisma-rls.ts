import { PrismaClient, Prisma } from '@prisma/client'
import { AsyncLocalStorage } from 'async_hooks'

interface RLSContext {
  userId?: string
  role?: 'authenticated' | 'service_role' | 'anon'
}

const rlsStorage = new AsyncLocalStorage<RLSContext>()

export function getRLSContext(): RLSContext | undefined {
  return rlsStorage.getStore()
}

export function withRLSContext<T>(context: RLSContext, fn: () => T): T {
  return rlsStorage.run(context, fn)
}

export function createPrismaWithRLS(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'rls-extension',
    client: {
      async $withRLS<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
        const context = getRLSContext()
        return prisma.$transaction(async (tx) => {
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
          return fn(tx)
        })
      },
    },
    query: {
      async $allOperations({ operation, model, args, query }) {
        const context = getRLSContext()
        if (!context || !model) {
          return query(args)
        }

        return prisma.$transaction(async (tx) => {
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

          const txModel = (tx as any)[model]
          if (!txModel || typeof txModel[operation] !== 'function') {
            return query(args)
          }

          return txModel[operation](args)
        })
      },
    },
  })
}

export function asServiceRole<T>(fn: () => T): T {
  return withRLSContext({ role: 'service_role' }, fn)
}

export function asAuthenticatedUser<T>(userId: string, fn: () => T): T {
  return withRLSContext({ userId, role: 'authenticated' }, fn)
}
