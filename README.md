# Open LLM Orchestrator UI

A ChatGPT-like Node.js web UI with:

- **Multiple chat conversations** – Create and switch between different chats.
- **Two pipeline sets** – **Non-RAG**: Llama OSS, OpenAI OSS, Both models. **RAG** (when you pick a tag): separate RAG pipelines (e.g. RAG Llama OSS, RAG OpenAI OSS, RAG Both). Choosing a RAG scope switches the dropdown to the RAG flow.
- **Documents tab** – Upload files with a **RAG tag**; that tag is the vector scope when you chat with RAG enabled.
- **Session persistence** – UI state (pipeline, RAG scope, tab, current conversation) is stored in **localStorage**. Optional **file store** (`STORE_FILE`) persists conversations and messages on the server.
- **Thin backend** – The server in `server/` only forwards frontend requests to **Temporal** (workflows); see `server/README.md`.

## Quick start

```bash
npm install
```

**Development** (API on port 8002, Vite dev server on 5173):

```bash
npm run dev
```

Open **http://localhost:5173**. The frontend proxies `/api` to the backend at port 8002.

**Why does the browser call `http://localhost:5173/api/...`?** The app uses relative URLs (`/api`), so the request goes to the same host as the page (5173). Vite’s dev server then **proxies** that request to the backend on port 8002. So the backend does not run on 5173—it runs on 8002; the proxy forwards requests.

**Alternative (no proxy):** In `.env` set `VITE_API_URL=http://localhost:8002`. Then the app will call the backend directly at 8002. Start the backend first (`npm run dev:server`), then the client (`npm run dev:client`). No need to run both via `npm run dev` for the proxy to work.

If you get **404 on `/api/conversations`**: the backend is not running on 8002 (or the proxy target). Start it with `npm run dev:server`, or set `VITE_API_URL=http://localhost:8002` and start the backend, then the client.

**Production** (build frontend and serve from Node):

```bash
npm run build
npm start
```

Open **http://localhost:8002**.

**Ports:** App server = **8002**, Temporal gRPC = **7233**.

## Environment

Configuration is loaded from a **`.env`** file in the project root. Copy the example and edit as needed:

```bash
# Linux/macOS
cp .env.example .env
# Windows (PowerShell)
copy .env.example .env
```

| Variable | Description |
|----------|-------------|
| `PORT` | App server port (default `8002`) |
| `TEMPORAL_ADDRESS` | Temporal gRPC address (default `localhost:7233`) |
| `TEMPORAL_NAMESPACE` | Temporal namespace (default `default`) |
| `TEMPORAL_TASK_QUEUE` | Task queue for workflows; must match Worker `QUEUE_NAME` (default `core-task-queue`) |
| `USE_STUB_LLM` | Set to `1` to get stub replies when Temporal is not configured |
| `PIPELINE_OPTIONS` | Non-RAG pipelines. Default: Llama OSS, OpenAI OSS, Both. |
| `PIPELINE_OPTIONS_RAG` | RAG pipelines (used when a RAG tag is selected). Default: RAG Llama OSS, RAG OpenAI OSS, RAG Both. |
| `TEMPLATES_DIR` | Mounted folder for templates: `<pipeline>_chat.tpl` and `upload.tpl`. All `{{variable}}` parts are filled and submitted to Temporal. |
| `TEMPORAL_CHAT_WORKFLOW` | Workflow name for chat (default `CoreWorkflow`). |
| `TEMPORAL_WORKFLOW_ID_TEMPLATE` | Workflow ID template for chat, e.g. `chat-{{pipelineId}}-{{timestamp}}`. |
| `TEMPORAL_WORKFLOW_CLASS` | Task queue (class) for chat workflows (default: `TEMPORAL_TASK_QUEUE`). |
| `TEMPORAL_DOC_WORKFLOW` | Workflow name for RAG upload (default `CoreWorkflow`). |
| `TEMPORAL_DOC_WORKFLOW_ID_TEMPLATE` | Workflow ID template for upload, e.g. `doc-ingest-{{ragTag}}-{{timestamp}}`. |
| `TEMPORAL_DOC_TASK_QUEUE` | Task queue for doc workflow (default: `TEMPORAL_TASK_QUEUE`). |
| `STORE_FILE` | Optional path to persist conversations/messages when **not** using Redis (e.g. `data/store.json`). |
| `REDIS_URL` or `REDIS_HOST` | When set, conversations and messages are stored in **Redis** in two buckets: `olo-ui:chat` (Chat tab history) and `olo-ui:rag` (RAG tab history). Delete conversation removes it from Redis. |
| `REDIS_PORT` | Redis port (default `6379`). Used when `REDIS_HOST` is set. |
| `REDIS_PASSWORD` | Optional Redis password. |

