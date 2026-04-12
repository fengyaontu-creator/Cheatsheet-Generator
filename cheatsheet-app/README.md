# Cheatsheet

A web app for turning lecture notes into print-ready exam cheatsheets.

Cheatsheet is a small full-stack project built for exam revision. Instead of producing long prose summaries, it extracts structured study blocks from raw material, lets you tune density and layout in the browser, and helps you export a compact revision sheet.

## What It Does

- Paste lecture notes, textbook excerpts, or markdown into the create page
- Use an LLM to extract structured blocks such as definitions, formulas, pitfalls, and procedures
- Open the generated result in an editor with density and layout controls
- Hide, restore, reorder, and lock blocks while previewing the final sheet live
- Export list-mode cheatsheets through the backend as PDF
- Fall back to `.tex` export if no local LaTeX compiler is available
- Print or save the mindmap view from the browser

## Product Flow

1. Paste source material on the create page
2. Optionally add focus instructions for the exam
3. Backend extracts topics and per-topic outline blocks with an LLM
4. Frontend opens the generated project in the editor
5. Adjust density, page target, block visibility, and layout settings
6. Export the list layout or print the mindmap layout

## Current Behavior

- `List` mode:
  Uses the backend `/api/export/latex` route for export.
- `Mindmap` mode:
  Uses browser print / "Save as PDF" instead of backend PDF generation.
- Export fallback:
  If `tectonic` or `pdflatex` is unavailable, the backend returns a `.tex` file instead of a PDF.
- Extraction warnings:
  If topic extraction is trimmed or some topic passes fail, the editor shows warnings instead of silently hiding that state.

## Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- KaTeX
- d3-hierarchy

### Backend

- FastAPI
- Pydantic
- Jinja2
- OpenAI SDK
- OpenRouter API

## Local Setup

### 1. Backend

From `backend/`:

```powershell
copy .env.example .env
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Required environment variables:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=anthropic/claude-sonnet-4.5
```

### 2. Frontend

From `frontend/`:

```powershell
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

## Export Notes

The backend export path is designed for list-mode cheatsheets.

It validates the export payload, escapes normal text before it enters LaTeX, blocks a set of risky LaTeX commands, and applies a compile timeout.

The backend tries:

1. `tectonic`
2. `pdflatex`

If both fail or are missing, it returns the generated `.tex` source.

## API Overview

### `POST /api/ingest/text`

Converts raw study material into a structured cheatsheet project.

Request body:

- `source_text`
- `user_focus`

Response includes:

- `document_title`
- `exam_profile`
- `blocks`
- `pages`
- `warnings`

### `POST /api/export/latex`

Exports a list-mode cheatsheet document.

Request body includes:

- `document_title`
- `blocks`
- `cols`
- `margin_mm`

Returns:

- `application/pdf` when compilation succeeds
- `text/plain` with TeX content when export falls back

## Project Structure

```text
cheatsheet-app/
├─ backend/
│  ├─ app/
│  │  ├─ api/routes/
│  │  ├─ prompts/
│  │  ├─ renderer/
│  │  ├─ schemas/
│  │  └─ services/
│  ├─ sample/
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ pages/
│  │  ├─ services/
│  │  ├─ types/
│  │  └─ utils/
│  └─ package.json
├─ start.md
└─ README.md
```

## Known Limits

- Extraction quality still depends heavily on source quality and prompt behavior
- There is no persistence layer yet
- Mindmap export still uses browser print instead of backend PDF generation
- The list editor is more mature than the mindmap editor
- There is not yet an automated backend test suite

## Good First Next Steps

- Add regression tests for export payload validation and extractor warnings
- Decide whether mindmap export should also move to the backend
- Improve block editing beyond hide / move / lock interactions
- Add project save / load support
- Refine README screenshots or demo media for GitHub presentation
