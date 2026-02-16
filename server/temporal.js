/**
 * Temporal client: document ingestion and chat. Chat payload is built from
 * template files in TEMPLATES_DIR (<pipeline>_chat.tpl). Workflow name, ID, and
 * task queue (class) come from env.
 *
 * Flow: Chat → runChatPipeline() → getTemporalClient() → getChatPayload() → client.workflow.start() → handle.result().
 * Flow: Upload → startDocumentIngestionWorkflow() → getTemporalClient() → getUploadPayload() → client.workflow.start().
 */
import { Client, Connection } from '@temporalio/client';
import path from 'path';
import { fileURLToPath } from 'url';
import { getChatPayload, getUploadPayload } from './templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let temporalClient = null;

export async function getTemporalClient() {
  if (temporalClient) return temporalClient;
  try {
    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    const connection = await Connection.connect({ address });
    temporalClient = new Client({
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      connection,
    });
    return temporalClient;
  } catch (err) {
    console.warn('Temporal client not available:', err.message);
    return null;
  }
}

const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'core-task-queue';

function fillEnvTemplate(template, vars) {
  if (!template || typeof template !== 'string') return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v == null ? '' : String(v));
  }
  return out;
}

/**
 * Build SearchAttributes for Temporal UI columns (pipelineName, operation, tenantId, userId).
 * Values must be arrays for Keyword type. Omit keys with empty values so Temporal doesn't store nulls.
 */
function buildSearchAttributes({ pipelineName, operation, tenantId, userId }) {
  const attrs = {};
  if (pipelineName != null && String(pipelineName).trim()) attrs.pipelineName = [String(pipelineName).trim()];
  if (operation != null && String(operation).trim()) attrs.operation = [String(operation).trim()];
  if (tenantId != null && String(tenantId).trim()) attrs.tenantId = [String(tenantId).trim()];
  if (userId != null && String(userId).trim()) attrs.userId = [String(userId).trim()];
  return Object.keys(attrs).length ? attrs : undefined;
}

/**
 * Start document ingestion workflow: payload from upload.tpl, workflow name/ID/class from env.
 */
export async function startDocumentIngestionWorkflow(ragTag, fileNames) {
  const client = await getTemporalClient();
  if (!client) {
    return { started: false, workflowId: null, error: 'Temporal not configured' };
  }

  const payload = getUploadPayload(ragTag, fileNames);
  const timestamp = Date.now();
  const safeTag = (ragTag || 'default').replace(/[^a-zA-Z0-9-_]/g, '_');

  const raw = process.env.TEMPORAL_DOC_WORKFLOW || 'CoreWorkflow';
  const workflowNameTemplate = raw === 'chatPipelineWorkflow' || raw === 'documentIngestionWorkflow' ? 'CoreWorkflow' : raw;
  const workflowIdTemplate = process.env.TEMPORAL_DOC_WORKFLOW_ID_TEMPLATE || 'doc-ingest-{{ragTag}}-{{timestamp}}';
  const taskQueue = process.env.TEMPORAL_DOC_TASK_QUEUE || process.env.TEMPORAL_TASK_QUEUE || TASK_QUEUE;

  const workflowName = fillEnvTemplate(workflowNameTemplate, { ragTag: safeTag, timestamp });
  let workflowId = fillEnvTemplate(workflowIdTemplate, { ragTag: safeTag, timestamp });
  // Defensive: if template had a typo (e.g. {{ragTag}-{{timestamp}} missing }}), fix leftover placeholder
  if (workflowId.includes('{{ragTag}}') || workflowId.includes('{{ragTag}')) {
    workflowId = workflowId.replace(/\{\{ragTag\}\}/g, safeTag).replace(/\{\{ragTag\}(?!\})/g, safeTag);
  }

  const searchAttributes = buildSearchAttributes({
    pipelineName: payload.pipelineName ?? `doc-${safeTag}`,
    operation: payload.operation ?? 'documentIngestion',
    tenantId: payload.tenantId ?? process.env.TEMPORAL_TENANT_ID ?? 'default',
    userId: payload.userId ?? process.env.TEMPORAL_USER_ID ?? 'default',
  });

  console.log('[Temporal] Sending document ingestion — workflowName:', workflowName, 'workflowId:', workflowId, 'taskQueue:', taskQueue, 'searchAttributes:', searchAttributes, 'payload:', JSON.stringify(payload));

  try {
    const handle = await client.workflow.start(workflowName, {
      taskQueue,
      workflowId,
      args: [payload],
      ...(searchAttributes && { searchAttributes }),
    });
    console.log('[Temporal] Received document ingestion — workflowId:', handle.workflowId, 'runId:', handle.firstExecutionRunId);
    return { started: true, workflowId: handle.workflowId, runId: handle.firstExecutionRunId };
  } catch (err) {
    console.error('Temporal startDocumentIngestionWorkflow error:', err);
    return { started: false, workflowId, error: err.message };
  }
}

