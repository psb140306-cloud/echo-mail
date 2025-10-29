import Redis from 'ioredis'

// Redis 연결 설정
const getRedisUrl = (): string | null => {
  const url = process.env.REDIS_URL
  if (!url) {
    console.warn('⚠️ REDIS_URL environment variable is not set - Redis features will be disabled')
    return null
  }
  return url
}

// Redis 사용 가능 여부 확인
const redisUrl = getRedisUrl()
export const isRedisAvailable = !!redisUrl

// Redis 클라이언트 인스턴스 생성 (Redis가 설정된 경우에만)
export const redis = redisUrl
  ? new Redis(redisUrl, {
      // 연결 설정
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true,

      // 타임아웃 설정
      connectTimeout: 10000,
      commandTimeout: 5000,

      // 재연결 설정
      retryDelayOnReconnect: 200,

      // 로그 설정
      onConnect: () => {
        console.log('✅ Redis 연결 성공')
      },
      onError: (error) => {
        console.error('❌ Redis 연결 오류:', error)
      },
      onReconnecting: () => {
        console.log('🔄 Redis 재연결 시도 중...')
      },
    })
  : null

// Bull 큐를 위한 별도 Redis 인스턴스
export const queueRedis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryDelayOnFailover: 100,
    })
  : null

// Redis 연결 상태 확인
export const checkRedisConnection = async (): Promise<boolean> => {
  if (!redis) return false
  try {
    const result = await redis.ping()
    return result === 'PONG'
  } catch (error) {
    console.error('Redis 연결 확인 실패:', error)
    return false
  }
}

// 캐시 헬퍼 함수들
export const cache = {
  // 값 저장 (TTL: 초 단위)
  set: async (key: string, value: any, ttl?: number): Promise<void> => {
    if (!redis) return
    const serialized = JSON.stringify(value)
    if (ttl) {
      await redis.setex(key, ttl, serialized)
    } else {
      await redis.set(key, serialized)
    }
  },

  // 값 조회
  get: async <T = any>(key: string): Promise<T | null> => {
    if (!redis) return null
    const cached = await redis.get(key)
    if (!cached) return null

    try {
      return JSON.parse(cached) as T
    } catch (error) {
      console.error('캐시 파싱 오류:', error)
      return null
    }
  },

  // 값 삭제
  del: async (key: string): Promise<void> => {
    if (!redis) return
    await redis.del(key)
  },

  // 키 존재 여부 확인
  exists: async (key: string): Promise<boolean> => {
    if (!redis) return false
    const result = await redis.exists(key)
    return result === 1
  },

  // TTL 설정
  expire: async (key: string, ttl: number): Promise<void> => {
    if (!redis) return
    await redis.expire(key, ttl)
  },

  // 패턴으로 키 삭제
  deletePattern: async (pattern: string): Promise<void> => {
    if (!redis) return
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  },

  // 해시 저장
  hset: async (key: string, field: string, value: any): Promise<void> => {
    if (!redis) return
    await redis.hset(key, field, JSON.stringify(value))
  },

  // 해시 조회
  hget: async <T = any>(key: string, field: string): Promise<T | null> => {
    if (!redis) return null
    const cached = await redis.hget(key, field)
    if (!cached) return null

    try {
      return JSON.parse(cached) as T
    } catch (error) {
      console.error('해시 캐시 파싱 오류:', error)
      return null
    }
  },

  // 해시 전체 조회
  hgetall: async <T = Record<string, any>>(key: string): Promise<T | null> => {
    if (!redis) return null
    const cached = await redis.hgetall(key)
    if (!cached || Object.keys(cached).length === 0) return null

    try {
      const result: Record<string, any> = {}
      for (const [field, value] of Object.entries(cached)) {
        result[field] = JSON.parse(value)
      }
      return result as T
    } catch (error) {
      console.error('해시 전체 캐시 파싱 오류:', error)
      return null
    }
  },

  // 리스트에 추가 (왼쪽)
  lpush: async (key: string, value: any): Promise<void> => {
    if (!redis) return
    await redis.lpush(key, JSON.stringify(value))
  },

  // 리스트에서 제거 (오른쪽)
  rpop: async <T = any>(key: string): Promise<T | null> => {
    if (!redis) return null
    const cached = await redis.rpop(key)
    if (!cached) return null

    try {
      return JSON.parse(cached) as T
    } catch (error) {
      console.error('리스트 캐시 파싱 오류:', error)
      return null
    }
  },

  // 리스트 길이 조회
  llen: async (key: string): Promise<number> => {
    if (!redis) return 0
    return await redis.llen(key)
  },
}

// 세션 관리 헬퍼
export const session = {
  // 세션 저장 (기본 TTL: 7일)
  set: async (sessionId: string, data: any, ttl: number = 7 * 24 * 60 * 60): Promise<void> => {
    await cache.set(`session:${sessionId}`, data, ttl)
  },

  // 세션 조회
  get: async <T = any>(sessionId: string): Promise<T | null> => {
    return await cache.get<T>(`session:${sessionId}`)
  },

  // 세션 삭제
  destroy: async (sessionId: string): Promise<void> => {
    await cache.del(`session:${sessionId}`)
  },

  // 사용자의 모든 세션 삭제
  destroyUserSessions: async (userId: string): Promise<void> => {
    await cache.deletePattern(`session:*:${userId}`)
  },
}

// 속도 제한 헬퍼
export const rateLimit = {
  // 속도 제한 확인 및 적용
  check: async (
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> => {
    // Redis가 없으면 항상 허용
    if (!redis) {
      return {
        allowed: true,
        remaining: limit,
        resetTime: new Date(Date.now() + windowMs),
      }
    }

    const now = Date.now()
    const window = Math.floor(now / windowMs)
    const rateLimitKey = `rate_limit:${key}:${window}`

    const current = await redis.incr(rateLimitKey)

    if (current === 1) {
      await redis.expire(rateLimitKey, Math.ceil(windowMs / 1000))
    }

    const remaining = Math.max(0, limit - current)
    const resetTime = new Date((window + 1) * windowMs)

    return {
      allowed: current <= limit,
      remaining,
      resetTime,
    }
  },
}

// 분산 락 헬퍼
export const lock = {
  // 락 획득
  acquire: async (
    key: string,
    ttl: number = 30,
    identifier: string = Math.random().toString(36)
  ): Promise<string | null> => {
    if (!redis) return identifier // Redis가 없으면 바로 락 획득
    const lockKey = `lock:${key}`
    const result = await redis.set(lockKey, identifier, 'PX', ttl * 1000, 'NX')

    return result === 'OK' ? identifier : null
  },

  // 락 해제
  release: async (key: string, identifier: string): Promise<boolean> => {
    if (!redis) return true // Redis가 없으면 바로 성공
    const lockKey = `lock:${key}`
    const script = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `

    const result = await redis.eval(script, 1, lockKey, identifier)
    return result === 1
  },
}

// Redis 정리 (테스트용)
export const cleanup = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'test' && redis) {
    await redis.flushdb()
  }
}

export default redis
