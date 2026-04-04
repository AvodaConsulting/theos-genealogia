import type { IntertextualityStatsReport, Link, Node } from '../types';

const STOPWORDS = new Set([
  'the',
  'and',
  'or',
  'of',
  'in',
  'to',
  'for',
  'with',
  'on',
  'at',
  'from',
  'by',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'being',
  'been',
  'that',
  'this',
  'these',
  'those',
  'it',
  'its',
  'not',
  'but',
  'an',
  'a',
  'he',
  'she',
  'they',
  'we',
  'you',
  'i',
  'his',
  'her',
  'their',
  'our',
  'your',
  'who',
  'whom',
  'which',
  'what',
  'when',
  'where',
  'why',
  'how',
  'then',
  'than',
  'there',
  'here',
  'also',
]);

function linkId(link: Pick<Link, 'source' | 'target' | 'type'>): string {
  return `${link.source}::${link.target}::${link.type}`;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}[\p{L}\p{N}'-]*/gu) ?? [])
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function toSet<T>(items: T[]): Set<T> {
  return new Set(items);
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function buildNgrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) {
    return [];
  }
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i += 1) {
    out.push(tokens.slice(i, i + n).join(' '));
  }
  return out;
}

function sentenceSignatures(text: string): string[] {
  const sentences = text.split(/[.!?;:]+/).map((entry) => entry.trim()).filter(Boolean);
  const functionWords = new Set(['the', 'and', 'of', 'to', 'in', 'for', 'with', 'on', 'from', 'by', 'is', 'are']);

  return sentences
    .map((sentence) => tokenize(sentence))
    .filter((tokens) => tokens.length > 0)
    .map((tokens) =>
      tokens
        .map((token) => (functionWords.has(token) ? 'f' : 'c'))
        .join('')
        .replace(/(.)\1+/g, '$1'),
    );
}

