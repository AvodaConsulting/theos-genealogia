# TheosGenealogia

Doctorate-level biblical philology and concept genealogy tracer.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure LLM credentials:

```bash
cp .env.example .env
# keep Gemini model/provider config in .env
# users will provide their own Gemini API key at app startup
```

3. Run the app:

```bash
npm run dev
```

## Cloudflare Workers Builds Deployment

If your Cloudflare dashboard only supports Workers (not classic Pages), use:

- Build command: `npm run build`
- Deploy command: `npm run cf:deploy`
- Node version: `22`

The project includes `wrangler.jsonc` configured to serve `dist/` as static assets with SPA fallback routing.
Do not set a custom `CLOUDFLARE_API_TOKEN` in the project environment unless it has the correct Pages/Workers permissions.

## NotebookLM Bridge (Option 2)

The app supports NotebookLM ingestion through a local bridge endpoint. This lets you keep notebook access under your own authorized command.

1. Configure bridge URL in `.env` (optional if default):

```bash
VITE_NOTEBOOKLM_BRIDGE_URL=http://localhost:8787
```

2. Set a notebook fetch command that outputs JSON to stdout:

```bash
export NOTEBOOKLM_FETCH_COMMAND='your-notebook-fetch-command --notebook {NOTEBOOK_ID} --json'
```

`NOTEBOOKLM_FETCH_COMMAND` placeholders:
- `{NOTEBOOK_ID}`
- `{NOTEBOOK_REF}`

Expected JSON shape from your command:

```json
{
  "notebookTitle": "optional title",
  "sources": [
    {
      "id": "source-id",
      "title": "source title",
      "excerpt": "short source excerpt",
      "citations": ["optional citation"],
      "url": "optional url"
    }
  ],
  "notes": ["optional note"]
}
```

3. Start bridge:

```bash
npm run notebooklm:bridge
```

4. In app left panel (`NotebookLM Sync`), paste notebook URL/ID and click `Sync Notebook Sources`.

## Reusable Codex Skill

This repo includes a reusable skill package for NotebookLM bridge integrations:

- Skill path: `.codex/skills/notebooklm-mcp-bridge/SKILL.md`

To install it into your Codex skills directory for future projects:

```bash
npm run skill:notebooklm:install
```

This creates a symlink at `$CODEX_HOME/skills/notebooklm-mcp-bridge` (or `~/.codex/skills/...` if `CODEX_HOME` is unset).

## Pipeline

- Phase 1: Structural Mapping (triggered by `Trace Genealogy`)
- Phase 0: NotebookLM Sync (optional, before tracing)
- Phase 2: Philological Enrichment (on-demand when selecting a node)
- Phase 3: Academic Rigor (on-demand when selecting a link)
- Phase 4: Synthesis & Summary (on-demand when opening Summary tab)
- Phase 5: Verification (available as an optional follow-up API step in code)

The app now uses lazy generation to reduce context/window pressure and avoid long monolithic responses.
It also includes:
- methodology tagging on links (hermeneutics/canon/language philosophy)
- rupture diagnostics on nodes (semantic/syntactic/untranslatable/silence)
- inferred edge fallback to avoid disconnected "floating-only" graphs
- configurable methodology profile in the left panel (used by all generation phases)
- Counterfactual Lab tab for on-demand what-if simulations
- Level 3 module: Intertextuality Statistics Engine with permutation p-value testing on selected links
- Citation integrity guardrail: every node citation is audited (rule-engine + Crossref). Unverified citations are rejected and excluded from final display.
- Level 5.2 foundation: Living Publication generator with citation-index-to-graph navigation.
- Living Publication now uses a dedicated publication-grade generation pipeline (not summary reuse), with system-locked verified bibliography.
- Level 6 peer-review workflow: blind review packet generation, mapped reviewer comments (publication/node/link), and revision diff tracking against packet baseline.

## LLM Provider

- Default: `VITE_LLM_PROVIDER=gemini`
- Default Gemini model: `gemini-2.5-flash`
- If you set `gemini-3.0-flash-preview`, the app auto-normalizes it to `gemini-3-flash-preview`.
- Startup access gate: users must enter and verify their own Gemini API key before using the app.
- Optional: the user can persist the key locally in their own browser (`localStorage`).
- For public deployments, do not configure `VITE_GEMINI_API_KEY`.
- Optional local-dev fallback: `VITE_OPENAI_API_KEY` can still be used with `VITE_LLM_PROVIDER=openai`.

If you see a network-style error (for example, "failed to fetch"), verify:

- internet connectivity
- the user-entered Gemini key is valid
- the selected Gemini model is available for that key/project
