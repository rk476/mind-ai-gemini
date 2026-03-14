# DB Module

## Purpose
Provides connection instances and migrations for the persistent storage (MongoDB/Redis).

## Primary Responsibilities
- Managing database connections.
- Applying schema changes.

## Routes or Entry Points
- `lib/db/db.ts`
- `lib/db/migrate.ts`

## Dependencies
- `mongodb`
- `ioredis`

## Key Components
- Database connection pool manager