function tokenFrequency(tokens: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const token of tokens) {
    out.set(token, (out.get(token) ?? 0) + 1);
  }
  return out;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [, value] of a) {
    normA += value * value;
  }
  for (const [, value] of b) {
    normB += value * value;
  }

  for (const [token, aValue] of a) {
    const bValue = b.get(token) ?? 0;
    if (bValue > 0) {
      dot += aValue * bValue;
    }
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function contextualRarityScore(
  overlap: Set<string>,
  corpusTokens: Array<Set<string>>,
): number {
  if (overlap.size === 0 || corpusTokens.length === 0) {
    return 0;
  }

  const nDocs = corpusTokens.length;
  const idfValues: number[] = [];
  for (const token of overlap) {
    let df = 0;
    for (const doc of corpusTokens) {
      if (doc.has(token)) {
        df += 1;
      }
    }
    const idf = Math.log((nDocs + 1) / (df + 1)) + 1;
    idfValues.push(idf);
  }

  if (idfValues.length === 0) {
    return 0;
  }
  const maxIdf = Math.max(...idfValues);
  const avgIdf = idfValues.reduce((sum, value) => sum + value, 0) / idfValues.length;
  return maxIdf === 0 ? 0 : clamp01(avgIdf / maxIdf);
}

function compositeScore(metrics: {
  lexicalJaccard: number;
  ngramJaccard: number;
  syntacticSimilarity: number;
  conceptualCosine: number;
  contextualRarity: number;
}): number {
  const base =
    metrics.lexicalJaccard * 0.25 +
    metrics.ngramJaccard * 0.2 +
    metrics.syntacticSimilarity * 0.2 +
    metrics.conceptualCosine * 0.25 +
    metrics.contextualRarity * 0.1;
  return clamp01(base);
}

function band(value: number, low = 0.2, high = 0.45): 'low' | 'medium' | 'high' {
  if (value < low) {
    return 'low';
  }
  if (value < high) {
    return 'medium';
  }
  return 'high';
}

export function computeIntertextualityStats(
  graph: { nodes: Node[]; links: Link[] },
  link: Pick<Link, 'source' | 'target' | 'type'>,
  iterations = 400,
): IntertextualityStatsReport | null {
  const sourceNode = graph.nodes.find((node) => node.id === link.source);
  const targetNode = graph.nodes.find((node) => node.id === link.target);
  if (!sourceNode || !targetNode) {
    return null;
  }

  const sourceTokens = tokenize(`${sourceNode.label} ${sourceNode.content} ${sourceNode.citations.join(' ')}`);
  const targetTokens = tokenize(`${targetNode.label} ${targetNode.content} ${targetNode.citations.join(' ')}`);
  const sourceSet = toSet(sourceTokens);
  const targetSet = toSet(targetTokens);
  const overlap = new Set([...sourceSet].filter((token) => targetSet.has(token)));

  const lexicalJaccard = jaccard(sourceSet, targetSet);
  const ngramJaccard = jaccard(toSet(buildNgrams(sourceTokens, 2)), toSet(buildNgrams(targetTokens, 2)));
  const syntacticSimilarity = jaccard(toSet(sentenceSignatures(sourceNode.content)), toSet(sentenceSignatures(targetNode.content)));
  const conceptualCosine = cosineSimilarity(tokenFrequency(sourceTokens), tokenFrequency(targetTokens));
  const conceptualDistance = clamp01(1 - conceptualCosine);

  const corpusTokenSets = graph.nodes.map((node) =>
    toSet(tokenize(`${node.label} ${node.content} ${node.citations.join(' ')}`)),
  );
  const contextualRarity = contextualRarityScore(overlap, corpusTokenSets);

  const observedComposite = compositeScore({
    lexicalJaccard,
    ngramJaccard,
    syntacticSimilarity,
    conceptualCosine,
    contextualRarity,
  });

  const random = mulberry32(hashString(linkId(link)));
  let extremeCount = 0;
  const eligible = graph.nodes.filter((node) => node.content.trim().length > 0);
  if (eligible.length >= 3) {
    for (let i = 0; i < iterations; i += 1) {
      const firstIndex = Math.floor(random() * eligible.length);
      let secondIndex = Math.floor(random() * eligible.length);
      if (secondIndex === firstIndex) {
        secondIndex = (secondIndex + 1) % eligible.length;
      }
      const a = eligible[firstIndex];
      const b = eligible[secondIndex];

      const aTokens = tokenize(`${a.label} ${a.content}`);
      const bTokens = tokenize(`${b.label} ${b.content}`);
      const aSet = toSet(aTokens);
      const bSet = toSet(bTokens);
      const overlapTokens = new Set([...aSet].filter((token) => bSet.has(token)));

      const score = compositeScore({
        lexicalJaccard: jaccard(aSet, bSet),
        ngramJaccard: jaccard(toSet(buildNgrams(aTokens, 2)), toSet(buildNgrams(bTokens, 2))),
        syntacticSimilarity: jaccard(toSet(sentenceSignatures(a.content)), toSet(sentenceSignatures(b.content))),
        conceptualCosine: cosineSimilarity(tokenFrequency(aTokens), tokenFrequency(bTokens)),
        contextualRarity: contextualRarityScore(overlapTokens, corpusTokenSets),
      });
      if (score >= observedComposite) {
        extremeCount += 1;
      }
    }
  }

  const pValue = clamp01((extremeCount + 1) / (iterations + 1));
  const overlapTokens = [...overlap].slice(0, 16);
  const interpretation =
    pValue < 0.01
      ? 'Intertextual signal is statistically non-random under corpus permutation baseline.'
      : pValue < 0.05
        ? 'Intertextual signal is moderate and likely non-random, but requires philological corroboration.'
        : 'Signal does not exceed random baseline strongly; treat as weak or indirect intertextuality.';

  return {
    linkId: linkId(link),
    sourceNodeId: sourceNode.id,
    targetNodeId: targetNode.id,
    lexicalJaccard,
    ngramJaccard,
    syntacticSimilarity,
    conceptualCosine,
    conceptualDistance,
    contextualRarity,
    compositeScore: observedComposite,
    pValue,
    permutationIterations: iterations,
    overlapTokens,
    interpretation,
  };
}

export function statsToLinkMetrics(
  report: IntertextualityStatsReport,
): NonNullable<Link['intertextualityMetrics']> {
  return {
    lexicalOverlap: band(report.lexicalJaccard),
    syntacticSimilarity: band(report.syntacticSimilarity),
    conceptualDistance: band(report.conceptualDistance, 0.35, 0.65),
    contextualRarity: band(report.contextualRarity, 0.33, 0.66),
    pValue: report.pValue.toExponential(2),
    conclusion: report.interpretation,
  };
}
