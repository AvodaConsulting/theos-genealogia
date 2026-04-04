import type { Node, TextualFluidityReport } from '../types';

function normalizeReading(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function weightFromSignificance(significance: string): number {
  const text = significance.toLowerCase();
  let weight = 1;
  if (/\b(difficilior|harder reading)\b/.test(text)) {
    weight += 0.25;
  }
  if (/\b(earlier|oldest|papyrus|p66|p75|sinaiticus|vaticanus)\b/.test(text)) {
    weight += 0.2;
  }
  if (/\b(harmoniz|smoothing|secondary|later)\b/.test(text)) {
    weight -= 0.15;
  }
  return Math.max(0.2, weight);
}

function toProbabilities(weights: number[]): number[] {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return weights.map(() => 0);
  }
  return weights.map((value) => value / total);
}

export function computeTextualFluidity(node: Node): TextualFluidityReport | undefined {
  const variants = node.manuscriptVariants ?? [];
  if (variants.length === 0) {
    return undefined;
  }

  const grouped = new Map<
    string,
    {
      reading: string;
      witnesses: string[];
      weightedScore: number;
    }
  >();

  for (const variant of variants) {
    const reading = normalizeReading(variant.reading);
    if (!reading) {
      continue;
    }
    if (!grouped.has(reading)) {
      grouped.set(reading, { reading, witnesses: [], weightedScore: 0 });
    }
    const entry = grouped.get(reading) as {
      reading: string;
      witnesses: string[];
      weightedScore: number;
    };
    entry.witnesses.push(variant.manuscript);
    entry.weightedScore += weightFromSignificance(variant.significance);
  }

  const readings = Array.from(grouped.values());
  const probabilities = toProbabilities(readings.map((entry) => entry.weightedScore));

  const urtextCloud = readings
    .map((entry, index) => ({
      reading: entry.reading,
      probability: probabilities[index] ?? 0,
      witnesses: entry.witnesses,
    }))
    .sort((a, b) => b.probability - a.probability);

  const maxProb = urtextCloud[0]?.probability ?? 1;
  const driftIndex = Math.max(0, Math.min(1, 1 - maxProb));
  const assessment =
    driftIndex > 0.5
      ? 'High textual fluidity: no single dominant reading controls the witness stream.'
      : driftIndex > 0.25
        ? 'Moderate textual fluidity: dominant reading exists but alternatives remain non-trivial.'
        : 'Low textual fluidity: one reading strongly dominates the witness stream.';

  return {
    nodeId: node.id,
    witnessCount: variants.length,
    variantCount: urtextCloud.length,
    urtextCloud: urtextCloud.slice(0, 5),
    driftIndex,
    assessment,
  };
}
