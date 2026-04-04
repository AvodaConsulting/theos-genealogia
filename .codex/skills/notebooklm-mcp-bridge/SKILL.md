---
name: notebooklm-mcp-bridge
description: Use when integrating NotebookLM notebook corpora into TheosGenealogia or other research pipelines through a local authenticated bridge endpoint, including source sync, normalization, and prompt-context injection.
---

# NotebookLM MCP Bridge

Use this skill when the user wants NotebookLM notebooks to become authoritative source inputs for app features or pipeline phases.

## Trigger Conditions

- User asks to connect NotebookLM notebooks/links into the app.
- User asks to reuse notebook sources in future features.
- User asks to improve source authenticity using NotebookLM corpus data.

## Workflow

1. Verify bridge service contract:
- Endpoint: `POST /notebooks/fetch`
- Request body includes `notebookRef` and/or `notebookId`
- Response contains `sources[]` with `title`, `excerpt`, optional `citations`, optional `url`

2. Verify app-side connector:
- Parse notebook URL/ID robustly.
- Normalize source records and cap payload size.
- Build compact external corpus context for LLM prompts.

3. Inject corpus context into generation phases:
- Structural mapping
- Node/link enrichment
- Summary
- Counterfactual
- Publication

4. Add user-facing sync controls:
- Notebook ref input
- Sync button
- Synced-count/last-error feedback

5. Validate:
- Typecheck/build pass
- Activity log includes notebook sync phase events
- Pipeline still works when notebook sync is absent

## Project Paths

- Bridge server: `scripts/notebooklm-bridge.mjs`
- Client connector: `src/lib/notebooklmBridge.ts`
- Prompt wiring: `src/lib/pipelinePrompts.ts`
- Phase calls: `src/lib/pipeline.ts`
- UI: `src/components/LeftPanel.tsx`
- App state integration: `src/App.tsx`

## Operational Notes

- The bridge does not embed credentials in frontend code.
- Auth stays inside user-owned fetch command configured via:
  - `NOTEBOOKLM_FETCH_COMMAND`
- Frontend bridge base URL:
  - `VITE_NOTEBOOKLM_BRIDGE_URL`

