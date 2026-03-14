# AI Agent Guide

This guide provides vital rules and workflows for AI agents attempting to navigate or modify the `browser-agent-next` repository. 

## Navigation Workflow
For any task, follow this workflow:
1. **Task**: Understand the user's request.
2. **Identify module**: Consult `repo-intelligence/repo-map.json` and `repo-intelligence/module-index.json` to find the target module boundary.
3. **Identify feature**: Check `modules/{module-name}/features.json` to map functionality to specific file paths.
4. **Locate file**: Navigate directly to the identified files.
5. **Modify code**: Make local modifications within those specific boundaries.

## Rules for Modification
1. **Always read `repo-map.json`** before modifying code. This provides the context of existing modules.
2. **Identify and stay within the module**. Avoid cross-module dependencies where inappropriate. Do not mix worker logic directly into UI components.
3. **Modify files only within the relevant module**. If a task is to update AI test planning, only touch `lib/ai/testPlanner.ts`.
4. **Prefer updating existing components** rather than creating duplicates.
5. **Follow the Next.js App Router conventions** (e.g., using `page.tsx`, `layout.tsx`, `route.ts`).
6. **Background processing** logic belongs in the worker and shared libraries, NOT in Next.js API routes due to timeout limits. Wait/Background tasks use the `queue`.
7. **Run linting and type checks** (`npm run lint`, `npm run typecheck`) after major modifications.
