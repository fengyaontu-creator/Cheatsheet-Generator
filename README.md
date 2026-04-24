# Cheatsheet

A web app for turning lecture notes and course materials into print-ready exam cheatsheets.

Cheatsheet is a small full-stack project built for exam revision. Instead of producing long prose summaries, it extracts structured study blocks from raw material with an LLM, lets you tune density and layout in the browser, and exports a compact A4 revision sheet as PDF.

The product principle is **controlled-layout AI**: the LLM outputs structured content only, the program controls layout, and users tune parameters instead of re-prompting.

## What It Does

- Paste text or upload documents (PDF, Word, PowerPoint, Excel, HTML, CSV, Markdown, plain text) on the create page
- Optionally attach supplementary images as extra context
- Add optional focus instructions (e.g. exam scope, which topics to emphasize)
- A 4-stage LLM pipeline extracts topic structure and per-topic study blocks (definitions, formulas, comparisons, pitfalls, procedures, exam tips, examples)
- Open the generated project in an editor with density, font, column, and layout controls
- Toggle between **List** mode (linear multi-column) and **Mindmap** mode (hierarchical tree) — both share the same block schema
- Hide, restore, reorder, and lock blocks; insert / resize / reorder user images
- Double-click any block in the preview to locate it in the sidebar
- Editor state persists in `sessionStorage` across reloads
- Export either mode to PDF through a headless-browser render on the backend

## Product Flow

1. Paste or upload source material on the create page
2. Optionally add focus instructions and supplementary images
3. Backend runs a 4-stage LLM pipeline:
   1. **Comprehend** — evidence digest of the source
   2. **Topics** — topic skeleton with anchor terms
   3. **Outline** — per-topic hierarchical blocks (runs per-topic in parallel)
   4. **Compress** — generates `content_short` and `content_ultra_short` variants
4. Frontend opens the generated project in the editor
5. Adjust density, page target, block visibility, and layout
6. Export the chosen layout as PDF

## Stack

### Frontend

- React + TypeScript
- Vite
- React Router
- KaTeX (math rendering)
- d3-hierarchy (mindmap layout)

### Backend

- FastAPI + Pydantic
- OpenAI SDK pointing at OpenRouter or Google's OpenAI-compatible Gemini endpoint
- markitdown (multi-format document parsing)
- Playwright (headless Chromium, PDF export)
- Per-stage content-hash cache under `app/.cache/extractor/` (prompt changes auto-invalidate)

## Local Setup

### 1. Backend

From the repository root:

```powershell
cd cheatsheet-app/backend
copy .env.example .env
python -m pip install -r requirements.txt
python -m playwright install chromium
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

On Windows PowerShell, `./run.ps1` wraps the install + uvicorn steps.

Required environment variables:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=anthropic/claude-sonnet-4.5
```

Optional per-stage provider/model overrides are documented in `.env.example`.
For example, cheap stages can use Google Gemini directly while the outline
stage uses Claude through OpenRouter:

```env
GOOGLE_API_KEY=your_google_key
OPENROUTER_API_KEY=your_openrouter_key

LLM_PROVIDER_STAGE0=google
LLM_MODEL_STAGE0=gemini-2.5-flash
LLM_PROVIDER_STAGE1=google
LLM_MODEL_STAGE1=gemini-2.5-flash-lite
LLM_PROVIDER_STAGE2=openrouter
LLM_MODEL_STAGE2=anthropic/claude-sonnet-4.5
LLM_PROVIDER_STAGE3=google
LLM_MODEL_STAGE3=gemini-2.5-flash-lite
```

### 2. Frontend

```powershell
cd cheatsheet-app/frontend
npm install
npm run dev
```

Optional frontend env file:

```env
VITE_API_URL=http://localhost:8000
```

### 3. Open The App

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

## Export

