import type { OutlineProposal, ResearchNote, ResearchResult } from '../types';

function uniqueCitations(result: ResearchResult): string[] {
  return Array.from(
    new Set(
      result.nodes
        .flatMap((node) => node.citations ?? [])
        .map((citation) => citation.trim())
        .filter(Boolean),
    ),
  );
}

function bibliographyStyles(citations: string[]): OutlineProposal['bibliographyByStyle'] {
  const sbl = citations.map((citation) => citation);
  const chicago = citations.map((citation) => `${citation}. Accessed ${new Date().toISOString().slice(0, 10)}.`);
  const mla = citations.map((citation) => `"${citation}." TheosGenealogia Research Corpus.`);
  return { sbl, chicago, mla };
}

export function buildOutlineProposal(
  query: string,
  result: ResearchResult,
  notes: ResearchNote[],
): OutlineProposal {
  const sourceCounts = result.nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.source] = (acc[node.source] ?? 0) + 1;
    return acc;
  }, {});

  const traditionCount = new Set(
    result.nodes.map((node) => node.tradition?.id).filter((value): value is string => Boolean(value)),
  ).size;

  const sections = [
    {
      heading: 'Research Problem and Corpus Boundary',
      rationale: 'Define temporal and corpus limits (HB to 70 CE) and justify data selection.',
    },
    {
      heading: 'Parallel Tradition Mapping',
      rationale: 'Present independent streams before convergence claims to avoid synthetic harmonization.',
    },
    {
      heading: 'Philological and Rupture Diagnostics',
      rationale: 'Document semantic/syntactic ruptures, untranslatables, and historical silences.',
    },
    {
      heading: 'Intertextual and Textual-Fluidity Evaluation',
      rationale: 'Report significance tests and manuscript variant probabilities.',
    },
    {
      heading: 'Methodological Reflection and Thesis',
      rationale: 'State what is secure, contested, and speculative.',
    },
  ];

  const argumentGaps: string[] = [];
  if ((sourceCounts.OT ?? 0) === 0) {
    argumentGaps.push('No OT nodes detected; genealogical baseline is underdetermined.');
  }
  if ((sourceCounts.STP ?? 0) === 0) {
    argumentGaps.push('No STP nodes detected; second-temple mediation layer is missing.');
  }
  if ((sourceCounts.NT ?? 0) === 0) {
    argumentGaps.push('No NT nodes detected; reception trajectory cannot be tested.');
  }
  if (traditionCount < 2) {
    argumentGaps.push('Only one tradition stream identified; verify whether plurality is being flattened.');
  }
  if (!result.nodes.some((node) => node.ruptureAnalysis)) {
    argumentGaps.push('No rupture diagnostics present; add semantic/syntactic break analysis.');
  }
  if (!result.nodes.some((node) => (node.manuscriptVariants?.length ?? 0) > 0)) {
    argumentGaps.push('No manuscript variant evidence attached yet.');
  }
  if (notes.filter((note) => note.kind === 'question').length === 0) {
    argumentGaps.push('No open research questions captured in notes; add unresolved issues before submission.');
  }

  const citations = uniqueCitations(result);
  return {
    generatedAt: new Date().toISOString(),
    title: `Outline: ${query.slice(0, 120)}`,
    sections,
    argumentGaps,
    bibliographyByStyle: bibliographyStyles(citations),
  };
}
