import { prisma } from '@/lib/db'

export type AdvisoryLockKey = {
  key1: number
  key2: number
}

export async function runWithAdvisoryLock<T>(
  key: AdvisoryLockKey,
  fn: () => Promise<T>
): Promise<{ acquired: boolean; result?: T }> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${key.key1}, ${key.key2}) AS acquired
      `

      const acquired = rows[0]?.acquired === true
      if (!acquired) {
        return { acquired: false }
      }

      const result = await fn()
      return { acquired: true, result }
    },
    {
      maxWait: 5000,
      timeout: 300000,
    }
  )
}
