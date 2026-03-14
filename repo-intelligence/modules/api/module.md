# API Module

## Purpose
This module handles all Next.js API endpoints connecting the frontend with backend services.

## Primary Responsibilities
- Receives user requests to initiate tests.
- Retrieves test execution status and details.
- Handles artifact uploads (reports, screenshots, videos) from the worker process.

## Routes or Entry Points
- `app/api/run-test/route.ts`: Initiate new tests.
- `app/api/test/[runId]/route.ts`: Get status for a test run.
- `app/api/tests/route.ts`: List recent tests.
- `app/api/tests/[runId]/route.ts`: Get detailed test results.
- `app/api/test/[runId]/report/route.ts`: Upload report.
- `app/api/test/[runId]/screenshot/route.ts`: Upload screenshot.
- `app/api/test/[runId]/video/route.ts`: Upload video.

## Dependencies
- `lib/db`
- `lib/queue`
- `lib/storage`

## Key Components
- Next.js Route Handlers
