import type { ConceptTopographyEntry, ConceptTopographyReport, Link, Node } from '../types';

const SOURCE_POWER: Record<Node['source'], number> = {
  OT: 0.72,
  STP: 0.64,
  Hellenistic: 0.58,
  NT: 0.85,
  Manuscript: 0.48,
};

const BOOK_YEAR: Record<string, number> = {
  genesis: -900,
  isaiah: -700,
  psalms: -500,
  daniel: -165,
  sirach: -180,
  wisdomofsolomon: -30,
  '1enoch': -150,
  matthew: 80,
  mark: 70,
  luke: 85,
  john: 95,
  romans: 57,
  revelation: 96,
};

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}[\p{L}\p{N}'-]*/gu) ?? []).filter((token) => token.length > 1);
}

function normalizeBookToken(raw: string): string | null {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!compact) {
    return null;
  }
  if (compact.startsWith('wis')) {
    return 'wisdomofsolomon';
  }
  if (compact.startsWith('sir') || compact === 'ecclesiasticus') {
    return 'sirach';
  }
  if (compact === '1en' || compact === '1enoch') {
    return '1enoch';
  }
  return compact;
}

function estimateYear(node: Node): number {
  for (const citation of node.citations ?? []) {
    const normalized = normalizeSpaces(citation)
      .replace(/\b(?:LXX|MT|HB|GNT|NA28|UBS5)\b/gi, '')
      .trim();
    const match = normalized.match(/^([1-3]?\s*[A-Za-z. ]+)\s+\d+(?::\d+(?:-\d+)?)?$/);
    if (!match) {
      continue;
    }
    const token = normalizeBookToken(match[1] ?? '');
    if (token && Number.isFinite(BOOK_YEAR[token])) {
      return BOOK_YEAR[token];
    }
  }

  if (node.source === 'OT') {
    return -650;
  }
  if (node.source === 'STP') {
    return -120;
  }
  if (node.source === 'Hellenistic') {
    return -200;
  }
  if (node.source === 'NT') {
    return 70;
  }
  return 200;
}

function driftForNode(node: Node, links: Link[], nodeById: Map<string, Node>): number {
  const neighbors = links
    .filter((link) => link.source === node.id || link.target === node.id)
    .map((link) => (link.source === node.id ? link.target : link.source))
    .map((id) => nodeById.get(id))
    .filter(Boolean) as Node[];

  if (neighbors.length === 0) {
    return 0;
  }

  const selfTokens = new Set(tokenize(`${node.label} ${node.content}`));
  if (selfTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  let compared = 0;
  for (const neighbor of neighbors) {
    const other = new Set(tokenize(`${neighbor.label} ${neighbor.content}`));
    if (other.size === 0) {
      continue;
    }
    let hits = 0;
    for (const token of selfTokens) {
      if (other.has(token)) {
        hits += 1;
      }
    }
    overlap += hits / Math.max(selfTokens.size, other.size);
    compared += 1;
  }

  if (compared === 0) {
    return 0;
  }
  const meanOverlap = overlap / compared;
  return Math.max(0, Math.min(1, 1 - meanOverlap));
}

export function buildConceptTopographyReport(nodes: Node[], links: Link[]): ConceptTopographyReport {
  if (nodes.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      summary: 'No nodes available for topography analysis.',
      entries: [],
    };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const entries: ConceptTopographyEntry[] = nodes.map((node) => {
    const tokens = tokenize(`${node.label} ${node.content}`);
    const semanticDensity = Math.min(1, new Set(tokens).size / 40);
    const drift = driftForNode(node, links, nodeById);
    const year = estimateYear(node);
    const movementNote =
      drift > 0.62
        ? 'High drift: concept profile diverges strongly from adjacent witnesses.'
        : drift > 0.35
          ? 'Moderate drift: partial continuity with noticeable semantic displacement.'
          : 'Low drift: relatively stable profile across linked witnesses.';

    return {
      nodeId: node.id,
      label: node.label,
      source: node.source,
      tradition: node.tradition?.label,
      estimatedYear: year,
      semanticDensity,
      institutionalPower: SOURCE_POWER[node.source] ?? 0.5,
      driftScore: drift,
      movementNote,
    };
  });

  const avgDrift = entries.reduce((sum, entry) => sum + entry.driftScore, 0) / Math.max(entries.length, 1);
  const avgPower = entries.reduce((sum, entry) => sum + entry.institutionalPower, 0) / Math.max(entries.length, 1);
  const summary = `Computed multilingual proxy topography for ${entries.length} nodes. Mean drift=${avgDrift.toFixed(
    2,
  )}; mean institutional power=${avgPower.toFixed(2)}.`;

  return {
    generatedAt: new Date().toISOString(),
    summary,
    entries: entries.sort((a, b) => a.estimatedYear - b.estimatedYear),
  };
}
