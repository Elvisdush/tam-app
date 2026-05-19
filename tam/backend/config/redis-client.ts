/**
 * Redis Client Configuration
 * For distributed rate limiting and session storage
 */

import { existsSync } from 'fs';
import { createClient, type RedisClientType } from 'redis';

interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

const PLACEHOLDER_PASSWORDS = new Set([
  'your_redis_password_here',
  'your_secure_redis_password',
  'changeme',
]);

function resolveRedisPassword(config: RedisConfig): string | undefined {
  const raw = config.password ?? process.env.REDIS_PASSWORD;
  if (!raw || PLACEHOLDER_PASSWORDS.has(raw)) {
    return undefined;
  }
  return raw;
}

/** Docker Compose service name; only resolvable inside the compose network. */
function isRunningInDocker(): boolean {
  return (
    process.env.DOCKER === 'true' ||
    process.env.RUNNING_IN_DOCKER === 'true' ||
    existsSync('/.dockerenv')
  );
}

function resolveRedisHost(config: RedisConfig): string {
  const configured = config.host ?? process.env.REDIS_HOST ?? 'localhost';
  // .env often uses REDIS_HOST=redis for Docker; on the host machine use localhost.
  if (configured === 'redis' && !isRunningInDocker()) {
    return 'localhost';
  }
  return configured;
}

function getRedisEndpoint(config: RedisConfig = {}) {
  return {
    host: resolveRedisHost(config),
    port: config.port ?? parseInt(process.env.REDIS_PORT || '6379', 10),
  };
}

const createRedisClient = (config: RedisConfig = {}): RedisClientType => {
  const host = resolveRedisHost(config);
  const port = config.port || parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = resolveRedisPassword(config);
  const database = config.db ?? parseInt(process.env.REDIS_DB || '0', 10);

  const client = createClient({
    socket: {
      host,
      port,
      connectTimeout: 10000,
      reconnectStrategy: (retries, cause) => {
        const err = cause as NodeJS.ErrnoException | undefined;
        if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') {
          return false;
        }
        if (retries > 2) {
          return false;
        }
        return Math.min(retries * 200, 1000);
      },
    },
    password,
    database,
    disableOfflineQueue: true,
  });

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

export { createRedisClient, getRedisEndpoint, type RedisConfig };
