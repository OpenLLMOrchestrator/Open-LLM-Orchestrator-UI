import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { startDocumentIngestionWorkflow } from '../temporal.js';
import { registerRagTag, listRagTags } from '../store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

/**
 * GET /documents/rag-tags
 * List all RAG tags that have been used for uploads.
 */
router.get('/rag-tags', async (req, res) => {
  const tags = await listRagTags();
  res.json({ ragTags: tags });
});

/**
 * POST /documents/upload
 * Form: ragTag (string), files (one or more)
 * Uploads docs to Temporal with the given RAG tag.
 */
router.post('/upload', upload.array('files', 20), async (req, res) => {
  const ragTag = req.body?.ragTag ?? req.body?.tag ?? '';
  const tag = String(ragTag).trim();
  if (!tag) {
    return res.status(400).json({ error: 'ragTag (or tag) is required' });
  }

  const files = req.files ?? [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'At least one file is required' });
  }

  await registerRagTag(tag);
  const fileNames = files.map((f) => f.originalname || f.fieldname || 'file');

  const result = await startDocumentIngestionWorkflow(tag, fileNames);

  if (!result.started && result.error) {
    return res.status(502).json({
      error: 'Document ingestion could not be started.',
      detail: result.error,
      hint: 'Ensure Temporal server is running and CoreWorkflow is registered.',
    });
  }

  res.status(202).json({
    message: 'Upload accepted for processing',
    ragTag: tag,
    fileNames,
    workflowId: result.workflowId,
    runId: result.runId,
  });
});

export default router;
