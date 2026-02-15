/**
 * Redis-backed store. Two buckets: olo-ui:chat (non-RAG) and olo-ui:rag (RAG conversations).
 * listConversations(scope), createConversation(ragTag, pipelineId), getConversation(id),
 * getMessages(id, scope), addMessage(id, role, content, scope), etc.
 */
import { nanoid } from 'nanoid';
import { getRedisClient, KEYS } from './redis-client.js';

async function redis() {
  const c = getRedisClient();
  if (!c) return null;
  if (!c.isOpen) await c.connect();
  return c;
}

export async function listConversations(scope) {
  const r = await redis();
  if (!r || !scope) return [];
  const ids = await r.sMembers(KEYS.convIds(scope));
  if (ids.length === 0) return [];
  const list = [];
  for (const id of ids) {
    const raw = await r.get(KEYS.conv(scope, id));
    if (!raw) continue;
    try {
      list.push(JSON.parse(raw));
    } catch (_) {
      /* skip invalid */
    }
  }
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return list;
}

export async function getConversation(id) {
  const r = await redis();
  if (!r) return null;
  let raw = await r.get(KEYS.conv('chat', id));
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  raw = await r.get(KEYS.conv('rag', id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createConversation(ragTag, pipelineId) {
  const r = await redis();
  if (!r) return null;
  const scope = ragTag ? 'rag' : 'chat';
  const id = nanoid();
  const conv = {
    id,
    title: 'New chat',
    ragTag: ragTag || null,
    pipelineId: pipelineId || null,
    createdAt: new Date().toISOString(),
    bucket: scope,
  };
  await r.sAdd(KEYS.convIds(scope), id);
  await r.set(KEYS.conv(scope, id), JSON.stringify(conv));
  return conv;
}

export async function updateConversationTitle(id, title) {
  const r = await redis();
  if (!r) return null;
  for (const scope of ['chat', 'rag']) {
    const raw = await r.get(KEYS.conv(scope, id));
    if (raw) {
      const c = JSON.parse(raw);
      c.title = title;
      await r.set(KEYS.conv(scope, id), JSON.stringify(c));
      return c;
    }
  }
  return null;
}

export async function getMessages(conversationId, scope) {
  const r = await redis();
  if (!r) return [];
  if (scope) {
    const list = await r.lRange(KEYS.msgs(scope, conversationId), 0, -1);
    return list.map((s) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }
  for (const s of ['chat', 'rag']) {
    const list = await r.lRange(KEYS.msgs(s, conversationId), 0, -1);
    if (list.length > 0) {
      return list.map((str) => {
        try {
          return JSON.parse(str);
        } catch {
          return null;
        }
      }).filter(Boolean);
    }
  }
  return [];
}

export async function addMessage(conversationId, role, content, scope) {
  const r = await redis();
  if (!r) return null;
  const bucket = scope || (await getConversation(conversationId))?.bucket;
  if (!bucket) return null;
  const exists = await r.get(KEYS.conv(bucket, conversationId));
  if (!exists) return null;
  const msg = {
    id: nanoid(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  await r.rPush(KEYS.msgs(bucket, conversationId), JSON.stringify(msg));
  return msg;
}

export async function listRagTags() {
  const r = await redis();
  if (!r) return [];
  const tags = await r.sMembers(KEYS.ragTags());
  return tags.sort();
}

export async function registerRagTag(tag) {
  if (!tag || String(tag).trim() === '') return;
  const r = await redis();
  if (!r) return;
  await r.sAdd(KEYS.ragTags(), String(tag).trim());
}

export async function deleteConversation(id) {
  const r = await redis();
  if (!r) return false;
  for (const scope of ['chat', 'rag']) {
    const existed = await r.get(KEYS.conv(scope, id));
    if (existed) {
      await r.del(KEYS.conv(scope, id));
      await r.del(KEYS.msgs(scope, id));
      await r.sRem(KEYS.convIds(scope), id);
      return true;
    }
  }
  return false;
}
