# Thin backend (forward to Temporal)

This server is a **thin backend**: it receives frontend requests and forwards work to **Temporal**. It does not run pipelines or business logic itself.

## Flow

```
Frontend (5173)  →  Thin backend (8002)  →  Temporal (7233)  →  Worker
```

| Frontend action   | Backend route           | What it does |
|-------------------|-------------------------|--------------|
| New chat          | `POST /api/conversations` | Create conversation in memory only (no workflow). |
| Send message      | `POST /api/chat`        | Build payload from template → start Temporal workflow → wait for reply → return. |
| Upload documents  | `POST /api/documents/upload` | Start document ingestion workflow (payload from `upload.tpl`). |
| List pipelines   | `GET /api/pipelines`    | From env (`PIPELINE_OPTIONS`, `PIPELINE_OPTIONS_RAG`). |
| List conversations / messages | `GET /api/conversations*` | From in-memory (or file) store for UI only. |

## What lives here

- **routes/** – HTTP handlers; they call `temporal.js` and `templates.js`.
- **temporal.js** – Temporal client; starts workflows (chat, doc ingestion) and waits for chat result.
- **templates.js** – Loads payload templates from `TEMPLATES_DIR`, fills variables, returns payload for workflows.
- **store.js** – Minimal state for the UI (conversation list, message history) so we can build the next workflow payload and show history. Optional file persistence via `STORE_FILE`.

All real execution (LLM, RAG, ingestion) runs in the **Worker** via Temporal workflows.

## When are workflows created?

| Action | Workflow created? | Where |
|--------|--------------------|--------|
| **New chat** | No | Conversation is created in the in-memory store only. |
| **Send message** | Yes | `temporal.js` → `runChatPipeline()` → `client.workflow.start(workflowName, { taskQueue, workflowId, args: [payload] })` then `handle.result()`. Workflow name from `TEMPORAL_CHAT_WORKFLOW` (default `CoreWorkflow`). |
| **Upload documents** | Yes | `temporal.js` → `startDocumentIngestionWorkflow()` → `client.workflow.start(workflowName, ...)`. Workflow name from `TEMPORAL_DOC_WORKFLOW` (default `CoreWorkflow`). |

**How to verify:** With the backend running, send a chat message or upload a document. The server console will log e.g. `[Temporal] Started chat workflow: chat-llama-oss-1234567890 taskQueue: core-task-queue`. You can also open the Temporal Web UI (if you have it) and check for workflow runs with those IDs.

## Troubleshooting

- **Chat request times out or returns "Workflow did not complete within Xs"**  
  The backend starts the workflow then waits for its result. If no **Worker** is running on the same task queue (`TEMPORAL_TASK_QUEUE` / `TEMPORAL_WORKFLOW_CLASS`, e.g. `core-task-queue`) with the workflow name (e.g. `CoreWorkflowImpl`), the workflow never completes. Start your Orchestrator Worker so it polls that task queue and runs the workflow. You can lower the wait time with `TEMPORAL_CHAT_RESULT_TIMEOUT_MS` (default 120000 ms).
