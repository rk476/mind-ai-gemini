# Storage Module

## Purpose
Manages artifact logic for saving generated media or files.

## Primary Responsibilities
- Uploading/Retrieving screenshots, video, and reports.

## Routes or Entry Points
- `lib/storage/report.ts`
- `lib/storage/screenshot.ts`
- `lib/storage/video.ts`

## Dependencies
- `fs` / S3 bindings (depending on env config)

## Key Components
- Storage handlers aligned by media type
