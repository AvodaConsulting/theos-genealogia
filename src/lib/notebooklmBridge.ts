import type { NotebookCorpus, NotebookSourceRecord } from '../types';

const DEFAULT_BRIDGE_URL = 'http://localhost:8787';

function bridgeBaseUrl(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env
    ?.VITE_NOTEBOOKLM_BRIDGE_URL;
  return (fromEnv && fromEnv.trim()) || DEFAULT_BRIDGE_URL;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseNotebookId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const uuidMatch = trimmed.match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  );
  if (uuidMatch) {
    return uuidMatch[0];
  }
  return trimmed;
}

function normalizeSource(raw: unknown, index: number): NotebookSourceRecord | null {
  const entry = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
  if (!entry) {
    return null;
  }
  const id = asString(entry.id) || `source-${index + 1}`;
  const title = asString(entry.title) || `Source ${index + 1}`;
  const excerpt = asString(entry.excerpt || entry.summary || entry.text || entry.snippet);
  if (!excerpt) {
    return null;
  }
  const citations = Array.isArray(entry.citations)
    ? entry.citations.map((value) => asString(value)).filter(Boolean)
    : undefined;
  const url = asString(entry.url) || undefined;
  return { id, title, excerpt, citations, url };
}

function normalizeCorpus(raw: unknown, notebookRef: string): NotebookCorpus {
  const entry = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const sourceArray = Array.isArray(entry.sources) ? entry.sources : [];
  const sources = sourceArray
    .map((value, index) => normalizeSource(value, index))
    .filter((value): value is NotebookSourceRecord => Boolean(value))
    .slice(0, 64);

  const notebookId = asString(entry.notebookId) || parseNotebookId(notebookRef);
  const notebookTitle = asString(entry.notebookTitle) || undefined;
  const notes = Array.isArray(entry.notes)
    ? entry.notes.map((value) => asString(value)).filter(Boolean).slice(0, 16)
    : undefined;

  return {
    notebookId,
    notebookTitle,
    syncedAt: new Date().toISOString(),
    sourceCount: sources.length,
    sources,
    notes,
  };
}

export async function fetchNotebookCorpus(notebookRef: string): Promise<NotebookCorpus> {
  const normalizedRef = notebookRef.trim();
  if (!normalizedRef) {
    throw new Error('Notebook reference is required.');
  }

  const response = await fetch(`${bridgeBaseUrl()}/notebooks/fetch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      notebookRef: normalizedRef,
      notebookId: parseNotebookId(normalizedRef),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NotebookLM bridge error ${response.status}: ${text || 'request failed'}`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeCorpus(payload, normalizedRef);
}

export function buildNotebookPromptContext(corpus: NotebookCorpus | undefined): string | undefined {
  if (!corpus || corpus.sources.length === 0) {
    return undefined;
  }

  const lines: string[] = [];
  lines.push(`Notebook ID: ${corpus.notebookId}`);
  if (corpus.notebookTitle) {
    lines.push(`Notebook Title: ${corpus.notebookTitle}`);
  }
  lines.push(`Synced Sources: ${corpus.sourceCount}`);
  lines.push('Curated source excerpts:');

  for (const source of corpus.sources.slice(0, 12)) {
    lines.push(`- ${source.title}: ${source.excerpt}`);
    if (source.citations && source.citations.length > 0) {
      lines.push(`  Citations: ${source.citations.join('; ')}`);
    }
  }

  return lines.join('\n').slice(0, 12000);
}

