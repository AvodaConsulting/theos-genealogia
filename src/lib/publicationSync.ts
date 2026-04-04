import type { LivingPublication, PublicationSyncStatus, ResearchResult } from '../types';

function uniqueCitations(result: ResearchResult): string[] {
  return Array.from(
    new Set(
      result.nodes
        .flatMap((node) => node.citations ?? [])
        .map((citation) => citation.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function linkKey(link: { source: string; target: string; type: string }): string {
  return `${link.source}::${link.target}::${link.type}`;
}

export function computePublicationSyncStatus(
  publication: LivingPublication | undefined,
  baselineResult: ResearchResult | undefined,
  currentResult: ResearchResult,
): PublicationSyncStatus {
  if (!publication || !baselineResult) {
    return {
      status: 'not-generated',
      evaluatedAt: new Date().toISOString(),
      changedNodeCount: 0,
      changedLinkCount: 0,
      changedCitationCount: 0,
      impactedNodes: [],
      notes: ['Generate a living publication to enable sync monitoring.'],
    };
  }

  const baselineNodes = new Map(baselineResult.nodes.map((node) => [node.id, node]));
  const currentNodes = new Map(currentResult.nodes.map((node) => [node.id, node]));
  const baselineLinks = new Set(baselineResult.links.map((link) => linkKey(link)));
  const currentLinks = new Set(currentResult.links.map((link) => linkKey(link)));

  const impactedNodes: string[] = [];
  for (const [id, node] of currentNodes) {
    const base = baselineNodes.get(id);
    if (!base) {
      impactedNodes.push(node.label);
      continue;
    }
    if (
      base.content !== node.content ||
      JSON.stringify(base.citations ?? []) !== JSON.stringify(node.citations ?? []) ||
      JSON.stringify(base.manuscriptVariants ?? []) !== JSON.stringify(node.manuscriptVariants ?? [])
    ) {
      impactedNodes.push(node.label);
    }
  }

  const changedNodeCount = impactedNodes.length;
  const changedLinkCount =
    Array.from(currentLinks).filter((key) => !baselineLinks.has(key)).length +
    Array.from(baselineLinks).filter((key) => !currentLinks.has(key)).length;

  const baselineCitationSet = new Set(uniqueCitations(baselineResult));
  const currentCitationSet = new Set(uniqueCitations(currentResult));
  const changedCitationCount =
    Array.from(currentCitationSet).filter((citation) => !baselineCitationSet.has(citation)).length +
    Array.from(baselineCitationSet).filter((citation) => !currentCitationSet.has(citation)).length;

  const stale = changedNodeCount > 0 || changedLinkCount > 0 || changedCitationCount > 0;

  const notes: string[] = [];
  if (!stale) {
    notes.push('Publication is synchronized with current graph state.');
  } else {
    notes.push('Detected graph updates after publication generation.');
    if (changedCitationCount > 0) {
      notes.push('Citation set changed; bibliography should be regenerated.');
    }
    if (changedNodeCount > 0) {
      notes.push('Node-level evidence changed; argument sections referencing impacted nodes should be reviewed.');
    }
  }

  return {
    status: stale ? 'stale' : 'up-to-date',
    evaluatedAt: new Date().toISOString(),
    changedNodeCount,
    changedLinkCount,
    changedCitationCount,
    impactedNodes: impactedNodes.slice(0, 12),
    notes,
  };
}
