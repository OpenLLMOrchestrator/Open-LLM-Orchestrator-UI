/**
 * Thin backend: forwards frontend requests to Temporal.
 * - Serves the built frontend (dist/) and API routes.
 * - API only keeps minimal UI state (conversations, messages); all execution is in Temporal.
 */
import { config as loadEnv } from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import conversationsRouter from './routes/conversations.js';
import chatRouter from './routes/chat.js';
import documentsRouter from './routes/documents.js';
import pipelinesRouter from './routes/pipelines.js';
import storeRouter from './routes/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from project root so behaviour matches container (same env source regardless of cwd)
const projectRoot = path.resolve(__dirname, '..');
loadEnv({ path: path.join(projectRoot, '.env') });

const PORT = process.env.PORT || 8002;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API: thin layer → forward to Temporal (templates + temporal.js)
app.use('/api/conversations', conversationsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/pipelines', pipelinesRouter);
app.use('/api/store', storeRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// 404 for unknown API routes (so we always return JSON, not HTML)
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found', path: req.path }));

// Static frontend (production)
const clientDist = path.join(__dirname, '..', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Thin backend: http://localhost:${PORT} (forwards to Temporal)`);
});
