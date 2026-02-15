import { Router } from 'express';
import {
  listConversations,
  createConversation,
  getConversation,
  updateConversationTitle,
  deleteConversation,
  getMessages,
} from '../store.js';

const router = Router();

router.get('/', async (req, res) => {
  const scope = req.query.scope === 'rag' ? 'rag' : 'chat';
  const list = await listConversations(scope);
  res.json({ conversations: list });
});

router.get('/:id', async (req, res) => {
  const conv = await getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  res.json(conv);
});

router.get('/:id/messages', async (req, res) => {
  const list = await getMessages(req.params.id);
  res.json({ messages: list });
});

/**
 * New chat: create conversation in store only. No workflow.
 * Workflow is started only when user sends a message (POST /api/chat).
 */
router.post('/', async (req, res) => {
  const ragTag = req.body?.ragTag ?? null;
  const pipelineId = req.body?.pipelineId ?? null;
  const conv = await createConversation(ragTag, pipelineId);
  res.status(201).json(conv);
});

router.patch('/:id', async (req, res) => {
  const { title } = req.body ?? {};
  if (title === undefined) return res.status(400).json({ error: 'title required' });
  const conv = await updateConversationTitle(req.params.id, title);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  res.json(conv);
});

router.delete('/:id', async (req, res) => {
  const ok = await deleteConversation(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Conversation not found' });
  res.status(204).send();
});

export default router;
