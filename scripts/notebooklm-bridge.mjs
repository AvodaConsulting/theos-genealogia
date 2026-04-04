#!/usr/bin/env node
import http from 'node:http';
import { exec } from 'node:child_process';

const PORT = Number.parseInt(process.env.NOTEBOOKLM_BRIDGE_PORT ?? '8787', 10);
const FETCH_COMMAND_TEMPLATE = process.env.NOTEBOOKLM_FETCH_COMMAND ?? '';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(body);
}

function parseNotebookId(value) {
  const text = String(value ?? '').trim();
  const match = text.match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  );
  return match ? match[0] : text;
}

function normalizeSources(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const e = entry;
      const excerpt =
        String(e.excerpt ?? e.summary ?? e.text ?? e.snippet ?? '').trim();
      if (!excerpt) {
        return null;
      }
      const citations = Array.isArray(e.citations)
        ? e.citations.map((value) => String(value).trim()).filter(Boolean)
        : undefined;
      const url = typeof e.url === 'string' ? e.url.trim() : undefined;
      return {
        id: String(e.id ?? `source-${index + 1}`),
        title: String(e.title ?? `Source ${index + 1}`),
        excerpt,
        citations,
        url,
      };
    })
    .filter(Boolean)
    .slice(0, 64);
}

function runFetchCommand(notebookRef, notebookId) {
  return new Promise((resolve, reject) => {
    if (!FETCH_COMMAND_TEMPLATE.trim()) {
      reject(
        new Error(
          'NOTEBOOKLM_FETCH_COMMAND is not configured. Set a command that outputs notebook corpus JSON.',
        ),
      );
      return;
    }

    const cmd = FETCH_COMMAND_TEMPLATE.replaceAll('{NOTEBOOK_REF}', notebookRef).replaceAll(
      '{NOTEBOOK_ID}',
      notebookId,
    );

    exec(cmd, { timeout: 120000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`fetch command failed: ${stderr || error.message}`));
        return;
      }
      const text = String(stdout ?? '').trim();
      if (!text) {
        reject(new Error('fetch command returned empty output.'));
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (parseError) {
        reject(
          new Error(
            `fetch command did not return valid JSON: ${
              parseError instanceof Error ? parseError.message : 'unknown parse error'
            }`,
          ),
        );
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      configured: Boolean(FETCH_COMMAND_TEMPLATE.trim()),
      port: PORT,
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/notebooks/fetch') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const notebookRef = String(payload.notebookRef ?? '').trim();
        const notebookId = parseNotebookId(payload.notebookId || notebookRef);
        if (!notebookRef || !notebookId) {
          sendJson(res, 400, { error: 'notebookRef/notebookId is required.' });
          return;
        }

        const raw = await runFetchCommand(notebookRef, notebookId);
        const root = raw && typeof raw === 'object' ? raw : {};
        const sources = normalizeSources(root.sources);

        sendJson(res, 200, {
          notebookId,
          notebookTitle: typeof root.notebookTitle === 'string' ? root.notebookTitle : undefined,
          sources,
          notes:
            Array.isArray(root.notes) && root.notes.length > 0
              ? root.notes.map((value) => String(value))
              : undefined,
        });
      } catch (error) {
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : 'Notebook fetch failed.',
        });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`NotebookLM bridge listening on http://localhost:${PORT}`);
});

