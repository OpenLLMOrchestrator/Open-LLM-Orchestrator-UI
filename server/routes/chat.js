import { Router } from 'express';
import { getConversation, getMessages, addMessage, updateConversationTitle } from '../store.js';
import { runChatPipeline } from '../temporal.js';

const router = Router();

/**
 * POST /api/chat (router mounted at /api/chat; path may be '/' or '' depending on Express)
 * Body: { conversationId, content }
 * On user input: build payload from template, start Temporal workflow, wait for response, return reply.
 */
const handlePost = async (req, res) => {
  const { conversationId, content } = req.body ?? {};
  if (!conversationId || content == null || String(content).trim() === '') {
    return res.status(400).json({ error: 'conversationId and content required' });
  }

  const conv = await getConversation(conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const userContent = String(content).trim();
  await addMessage(conversationId, 'user', userContent);

  const history = await getMessages(conversationId);
  const messagesForLlm = history.map((m) => ({ role: m.role, content: m.content }));

  const pipelineId = conv.pipelineId ?? null;
  const ragTag = conv.ragTag ?? null;
  // Start workflow using template payload and wait for reply
  const result = await runChatPipeline(pipelineId, ragTag, messagesForLlm);

  let assistantContent;
  if (result.success && result.reply) {
    assistantContent = result.reply;
  } else {
    assistantContent = result.error
      ? `[Pipeline error: ${result.error}]`
      : 'Sorry, I could not generate a response. Check that Temporal and your LLM/RAG workers are running.';
  }

  await addMessage(conversationId, 'assistant', assistantContent);

  if (conv.title === 'New chat' && history.length <= 1) {
    const firstLine = userContent.split('\n')[0].slice(0, 50);
    await updateConversationTitle(conversationId, firstLine || 'New chat');
  }

  res.json({
    message: { role: 'assistant', content: assistantContent },
    pipelineId: pipelineId || 'llm',
    ragTag: ragTag || null,
  });
};
router.post('/', handlePost);
router.post('', handlePost);

export default router;
