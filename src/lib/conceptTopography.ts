import type { ConceptTopographyEntry, ConceptTopographyReport, Link, Node } from '../types';
import { inferChronologyFromNode } from './chronology';

const SOURCE_POWER: Record<Node['source'], number> = {
  ANE: 0.5,
  OT: 0.72,
  STP: 0.64,
  Hellenistic: 0.58,
  NT: 0.85,
  Manuscript: 0.48,
};

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}[\p{L}\p{N}'-]*/gu) ?? []).filter((token) => token.length > 1);
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
    const chronology = inferChronologyFromNode(node);
    const year = chronology.year;
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
      datingAnchor: chronology.anchor,
      datingConfidence: chronology.confidence,
      datingWarning: chronology.warning,
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
