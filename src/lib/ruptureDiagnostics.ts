import type { NegativeScriptureEntry, NegativeScriptureIndex, Node } from '../types';

const OT_BOOK_ALIASES: Record<string, string> = {
  gen: 'Genesis',
  genesis: 'Genesis',
  exod: 'Exodus',
  exodus: 'Exodus',
  lev: 'Leviticus',
  leviticus: 'Leviticus',
  num: 'Numbers',
  numbers: 'Numbers',
  deut: 'Deuteronomy',
  deuteronomy: 'Deuteronomy',
  josh: 'Joshua',
  joshua: 'Joshua',
  judg: 'Judges',
  judges: 'Judges',
  ruth: 'Ruth',
  '1sam': '1 Samuel',
  '2sam': '2 Samuel',
  '1kgs': '1 Kings',
  '2kgs': '2 Kings',
  '1chr': '1 Chronicles',
  '2chr': '2 Chronicles',
  ezra: 'Ezra',
  neh: 'Nehemiah',
  nehemiah: 'Nehemiah',
  esth: 'Esther',
  esther: 'Esther',
  job: 'Job',
  ps: 'Psalms',
  psa: 'Psalms',
  psalms: 'Psalms',
  prov: 'Proverbs',
  proverbs: 'Proverbs',
  eccl: 'Ecclesiastes',
  ecclesiastes: 'Ecclesiastes',
  song: 'Song of Songs',
  songofsongs: 'Song of Songs',
  isa: 'Isaiah',
  isaiah: 'Isaiah',
  jer: 'Jeremiah',
  jeremiah: 'Jeremiah',
  lam: 'Lamentations',
  lamentations: 'Lamentations',
  ezek: 'Ezekiel',
  ezekiel: 'Ezekiel',
  dan: 'Daniel',
  daniel: 'Daniel',
  hos: 'Hosea',
  hosea: 'Hosea',
  joel: 'Joel',
  amos: 'Amos',
  obad: 'Obadiah',
  obadiah: 'Obadiah',
  jonah: 'Jonah',
  mic: 'Micah',
  micah: 'Micah',
  nah: 'Nahum',
  nahum: 'Nahum',
  hab: 'Habakkuk',
  habakkuk: 'Habakkuk',
  zeph: 'Zephaniah',
  zephaniah: 'Zephaniah',
  hag: 'Haggai',
  haggai: 'Haggai',
  zech: 'Zechariah',
  zechariah: 'Zechariah',
  mal: 'Malachi',
  malachi: 'Malachi',
};

const HIGH_SIGNAL_SILENCES = new Set(['Esther', 'Song of Songs']);

function normalizeBookToken(raw: string): string | null {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!compact) {
    return null;
  }
  return OT_BOOK_ALIASES[compact] ?? null;
}

function parseBookFromCitation(citation: string): string | null {
  const normalized = citation
    .replace(/\b(?:LXX|MT|HB|GNT|NA28|UBS5)\b/gi, '')
    .trim();
  const match = normalized.match(/^([1-3]?\s*[A-Za-z. ]+)\s+\d+(?::\d+(?:-\d+)?)?$/);
  if (!match) {
    return null;
  }
  return normalizeBookToken(match[1] ?? '');
}

function ideologicalNote(book: string): string {
  if (book === 'Song of Songs') {
    return 'Absence in NT citation chains may correlate with suppression of erotic-bodily discourse in dominant reception lines.';
  }
  if (book === 'Esther') {
    return 'Silence around Esther may track discomfort with diaspora political survival motifs lacking explicit theophany.';
  }
  return 'Potential omission pattern requiring historical-critical explanation.';
}

