/**
 * PixelManageAI — Redis Connection Factory
 *
 * Creates ioredis connections configured for BullMQ.
 * BullMQ requires separate connections for producers and consumers
 * (reusing one connection causes deadlocks on BLPOP).
 *
 * Connection count in production:
 *   API server:   1 per queue (2 total)
 *   Each worker:  1 consumer + 1 stall checker (2 per worker)
 *   Total (2 workers): ~6 Redis connections
 */

import Redis from "ioredis";

export function createRedisConnection(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST ?? "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false, // required by BullMQ
    lazyConnect: true,
  });
}
