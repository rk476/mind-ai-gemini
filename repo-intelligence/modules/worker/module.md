# Worker Module

## Purpose
Executes background tasks out-of-band to prevent blocking the Next.js API. Specifically runs browser execution logic.

## Primary Responsibilities
- Polling the task queue (BullMQ).
- Initializing the browser testing pipeline.
- Saving artifacts upon completion.

## Routes or Entry Points
- `worker/worker.ts`

## Dependencies
- `lib/queue`
- `lib/executor`
- `lib/db`
- `playwright`

## Key Components
- Worker Process Initialization Script
