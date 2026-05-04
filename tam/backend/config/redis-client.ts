/**
 * Redis Client Configuration
 * For distributed rate limiting and session storage
 */

import { createClient, RedisClient } from 'redis';

interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

const createRedisClient = (config: RedisConfig = {}) => {
  const redisConfig = {
    host: config.host || process.env.REDIS_HOST || 'localhost',
    port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
    password: config.password || process.env.REDIS_PASSWORD,
    db: config.db || parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: config.keyPrefix || 'tam_app:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
  };

  const client: RedisClient = Redis.createClient(redisConfig);

  // Connection event handlers
  client.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  client.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
  });

  client.on('end', () => {
    console.log('🔌 Redis connection ended');
  });

  client.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });

  return client;
};

export { createRedisClient, type RedisConfig };
