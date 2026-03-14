# Repository Architecture

This document describes the overall architecture of the `browser-agent-next` repository. The system is a full-stack Next.js application combined with a background worker for asynchronous test execution using Playwright and AI tools.

## High-Level Architecture
1. **Frontend (UI)**: Next.js application (`app/`) that provides the dashboard and test results visualization.
2. **Backend API (API)**: Next.js API routes (`app/api/`) that handle interactions between the frontend and the database/task queues.
3. **Background Worker (Worker)**: A separate Node.js process (`worker/worker.ts`) executing browser automation tasks asynchronously.
4. **Core Libraries (Lib)**: Internal shared services for AI processing, database access, queuing, and test execution (`lib/`).

## Module Boundaries
- **UI & API**: Reside entirely within the Next.js framework in the `app/` directory. All frontend user interactions flow through the API routes.
- **Worker**: Operates independently of the Next.js server but shares the database and queuing system.
- **Lib Components**: Provide the heavy lifting layer. They are consumed by both the Next.js API and the Worker process. The worker uses `executor`, `mcp`, `storage`, and `ai` modules directly to perform AI-driven web tasks.

## Request Flow
1. **Triggering a Test**: The user clicks "Run Test" in the `UI`.
2. **API Handling**: `app/api/run-test/route.ts` captures the request, saves initial state to the `DB`, and pushes a job to the `Queue`.
3. **Task Execution**: The `Worker` picks up the job, initializes browser context via `MCP`/Playwright, plans and analyzes via `AI`, and executes actions via `Executor`.
4. **Storage & Updates**: Test artifacts (screenshots, video, reports) are dumped to `Storage`, and state is persisted back to `DB`.
5. **Viewing Results**: The user views results in the `UI`, reading from API details endpoints (`app/api/tests/`).
