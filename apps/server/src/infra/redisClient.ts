import Redis from 'ioredis'

let client: Redis | undefined

export const getRedisClient = (): Redis => {
  if (!client) {
    const url = process.env.REDIS_URL?.trim()
    if (!url) {
      throw new Error('REDIS_URL is required when WORKFLOW_RUN_STORE=redis')
    }

    client = new Redis(url, { maxRetriesPerRequest: 2 })
  }

  return client
}

export const closeRedisClient = async (): Promise<void> => {
  if (!client) {
    return
  }

  await client.quit()
  client = undefined
}