export function buildNegativeScriptureIndex(nodes: Node[]): NegativeScriptureIndex {
  const ntBookCounts = new Map<string, number>();
  const nonNtBookCounts = new Map<string, number>();

  for (const node of nodes) {
    for (const citation of node.citations ?? []) {
      const book = parseBookFromCitation(citation);
      if (!book) {
        continue;
      }
      const targetMap = node.source === 'NT' ? ntBookCounts : nonNtBookCounts;
      targetMap.set(book, (targetMap.get(book) ?? 0) + 1);
    }
  }

  const absentInNT: NegativeScriptureEntry[] = Array.from(nonNtBookCounts.entries())
    .filter(([book]) => !ntBookCounts.has(book))
    .map(([book, mentionCountOutsideNT]) => ({
      book,
      mentionCountOutsideNT,
      ideologicalFunction: ideologicalNote(book),
    }))
    .sort((a, b) => b.mentionCountOutsideNT - a.mentionCountOutsideNT || a.book.localeCompare(b.book));

  const highlighted = absentInNT.filter((entry) => HIGH_SIGNAL_SILENCES.has(entry.book));
  const notes = [
    `${absentInNT.length} OT books appear in non-NT corpus citations but not in NT-node citation chains.`,
    highlighted.length > 0
      ? `High-signal silences detected: ${highlighted.map((entry) => entry.book).join(', ')}.`
      : 'No predefined high-signal silence (Esther/Song of Songs) detected in current graph.',
  ];

  return {
    generatedAt: new Date().toISOString(),
    absentInNT: absentInNT.slice(0, 30),
    notes,
  };
}

function mergeUniqueByKey<T>(items: T[], key: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(key(item), item);
  }
  return Array.from(map.values());
}

export function applyHeuristicRuptureDiagnostics(node: Node): Node {
  const semantic = [...(node.ruptureAnalysis?.semanticRuptures ?? [])];
  const syntactic = [...(node.ruptureAnalysis?.syntacticRuptures ?? [])];
  const untranslatables = [...(node.ruptureAnalysis?.untranslatables ?? [])];

  const hebrew = node.linguisticAnalysis?.hebrewTerm?.trim();
  const lxx = node.linguisticAnalysis?.lxxEquivalent?.trim();
  if (hebrew && lxx && hebrew.toLowerCase() !== lxx.toLowerCase()) {
    semantic.push({
      from: hebrew,
      to: lxx,
      significance:
        'Heuristic alert: source and translation lemmas diverge, potentially indicating conceptual substitution rather than simple lexical transfer.',
    });
  }

  const genderGrammar = node.linguisticAnalysis?.genderGrammar?.trim();
  if (genderGrammar && /(?:feminine|masculine|neuter|->|→)/i.test(genderGrammar)) {
    syntactic.push({
      from: 'Gendered grammar profile',
      to: genderGrammar,
      significance:
        'Heuristic alert: grammatical-gender shift may reframe agency/personhood in subsequent doctrinal reception.',
    });
  }

  const untranslatable = node.linguisticAnalysis?.untranslatable?.trim();
  if (untranslatable) {
    untranslatables.push({
      term: untranslatable,
      lossProfile:
        'Heuristic alert: flagged as untranslatable; inspect legal, embodied, and cosmological dimensions for semantic loss.',
      implications:
        'Potential conceptual compression during translation and reception.',
    });
  }

  const mergedSemantic = mergeUniqueByKey(semantic, (entry) => `${entry.from}::${entry.to}`);
  const mergedSyntactic = mergeUniqueByKey(syntactic, (entry) => `${entry.from}::${entry.to}`);
  const mergedUnt = mergeUniqueByKey(untranslatables, (entry) => entry.term);

  const hasAny =
    mergedSemantic.length > 0 ||
    mergedSyntactic.length > 0 ||
    mergedUnt.length > 0 ||
    (node.ruptureAnalysis?.historicalSilences?.length ?? 0) > 0;

  if (!hasAny) {
    return node;
  }

  return {
    ...node,
    ruptureAnalysis: {
      ...node.ruptureAnalysis,
      semanticRuptures: mergedSemantic.length > 0 ? mergedSemantic : undefined,
      syntacticRuptures: mergedSyntactic.length > 0 ? mergedSyntactic : undefined,
      untranslatables: mergedUnt.length > 0 ? mergedUnt : undefined,
      historicalSilences:
        node.ruptureAnalysis?.historicalSilences && node.ruptureAnalysis.historicalSilences.length > 0
          ? node.ruptureAnalysis.historicalSilences
          : undefined,
    },
  };
}

export function applyHeuristicRuptureDiagnosticsToGraph(nodes: Node[]): Node[] {
  return nodes.map((node) => applyHeuristicRuptureDiagnostics(node));
}
