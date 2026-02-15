/**
 * Redis client for UI store. Two buckets: olo-ui:chat (non-RAG) and olo-ui:rag (RAG conversations).
 * Set REDIS_URL or REDIS_HOST (and optionally REDIS_PORT, REDIS_PASSWORD) to enable.
 */
import { createClient } from 'redis';

const REDIS_BASE = 'olo-ui';
const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let client = null;

export function getRedisClient() {
  if (client) return client;
  if (!REDIS_URL && !REDIS_HOST) return null;
  const options = REDIS_URL
    ? { url: REDIS_URL }
    : { socket: { host: REDIS_HOST, port: REDIS_PORT }, password: REDIS_PASSWORD };
  client = createClient(options);
  client.on('error', (err) => console.warn('[Redis]', err.message));
  return client;
}

export async function connectRedis() {
  const c = getRedisClient();
  if (!c) return null;
  if (!c.isOpen) await c.connect();
  return c;
}

export function isRedisEnabled() {
  return !!(REDIS_URL || REDIS_HOST);
}

/** scope: 'chat' | 'rag' */
function key(scope, ...parts) {
  return [REDIS_BASE, scope, ...parts].join(':');
}

export const KEYS = {
  convIds: (scope) => key(scope, 'conv', 'ids'),
  conv: (scope, id) => key(scope, 'conv', id),
  msgs: (scope, convId) => key(scope, 'msgs', convId),
  ragTags: () => key('rag', 'tags'),
};
