import type { Link, LivingPublication, Node, ResearchResult } from '../types';

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `pub-${(hash >>> 0).toString(16)}`;
}

function uniqueCitations(nodes: Node[]): string[] {
  return Array.from(
    new Set(
      nodes
        .flatMap((node) => node.citations ?? [])
        .map((citation) => citation.trim())
        .filter(Boolean),
    ),
  );
}

function buildCitationIndex(nodes: Node[]): LivingPublication['citationIndex'] {
  const map = new Map<string, Set<string>>();

  for (const node of nodes) {
    for (const citation of node.citations ?? []) {
      const normalized = citation.trim();
      if (!normalized) {
        continue;
      }
      if (!map.has(normalized)) {
        map.set(normalized, new Set());
      }
      map.get(normalized)?.add(node.id);
    }
  }

  return Array.from(map.entries())
    .map(([citation, nodeIds]) => ({
      citation,
      nodeIds: Array.from(nodeIds),
    }))
    .sort((a, b) => a.citation.localeCompare(b.citation));
}

function buildImpactNotes(nodes: Node[], links: Link[]): string[] {
  const notes: string[] = [];
  const rejected = nodes.reduce((count, node) => count + (node.citationAudit?.rejected?.length ?? 0), 0);
  if (rejected > 0) {
    notes.push(`${rejected} citations were rejected during verification and excluded from publication.`);
  }

  const lowConfidenceLinks = links.filter((link) => {
    const p = Number.parseFloat(link.intertextualityMetrics?.pValue ?? '');
    return Number.isFinite(p) && p > 0.05;
  }).length;
  if (lowConfidenceLinks > 0) {
    notes.push(
      `${lowConfidenceLinks} intertextual links remain above p > 0.05 and should be treated as exploratory.`,
    );
  }

  if (notes.length === 0) {
    notes.push('No high-risk impact flags detected at publication time.');
  }

  return notes;
}

export function createLivingPublication(
  query: string,
  result: ResearchResult,
  publicationMarkdown?: string,
): LivingPublication {
  const timestamp = new Date().toISOString();
  const citations = uniqueCitations(result.nodes);
  const bibliography =
    citations.length > 0 ? citations.map((citation) => `- ${citation}`).join('\n') : '- No verified citation available';
  const impactNotes = buildImpactNotes(result.nodes, result.links);

  const markdown =
    publicationMarkdown?.trim() ||
    [
      '# Living Publication',
      '',
      `- Query: ${query}`,
      `- Generated At: ${timestamp}`,
      `- Node Count: ${result.nodes.length}`,
      `- Link Count: ${result.links.length}`,
      '',
      '## Main Argument',
      result.summary?.trim() || 'No summary generated.',
      '',
      '## Bibliography (Verified Sources Only)',
      bibliography,
      '',
      '## Impact Monitor',
      ...impactNotes.map((note) => `- ${note}`),
    ].join('\n');

  return {
    id: stableHash(`${query}\n${timestamp}\n${markdown}`),
    title: `Living Publication: ${query.slice(0, 90)}`,
    generatedAt: timestamp,
    versionLabel: `v${timestamp.slice(0, 10)}`,
    markdown,
    citationIndex: buildCitationIndex(result.nodes),
    impactNotes,
  };
}
