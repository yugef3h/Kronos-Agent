import { Redis } from 'ioredis'

let client: Redis | undefined
let lastErrorLogAt = 0

const attachRedisErrorHandler = (redis: Redis, label: string): Redis => {
  redis.on('error', (error: Error) => {
    const now = Date.now()
    if (now - lastErrorLogAt < 10_000) {
      return
    }

    lastErrorLogAt = now
    console.warn(`[redis:${label}] ${error.message}`)
  })

  return redis
}

const createRedisOptions = () => ({
  maxRetriesPerRequest: 2,
  lazyConnect: true,
  retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 300, 3000)),
})

export const getRedisClient = (): Redis => {
  if (!client) {
    const url = process.env.REDIS_URL?.trim()
    if (!url) {
      throw new Error('REDIS_URL is required when using Redis-backed features')
    }

    client = attachRedisErrorHandler(new Redis(url, createRedisOptions()), 'main')
  }

  return client
}

/** duplicate 子连接也需 error handler，否则 ECONNREFUSED 会刷 Unhandled error event */
export const duplicateRedisClient = (): Redis =>
  attachRedisErrorHandler(getRedisClient().duplicate(), 'dup')

export const closeRedisClient = async (): Promise<void> => {
  if (!client) {
    return
  }

  await client.quit()
  client = undefined
}
