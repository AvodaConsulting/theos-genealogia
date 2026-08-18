# TheosGenealogia

Doctorate-level biblical philology and concept genealogy tracer.

This repository provides a research workbench for corpus ingestion, genealogical tracing, scholarly debate, integrity checks, provenance tracking, living publication, and review workflows. Its framework dashboard maps available capabilities; it is not a scholarly-quality score or publication certification.

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
The public URL should be the worker hostname for this project, typically:
`https://theos-genealogia.<your-subdomain>.workers.dev`

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
- extended backward trace horizon support (`ANE` source stream) for evidentially grounded Ancient Near Eastern/Egyptian/Levantine/Persian comparative precursors
- methodology tagging on links (hermeneutics/canon/language philosophy)
- rupture diagnostics on nodes (semantic/syntactic/untranslatable/silence)
- inferred edge fallback to avoid disconnected "floating-only" graphs
- configurable methodology profile in the left panel (used by all generation phases)
- configurable trace controls in Methodology Profile:
  - `Trace Horizon`: `Core-70CE` or `Extended-ANE`
  - `Analysis Depth`: `Standard` or `Comprehensive`
- Counterfactual Lab tab for on-demand what-if simulations
- Level 3 module: Intertextuality Statistics Engine with permutation p-value testing on selected links
- Citation integrity guardrail: every node citation is categorized as verified, recognized-but-needing-a-locator, researcher-retained-pending-verification, or needing review. A failed automatic match is not treated as proof that a specialist source is invalid.
- Citation appeal workflow: researchers can retain a citation with a written rationale. Retained and recognized sources remain visible in later research output under a pending-verification appendix, while verified bibliographies remain limited to verified entries.
- Level 5.2 foundation: Living Publication generator with citation-index-to-graph navigation.
- Living Publication now uses a dedicated publication-grade generation pipeline (not summary reuse), with system-locked verified bibliography.
- Living Publication robustness: if long JSON publication payloads fail parsing, the pipeline auto-retries in plain-Markdown fallback mode.
- Level 6 peer-review workflow: blind review packet generation, mapped reviewer comments (publication/node/link), and revision diff tracking against packet baseline.
- Strict manuscript review: paste a Chinese or English paper, or review a Living Publication, to receive a direct editorial recommendation, major and minor findings, and an ordered revision plan. The review distinguishes textual observations from claims requiring external verification.
- Product layer: a dedicated `Framework` panel that maps the current workspace's documented capabilities, limitations, and next actions without assigning an uncalibrated quality score.

## Digital Hermeneutics Capability Map

The app maps the following product modules. This is a capability inventory, not an assessment of research quality, scholarly validity, or readiness for publication.

- Corpus ingestion: NotebookLM bridge today, with the UI ready for additional corpus connectors such as Zotero.
- Agentic workflow: structural tracing, node/link enrichment, synthesis, publication, and review in one flow.
- Debate engine: scholarly debate blocks, contested-link clustering, and personal stance tracking.
- Integrity gate: citation audit, verification status, intertextuality statistics, publication sync, and peer-review gatekeeping.
- Knowledge provenance: publication citation index mapped back to graph nodes.
- Session research workspace: research notes, outline proposal, publication draft, and personal genealogy. These are not durable shared storage unless an external persistence layer is configured.
- Entropy control: stale-publication detection and reviewer blockers. A presentation-ready signal requires a substantive manuscript review as well as resolved material comments.

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
