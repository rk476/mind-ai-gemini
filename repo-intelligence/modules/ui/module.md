# UI Module

## Purpose
This module provides the frontend dashboard and test visualization interface for the user.

## Primary Responsibilities
- Presenting the main user interface.
- Submitting new test runs.
- Rendering lists of past tests.
- Visualizing individual test results and logs.

## Routes or Entry Points
- `app/page.tsx`: Home/Dashboard.
- `app/tests/page.tsx`: Listing tests.
- `app/tests/[runId]/page.tsx`: Displaying specific test artifacts and execution details.

## Dependencies
- `app/globals.css`
- `app/api` (fetch requests to local endpoints)

## Key Components
- React Server and Client Components in standard Page structures
