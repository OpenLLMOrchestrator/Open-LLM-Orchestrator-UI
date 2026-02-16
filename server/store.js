/**
 * Store for conversations and messages.
 * - If REDIS_URL or REDIS_HOST is set: uses Redis (olo-ui:chat and olo-ui:rag buckets).
 * - Otherwise: in-memory with optional file persistence (STORE_FILE).
 * All exports are async; use await in callers.
 */
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isRedisEnabled, connectRedis } from './redis-client.js';
import * as redisStore from './store-redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const conversations = new Map();
const messages = new Map();
const ragTags = new Set();

const STORE_FILE = process.env.STORE_FILE
  ? path.isAbsolute(process.env.STORE_FILE)
    ? process.env.STORE_FILE
    : path.join(__dirname, '..', process.env.STORE_FILE)
  : null;

function persist() {
  if (!STORE_FILE) return;
  try {
    const dir = path.dirname(STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = {
      conversations: Array.from(conversations.values()),
      messages: Object.fromEntries(messages),
      ragTags: Array.from(ragTags),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('Store persist failed:', err.message);
  }
}

function load() {
  if (!STORE_FILE || !fs.existsSync(STORE_FILE)) return;
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const data = JSON.parse(raw);
    (data.conversations || []).forEach((c) => conversations.set(c.id, c));
    Object.entries(data.messages || {}).forEach(([k, v]) => messages.set(k, v));
    (data.ragTags || []).forEach((t) => ragTags.add(t));
  } catch (err) {
    console.warn('Store load failed:', err.message);
  }
}

load();

async function useRedis() {
  if (!isRedisEnabled()) return false;
  try {
    await connectRedis();
    return true;
  } catch (err) {
    console.warn('[Store] Redis connect failed, using memory:', err.message);
    return false;
  }
}

let redisChecked = false;
let useRedisStore = false;

async function ensureBackend() {
  if (!redisChecked) {
    useRedisStore = await useRedis();
    redisChecked = true;
  }
  if (useRedisStore) return redisStore;
  return null;
}

/** scope: 'chat' | 'rag' — which bucket to list (Chat tab vs RAG tab). Latest first. */
export async function listConversations(scope) {
  const r = await ensureBackend();
  if (r) return r.listConversations(scope);
  const all = Array.from(conversations.values());
  let list = scope === 'chat' ? all.filter((c) => !c.ragTag || c.ragTag === '') : scope === 'rag' ? all.filter((c) => c.ragTag != null && c.ragTag !== '') : all;
  list = list.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return list;
}

export async function getConversation(id) {
  const r = await ensureBackend();
  if (r) return r.getConversation(id);
  return conversations.get(id) ?? null;
}

export async function createConversation(ragTag, pipelineId) {
  const r = await ensureBackend();
  if (r) return r.createConversation(ragTag, pipelineId);
  const id = nanoid();
  const conv = {
    id,
    title: 'New chat',
    ragTag: ragTag || null,
    pipelineId: pipelineId || null,
    createdAt: new Date().toISOString(),
  };
  conversations.set(id, conv);
  messages.set(id, []);
  persist();
  return conv;
}

export async function updateConversationTitle(id, title) {
  const r = await ensureBackend();
  if (r) return r.updateConversationTitle(id, title);
  const c = conversations.get(id);
  if (!c) return null;
  c.title = title;
  persist();
  return c;
}

export async function getMessages(conversationId) {
  const r = await ensureBackend();
  if (r) {
    const conv = await r.getConversation(conversationId);
    return r.getMessages(conversationId, conv?.bucket);
  }
  return messages.get(conversationId) ?? [];
}

export async function addMessage(conversationId, role, content) {
  const r = await ensureBackend();
  if (r) return r.addMessage(conversationId, role, content);
  const list = messages.get(conversationId);
  if (!list) return null;
  const msg = {
    id: nanoid(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  list.push(msg);
  persist();
  return msg;
}

export async function listRagTags() {
  const r = await ensureBackend();
  if (r) return r.listRagTags();
  return Array.from(ragTags).sort();
}

export async function registerRagTag(tag) {
  if (!tag || String(tag).trim() === '') return;
  const r = await ensureBackend();
  if (r) return r.registerRagTag(tag);
  ragTags.add(String(tag).trim());
  persist();
}

export async function deleteConversation(id) {
  const r = await ensureBackend();
  if (r) return r.deleteConversation(id);
  const had = conversations.has(id);
  conversations.delete(id);
  messages.delete(id);
  persist();
  return had;
}

/** Clear all Redis data for olo-ui (conversations, messages, rag tags). Returns { cleared, keysDeleted } when Redis; otherwise { cleared: false, keysDeleted: 0 }. */
export async function clearAllStore() {
  const r = await ensureBackend();
  if (r && r.clearAll) return r.clearAll();
  return { cleared: false, keysDeleted: 0 };
}