The default `.env.example` uses **localhost** for Temporal (`TEMPORAL_ADDRESS=localhost:7233`). Change it in `.env` if your Temporal server runs elsewhere.

Without Temporal, chat will return an error unless `USE_STUB_LLM=1` is set (for testing the UI).

## Temporal workflows

- **New chat** – Creates a conversation in local store only. No workflow.
- **Send message** – Starts a Temporal workflow using the payload from `<pipeline>_chat.tpl`, waits for the response, and returns the reply to the UI.
- **Upload documents** – Starts `CoreWorkflow` (payload from `upload.tpl`).

**Chat workflow** (`TEMPORAL_CHAT_WORKFLOW`, default `CoreWorkflow`): started when the user sends input text. Payload is built from the template; the API waits for the workflow result and returns the reply.

### Payload templates (mounted folder)

Set **`TEMPLATES_DIR`** to a mounted folder containing:

- **Chat:** `<pipeline>_chat.tpl` (e.g. `llama-oss_chat.tpl`, `rag-llama-oss_chat.tpl`).
- **RAG upload:** `upload.tpl` (single template for document ingestion).

Each file is JSON with `{{variable}}` placeholders; they are replaced and the result is sent to Temporal.

**Chat template variables:** `{{pipelineId}}`, `{{ragTag}}`, `{{messages}}` (JSON array string), `{{timestamp}}`.

**Upload template variables:** `{{ragTag}}`, `{{fileNames}}` (JSON array string), `{{timestamp}}`.

Example `llama-oss_chat.tpl`:

```json
{"pipelineId":"{{pipelineId}}","ragTag":"{{ragTag}}","messages":{{messages}},"timestamp":{{timestamp}}}
```

Example `upload.tpl`:

```json
{"ragTag":"{{ragTag}}","fileNames":{{fileNames}},"timestamp":{{timestamp}}}
```

If a template file is missing, a default payload object is used. See `templates-example/` in the repo.

## How to use

1. **Documents** tab: Enter a **RAG tag**, choose files, and click **Upload to Temporal**. That tag is the vector scope for RAG in Chat.
2. **Chat** tab: Choose **RAG scope** first (None or a tag). Pipeline dropdown shows **non-RAG** pipelines when None, or **RAG** pipelines when a tag is selected. Then start a new chat.
3. Click **New chat**, then send messages. Your pipeline and RAG selection are saved in the browser (localStorage) and restored on reload. Set `STORE_FILE=data/store.json` to persist conversations on the server.

## Docker

**Build and run locally:**

```bash
docker build -t open-llm-orchestrator-ui .
docker run -p 8002:8002 --env-file .env open-llm-orchestrator-ui
```

Open **http://localhost:8002**. Pass env vars or mount a `.env` file as needed (e.g. `TEMPORAL_ADDRESS`, `STORE_FILE`).

**Auto-publish to Docker Hub:** On every push to `main` or `master`, the GitHub Action in `.github/workflows/docker-publish.yml` builds and pushes the image. Configure these **repository secrets** in GitHub (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|--------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token (Account → Security → New Access Token) |

The image will be pushed as `DOCKERHUB_USERNAME/open-llm-orchestrator-ui:latest` and `DOCKERHUB_USERNAME/open-llm-orchestrator-ui:sha-<short-sha>`.

## License

Apache-2.0
