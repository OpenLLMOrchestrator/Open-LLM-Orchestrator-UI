/**
 * Payload templates from a mounted folder. File name: <pipeline>_<kind>.tpl
 * e.g. llama-oss_chat.tpl, rag-llama-oss_chat.tpl
 * All {{variable}} placeholders are replaced with provided values; result is parsed as JSON for Temporal.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getTemplatesDir() {
  const raw = process.env.TEMPLATES_DIR;
  if (raw && String(raw).trim()) {
    const p = String(raw).trim();
    const resolved = path.isAbsolute(p) ? p : path.join(__dirname, '..', p);
    if (fs.existsSync(resolved)) return resolved;
  }
  const fallback = path.join(__dirname, '..', 'templates-example');
  return fs.existsSync(fallback) ? fallback : null;
}

/**
 * Replace {{varName}} in template with values from vars. Values are inserted as-is
 * (use JSON.stringify for objects so the template stays valid JSON).
 */
function fillTemplate(templateStr, vars) {
  let out = templateStr;
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = `{{${key}}}`;
    const str = value === undefined || value === null ? '' : String(value);
    out = out.split(placeholder).join(str);
  }
  return out;
}

/**
 * Load template file. For chat: <pipeline>_chat.tpl. For upload: upload.tpl (single file).
 */
export function loadTemplate(pipelineId, kind = 'chat') {
  const dir = getTemplatesDir();
  if (!dir) return null;
  const fileName = kind === 'upload' ? 'upload.tpl' : `${(pipelineId || 'default').replace(/[^a-zA-Z0-9-_]/g, '_')}_${kind}.tpl`;
  const filePath = path.join(dir, fileName);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    console.warn(`Template load failed ${filePath}:`, err.message);
  }
  return null;
}

/**
 * Build chat payload for Temporal. Worker expects ExecutionCommand:
 * { tenantId, userId, operation, input, pipelineName, metadata [, debug, debugID ] }
 * Templates can use {{pipelineName}}, {{ragTag}}, {{messages}}, {{timestamp}}.
 * options.debug and options.debugID add debug fields when debug mode is on.
 */
export function getChatPayload(pipelineId, ragTag, messages, options = {}) {
  const timestamp = Date.now();
  const pipelineName = pipelineId || 'llama-oss';
  const vars = {
    pipelineName,
    ragTag: ragTag || '',
    messages: JSON.stringify(messages || []),
    timestamp,
  };

  const raw = loadTemplate(pipelineId, 'chat');
  if (raw) {
    try {
      const filled = fillTemplate(raw, vars);
      return toExecutionCommand(JSON.parse(filled), pipelineName, ragTag, messages, timestamp, options);
    } catch (err) {
      console.warn('Template fill/parse failed, using default payload:', err.message);
    }
  }

  return toExecutionCommand(null, pipelineName, ragTag, messages, timestamp, options);
}

/** Map payload to Worker ExecutionCommand format. */
function toExecutionCommand(raw, pipelineName, ragTag, messages, timestamp, options = {}) {
  const pn = raw?.pipelineName ?? raw?.pipelineId ?? pipelineName;
  const tenantId = raw?.tenantId ?? process.env.TEMPORAL_TENANT_ID ?? 'default';
  const userId = raw?.userId ?? process.env.TEMPORAL_USER_ID ?? 'default';
  const operation = raw?.operation ?? 'question-answer';
  const input = raw?.input ?? { messages: messages || [] };
  const metadata = raw?.metadata ?? { ragTag: ragTag || null, timestamp };
  const out = { tenantId, userId, operation, input, pipelineName: pn, metadata };
  if (options.debug && options.debugID) {
    out.debug = true;
    out.debugID = options.debugID;
  }
  return out;
}

/**
 * Build RAG upload (document ingestion) payload for Temporal: load upload.tpl,
 * fill variables, parse JSON. If no template exists, returns default payload.
 * options.debug and options.debugID add debug fields when debug mode is on.
 */
export function getUploadPayload(ragTag, fileNames, options = {}) {
  const timestamp = Date.now();
  const vars = {
    ragTag: ragTag || '',
    fileNames: JSON.stringify(fileNames || []),
    timestamp,
  };

  const raw = loadTemplate(null, 'upload');
  let out;
  if (raw) {
    try {
      const filled = fillTemplate(raw, vars);
      out = JSON.parse(filled);
    } catch (err) {
      console.warn('Upload template fill/parse failed, using default payload:', err.message);
      out = { ragTag: ragTag || null, fileNames: fileNames || [], timestamp };
    }
  } else {
    out = { ragTag: ragTag || null, fileNames: fileNames || [], timestamp };
  }
  if (options.debug && options.debugID) {
    out.debug = true;
    out.debugID = options.debugID;
  }
  return out;
}