Both List and Mindmap modes export through the backend. The frontend collects its rendered preview pages and the stylesheet, wraps them as a self-contained HTML document, and posts it to `/api/export/pdf`. The backend renders with headless Chromium via Playwright using the same CSS the preview uses, so what you see is what you print.

PDF rendering runs synchronously inside a thread pool to avoid blocking the asyncio event loop.

## API Overview

### `POST /api/ingest`

Multipart upload. Accepts any combination of documents (PDF, DOCX, PPT, Excel, HTML, CSV, JSON, XML, plain text) and images. Documents are concatenated into source text via markitdown; images are collected for future multimodal passes.

Form fields:

- `files` — one or more uploaded files
- `user_focus` — optional focus text
- `language` — `en` | `zh` | `mixed`

Returns the cheatsheet project JSON: `document_title`, `exam_profile`, `blocks`, `pages`, `warnings`.

### `POST /api/ingest/text`

JSON body for pasted text:

- `source_text`
- `user_focus`
- `language`

Same response shape as `/api/ingest`.

### `POST /api/export/pdf`

JSON body:

- `html` — self-contained HTML of the pages to render

Returns `application/pdf`.

## Project Structure

```text
.
|- cheatsheet-app/
|  |- backend/
|  |  |- app/
|  |  |  |- api/routes/        # ingest.py, export.py
|  |  |  |- prompts/           # system.md + 4 stage prompts
|  |  |  |- schemas/           # blocks, project
|  |  |  |- services/          # extractor, llm_client, file_reader, outline_parser
|  |  |  `- main.py
|  |  |- sample/
|  |  |- requirements.txt
|  |  `- run.ps1
|  |- frontend/
|  |  |- src/
|  |  |  |- components/editor/ # BlockSidebar, BlockCard, ControlPanel, PagePreview, ListPreview, MindmapPreview
|  |  |  |- pages/             # HomePage, CreatePage, EditorPage
|  |  |  |- layout/            # pagination engine
|  |  |  |- services/          # api.ts
|  |  |  |- store/
|  |  |  |- styles/
|  |  |  |- types/
|  |  |  `- utils/
|  |  `- package.json
|  `- start.md
|- README.md
```

## Known Limits

- `/api/ingest` blocks until the full 4-stage pipeline finishes — no job / progress API yet
- No streaming LLM responses
- No persistence beyond `sessionStorage` — no user accounts, no saved projects
- No block text editing yet — users can hide / reorder / lock blocks and resize / reorder images, but cannot edit titles or content
- Pagination is topic-blind — subtrees and topic groups can split across pages with only a "(cont.)" badge
- No automated backend test suite yet
- Deployment story undecided

## Roadmap

Three parallel tracks:

**1. Core-value UX arc** (sequence matters; each phase unblocks the next)

1. Generation job status framework — in-memory job store + polling endpoints (`POST /api/ingest/jobs/{text,files}` + `GET /api/ingest/jobs/{id}`); CreatePage stays on the submit screen and polls to completion
2. Generation overlay — stage + per-topic progress card with cancel / retry
3. 10-second "whip" overlay — pure UI flourish after long waits, no pipeline coupling
4. Block text editing — title + content, double-click to edit, 200 ms debounce back into the project (the last missing piece of the "fix without re-prompting" value prop)

**2. Topic-grouping-aware layout**

Pagination currently ignores block identity. Extend it to receive topic group hints so List mode inserts topic-header breaks and Mindmap mode keeps subtrees together when they fit.

**3. Deployment**

Target shape: backend behind nginx reverse proxy, frontend served as static assets, Playwright concurrency capped for single-core VPS. Keep path / port / DB coupling behind env vars so future migration to dedicated instances or managed services is just env swaps.

**Smaller ongoing work**

- Stage 2 Markdown → JSON prompt mode (retire the outline parser)
- Prompt retrieval tightening (dedup / stoplist / IDF) — gated on real-run observations
- Regression tests for export payload validation and extractor warnings
