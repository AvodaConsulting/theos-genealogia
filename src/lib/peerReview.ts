import type {
  Link,
  LivingPublication,
  Node,
  PeerReviewComment,
  PeerReviewCommentInput,
  PeerReviewGate,
  PeerReviewPacket,
  ResearchResult,
  RevisionDiffReport,
} from '../types';

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `review-${(hash >>> 0).toString(16)}`;
}

function linkKey(link: Pick<Link, 'source' | 'target' | 'type'>): string {
  return `${link.source}::${link.target}::${link.type}`;
}

function stripQueryMetadata(markdown: string): string {
  return markdown
    .split('\n')
    .filter((line) => !line.trim().toLowerCase().startsWith('- query:'))
    .join('\n');
}

export function createBlindReviewPacket(
  publication: LivingPublication,
  result: ResearchResult,
): PeerReviewPacket {
  const timestamp = new Date().toISOString();
  const anonymized = [
    '# Blind Review Packet',
    '',
    `- Packet Created: ${timestamp}`,
    `- Version: ${publication.versionLabel}`,
    `- Node Count: ${result.nodes.length}`,
    `- Link Count: ${result.links.length}`,
    '',
    '## Anonymized Draft',
    stripQueryMetadata(publication.markdown),
    '',
    '## Reviewer Instructions',
    '- Evaluate argument coherence, philological validity, and citation adequacy.',
    '- Flag unsupported claims as MAJOR.',
    '- Map comments to publication, node, or link targets.',
  ].join('\n');

  return {
    id: stableHash(`${publication.id}\n${timestamp}\n${anonymized}`),
    versionLabel: `blind-${timestamp.slice(0, 10)}`,
    createdAt: timestamp,
    title: `Blind Packet (${publication.versionLabel})`,
    anonymizedMarkdown: anonymized,
  };
}

export function createPeerReviewComment(input: PeerReviewCommentInput): PeerReviewComment {
  const timestamp = new Date().toISOString();
  return {
    id: stableHash(`${timestamp}-${input.reviewerAlias}-${input.targetType}-${input.targetId}-${input.comment}`),
    reviewerAlias: input.reviewerAlias.trim() || 'Reviewer',
    targetType: input.targetType,
    targetId: input.targetId,
    severity: input.severity,
    comment: input.comment.trim(),
    createdAt: timestamp,
    status: 'open',
  };
}

function uniqueCitations(nodes: Node[]): string[] {
  return Array.from(
    new Set(
      nodes
        .flatMap((node) => node.citations ?? [])
        .map((citation) => citation.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function rejectedCitationCount(nodes: Node[]): number {
  return nodes.reduce((count, node) => count + (node.citationAudit?.rejected?.length ?? 0), 0);
}

export function computeRevisionDiff(
  baseline: { capturedAt: string; result: ResearchResult },
  current: ResearchResult,
): RevisionDiffReport {
  const baselineNodeSet = new Set(baseline.result.nodes.map((node) => node.id));
  const currentNodeSet = new Set(current.nodes.map((node) => node.id));
  const nodesAdded = Array.from(currentNodeSet).filter((nodeId) => !baselineNodeSet.has(nodeId)).sort();
  const nodesRemoved = Array.from(baselineNodeSet).filter((nodeId) => !currentNodeSet.has(nodeId)).sort();

  const baselineLinkSet = new Set(baseline.result.links.map((link) => linkKey(link)));
  const currentLinkSet = new Set(current.links.map((link) => linkKey(link)));
  const linksAdded = Array.from(currentLinkSet).filter((id) => !baselineLinkSet.has(id)).sort();
  const linksRemoved = Array.from(baselineLinkSet).filter((id) => !currentLinkSet.has(id)).sort();

  const baselineCitations = uniqueCitations(baseline.result.nodes);
  const currentCitations = uniqueCitations(current.nodes);
  const baselineCitationSet = new Set(baselineCitations);
  const currentCitationSet = new Set(currentCitations);
  const citationsAdded = currentCitations.filter((citation) => !baselineCitationSet.has(citation));
  const citationsRemoved = baselineCitations.filter((citation) => !currentCitationSet.has(citation));

  return {
    baselineCapturedAt: baseline.capturedAt,
    currentComparedAt: new Date().toISOString(),
    nodesAdded,
    nodesRemoved,
    linksAdded,
    linksRemoved,
    citationsAdded,
    citationsRemoved,
    rejectedCitationCountDelta:
      rejectedCitationCount(current.nodes) - rejectedCitationCount(baseline.result.nodes),
  };
}

export function computePeerReviewGate(comments: PeerReviewComment[]): PeerReviewGate {
  const open = comments.filter((comment) => comment.status === 'open');
  const openMajor = open.filter((comment) => comment.severity === 'major').length;
  const openModerate = open.filter((comment) => comment.severity === 'moderate').length;
  const openMinor = open.filter((comment) => comment.severity === 'minor').length;
  const openQuery = open.filter((comment) => comment.severity === 'query').length;

  const blockers: string[] = [];
  if (openMajor > 0) {
    blockers.push(`${openMajor} major review comments remain open.`);
  }
  if (openModerate > 0) {
    blockers.push(`${openModerate} moderate review comments remain open.`);
  }
  if (openMajor === 0 && openModerate === 0 && openQuery > 0) {
    blockers.push(`${openQuery} open query comments should be acknowledged before presentation.`);
  }

  return {
    openMajor,
    openModerate,
    openMinor,
    openQuery,
    readyForPresentation: openMajor === 0 && openModerate === 0,
    blockers,
  };
}
