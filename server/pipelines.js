/**
 * Two separate pipeline sets: chat (no RAG) and RAG. Chat tab shows chat pipelines;
 * RAG tab shows RAG pipelines and requires a RAG scope (tag).
 * Env override format: id:Label,id2:Label2 (comma-separated).
 */
const DEFAULT_PIPELINES = [
  { id: 'llama-oss', label: 'Llama OSS' },
  { id: 'openai-oss', label: 'OpenAI OSS' },
  { id: 'both', label: 'Both models' },
  { id: 'chat-mistral', label: 'Mistral' },
  { id: 'chat-llama3.2', label: 'Llama 3.2' },
  { id: 'chat-phi3', label: 'Phi-3' },
  { id: 'chat-gemma2-2b', label: 'Gemma 2 2B' },
  { id: 'chat-qwen2-1.5b', label: 'Qwen2 1.5B' },
  { id: 'query-all-models', label: 'Query all models' },
];

const DEFAULT_PIPELINES_RAG = [
  { id: 'question-answer', label: 'Question-Answer (RAG)' },
  { id: 'rag-llama-oss', label: 'RAG Llama OSS' },
  { id: 'rag-openai-oss', label: 'RAG OpenAI OSS' },
  { id: 'rag-both', label: 'RAG Both models' },
  { id: 'rag-mistral', label: 'RAG Mistral' },
  { id: 'rag-llama3.2', label: 'RAG Llama 3.2' },
  { id: 'rag-phi3', label: 'RAG Phi-3' },
  { id: 'rag-gemma2-2b', label: 'RAG Gemma 2 2B' },
  { id: 'rag-qwen2-1.5b', label: 'RAG Qwen2 1.5B' },
];

function parsePipelineOptions(raw, defaults) {
  if (!raw || String(raw).trim() === '') return defaults;
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.indexOf(':');
      if (i > 0) {
        return { id: s.slice(0, i).trim(), label: s.slice(i + 1).trim() };
      }
      return { id: s, label: s };
    })
    .filter((p) => p.id);
}

let cached = null;
let cachedRag = null;

export function getPipelines() {
  if (cached) return cached;
  cached = parsePipelineOptions(process.env.PIPELINE_OPTIONS, DEFAULT_PIPELINES);
  return cached;
}

export function getPipelinesRag() {
  if (cachedRag) return cachedRag;
  cachedRag = parsePipelineOptions(process.env.PIPELINE_OPTIONS_RAG, DEFAULT_PIPELINES_RAG);
  return cachedRag;
}