/**
 * Extract reply text from Worker result.
 * Handles: array of stages [{ stageName, data: { result, response } }], or { reply }, { response }, { result }, or string.
 */
function extractReply(result) {
  if (result == null) return 'No response.';
  if (typeof result === 'string') return result;
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0];
    const data = first?.data ?? first;
    const text = data?.response ?? data?.result ?? data?.reply;
    if (text != null && typeof text === 'string') return text;
    if (text != null) return String(text);
  }
  const text = result.reply ?? result.response ?? result.result;
  if (text != null && typeof text === 'string') return text;
  if (typeof text === 'object' && text?.response != null) return String(text.response);
  return JSON.stringify(result);
}

/**
 * Run chat: payload from template (TEMPLATES_DIR/<pipeline>_chat.tpl), workflow
 * name / ID / class from env. All template variables are filled and sent to Temporal.
 */
export async function runChatPipeline(pipelineId, ragTag, messages) {
  const client = await getTemporalClient();
  if (!client) {
    if (process.env.USE_STUB_LLM === '1') {
      const lastUser = messages.filter((m) => m.role === 'user').pop();
      const q = lastUser?.content ?? '';
      return { success: true, reply: `[Stub LLM] You said: "${q.slice(0, 100)}". Configure Temporal and templates for real responses.` };
    }
    return { success: false, reply: null, error: 'Temporal not configured. Set USE_STUB_LLM=1 for stub replies.' };
  }

  const timestamp = Date.now();
  const payload = getChatPayload(pipelineId, ragTag, messages);

  const raw = process.env.TEMPORAL_CHAT_WORKFLOW || 'CoreWorkflow';
  const workflowNameTemplate = raw === 'chatPipelineWorkflow' ? 'CoreWorkflow' : raw;
  const workflowIdTemplate = process.env.TEMPORAL_WORKFLOW_ID_TEMPLATE || 'chat-{{pipelineId}}-{{timestamp}}';
  const workflowClass = process.env.TEMPORAL_WORKFLOW_CLASS || process.env.TEMPORAL_TASK_QUEUE || TASK_QUEUE;

  const workflowName = fillEnvTemplate(workflowNameTemplate, { pipelineId: pipelineId || 'default', timestamp });
  const workflowId = fillEnvTemplate(workflowIdTemplate, { pipelineId: (pipelineId || 'default').replace(/[^a-zA-Z0-9-_]/g, '_'), timestamp });
  const taskQueue = fillEnvTemplate(workflowClass, { pipelineId: pipelineId || 'default', timestamp });

  const workflowResultTimeoutMs = Number(process.env.TEMPORAL_CHAT_RESULT_TIMEOUT_MS) || 120_000; // 2 min default

  const searchAttributes = buildSearchAttributes({
    pipelineName: payload.pipelineName ?? pipelineId ?? 'default',
    operation: payload.operation ?? 'chat',
    tenantId: payload.tenantId ?? 'default',
    userId: payload.userId ?? 'default',
  });

  console.log('[Temporal] Sending chat — workflowName:', workflowName, 'workflowId:', workflowId, 'taskQueue:', taskQueue, 'pipelineId:', pipelineId, 'ragTag:', ragTag ?? null, 'searchAttributes:', searchAttributes, 'payload:', JSON.stringify(payload));

  try {
    const handle = await client.workflow.start(workflowName, {
      taskQueue,
      workflowId,
      args: [payload],
      ...(searchAttributes && { searchAttributes }),
    });
    const result = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(
        () => reject(new Error(`Workflow did not complete within ${workflowResultTimeoutMs / 1000}s. Ensure a Worker is running on task queue "${taskQueue}" with workflow "${workflowName}".`)),
        workflowResultTimeoutMs
      );
      handle.result().then(
        (r) => {
          clearTimeout(timeoutId);
          resolve(r);
        },
        (err) => {
          clearTimeout(timeoutId);
          reject(err);
        }
      );
    });
    console.log('[Temporal] Received chat — workflowId:', handle.workflowId, 'result:', JSON.stringify(result));
    const reply = extractReply(result);
    return { success: true, reply };
  } catch (err) {
    console.error('Temporal runChatPipeline error:', err);
    return { success: false, reply: null, error: err.message };
  }
}
