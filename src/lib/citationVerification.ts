import type { Node } from '../types';

interface RawCrossrefWork {
  title?: string[];
  DOI?: string;
  published?: { 'date-parts'?: number[][] };
  issued?: { 'date-parts'?: number[][] };
  author?: Array<{ family?: string; given?: string }>;
}

interface CitationVerificationInput {
  query: string;
  context: string;
  citations: string[];
}

interface CitationDecision {
  citation: string;
  verified: boolean;
  reason: string;
}

export interface CitationAuditResult {
  verified: string[];
  rejected: Array<{ citation: string; reason: string }>;
  checkedAt: string;
  verifier: string;
}

const BOOK_CHAPTERS: Record<string, number> = {
  genesis: 50,
  exodus: 40,
  leviticus: 27,
  numbers: 36,
  deuteronomy: 34,
  joshua: 24,
  judges: 21,
  ruth: 4,
  '1samuel': 31,
  '2samuel': 24,
  '1kings': 22,
  '2kings': 25,
  '1chronicles': 29,
  '2chronicles': 36,
  'psalmsofsolomon': 18,
  ezra: 10,
  nehemiah: 13,
  esther: 10,
  job: 42,
  psalms: 150,
  proverbs: 31,
  ecclesiastes: 12,
  songofsongs: 8,
  isaiah: 66,
  jeremiah: 52,
  lamentations: 5,
  ezekiel: 48,
  daniel: 12,
  hosea: 14,
  joel: 3,
  amos: 9,
  obadiah: 1,
  jonah: 4,
  micah: 7,
  nahum: 3,
  habakkuk: 3,
  zephaniah: 3,
  haggai: 2,
  zechariah: 14,
  malachi: 4,
  matthew: 28,
  mark: 16,
  luke: 24,
  john: 21,
  acts: 28,
  romans: 16,
  '1corinthians': 16,
  '2corinthians': 13,
  galatians: 6,
  ephesians: 6,
  philippians: 4,
  colossians: 4,
  '1thessalonians': 5,
  '2thessalonians': 3,
  '1timothy': 6,
  '2timothy': 4,
  titus: 3,
  philemon: 1,
  hebrews: 13,
  james: 5,
  '1peter': 5,
  '2peter': 3,
  '1john': 5,
  '2john': 1,
  '3john': 1,
  jude: 1,
  revelation: 22,
  wisdomofsolomon: 19,
  sirach: 51,
  '1enoch': 108,
  '2enoch': 73,
  jubilees: 50,
  '4ezra': 16,
  '2baruch': 87,
  '1maccabees': 16,
  '2maccabees': 15,
};

const BOOK_ALIASES: Record<string, string> = {
  gen: 'genesis',
  genesis: 'genesis',
  exod: 'exodus',
  exodus: 'exodus',
  lev: 'leviticus',
  leviticus: 'leviticus',
  num: 'numbers',
  numbers: 'numbers',
  deut: 'deuteronomy',
  deuteronomy: 'deuteronomy',
  josh: 'joshua',
  joshua: 'joshua',
  judg: 'judges',
  judges: 'judges',
  ruth: 'ruth',
  '1sam': '1samuel',
  '2sam': '2samuel',
  '1kgs': '1kings',
  '2kgs': '2kings',
  '1chr': '1chronicles',
  '2chr': '2chronicles',
  '1chron': '1chronicles',
  '2chron': '2chronicles',
  '1ch': '1chronicles',
  '2ch': '2chronicles',
  ezra: 'ezra',
  neh: 'nehemiah',
  nehemiah: 'nehemiah',
  esth: 'esther',
  esther: 'esther',
  job: 'job',
  ps: 'psalms',
  psa: 'psalms',
  psalm: 'psalms',
  psalms: 'psalms',
  prov: 'proverbs',
  proverbs: 'proverbs',
  eccl: 'ecclesiastes',
  ecclesiastes: 'ecclesiastes',
  song: 'songofsongs',
  songofsongs: 'songofsongs',
  isa: 'isaiah',
  isaiah: 'isaiah',
  jer: 'jeremiah',
  jeremiah: 'jeremiah',
  lam: 'lamentations',
  lamentations: 'lamentations',
  ezek: 'ezekiel',
  ezekiel: 'ezekiel',
  dan: 'daniel',
  daniel: 'daniel',
  hos: 'hosea',
  hosea: 'hosea',
  joel: 'joel',
  amos: 'amos',
  obad: 'obadiah',
  obadiah: 'obadiah',
  jonah: 'jonah',
  mic: 'micah',
  micah: 'micah',
  nah: 'nahum',
  nahum: 'nahum',
  hab: 'habakkuk',
  habakkuk: 'habakkuk',
  zeph: 'zephaniah',
  zephaniah: 'zephaniah',
  hag: 'haggai',
  haggai: 'haggai',
  zech: 'zechariah',
  zechariah: 'zechariah',
  mal: 'malachi',
  malachi: 'malachi',
  matt: 'matthew',
  matthew: 'matthew',
  mark: 'mark',
  luke: 'luke',
  john: 'john',
  acts: 'acts',
  rom: 'romans',
  romans: 'romans',
  '1cor': '1corinthians',
  '2cor': '2corinthians',
  gal: 'galatians',
  galatians: 'galatians',
  eph: 'ephesians',
  ephesians: 'ephesians',
  phil: 'philippians',
  philippians: 'philippians',
  col: 'colossians',
  colossians: 'colossians',
  '1thess': '1thessalonians',
  '2thess': '2thessalonians',
  '1tim': '1timothy',
  '2tim': '2timothy',
  titus: 'titus',
  phlm: 'philemon',
  philemon: 'philemon',
  heb: 'hebrews',
  hebrews: 'hebrews',
  james: 'james',
  '1pet': '1peter',
  '2pet': '2peter',
  '1jn': '1john',
  '2jn': '2john',
  '3jn': '3john',
  jude: 'jude',
  rev: 'revelation',
  revelation: 'revelation',
  wis: 'wisdomofsolomon',
  wisdom: 'wisdomofsolomon',
  wisdomofsolomon: 'wisdomofsolomon',
  sir: 'sirach',
  sirach: 'sirach',
  ecclesiasticus: 'sirach',
  '1en': '1enoch',
  '1enoch': '1enoch',
  '2en': '2enoch',
  '2enoch': '2enoch',
  jub: 'jubilees',
  jubilees: 'jubilees',
  '4ezr': '4ezra',
  '4ezra': '4ezra',
  '2bar': '2baruch',
  '2baruch': '2baruch',
  '1macc': '1maccabees',
  '1maccabees': '1maccabees',
  '2macc': '2maccabees',
  '2maccabees': '2maccabees',
  'psssol': 'psalmsofsolomon',
  'pssol': 'psalmsofsolomon',
  'psalmsofsolomon': 'psalmsofsolomon',
};

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}[\p{L}\p{N}'-]*/gu) ?? []).filter((token) => token.length > 1);
}

function overlapRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const aSet = new Set(a);
  const bSet = new Set(b);
  let hit = 0;
  for (const token of aSet) {
    if (bSet.has(token)) {
      hit += 1;
    }
  }
  return hit / Math.max(aSet.size, bSet.size);
}

function cleanBiblePrefix(value: string): string {
  return value.replace(/\b(?:LXX|MT|HB|GNT|NA28|UBS5)\b/gi, '').trim();
}

function normalizeBookToken(raw: string): string | null {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!compact) {
    return null;
  }

  if (BOOK_ALIASES[compact]) {
    return BOOK_ALIASES[compact];
  }

  return null;
}

function verifyScriptureCitation(citation: string): CitationDecision | null {
  const stripped = cleanBiblePrefix(normalizeSpaces(citation));
  const manuscriptSiglumPattern = /^\s*[1-9]\d?Q[A-Za-z0-9-]+\b/i;
  if (manuscriptSiglumPattern.test(stripped)) {
    return null;
  }
  const match = stripped.match(/^([1-3]?\s*[A-Za-z. ]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!match) {
    return null;
  }

  const rawBook = normalizeSpaces(match[1] ?? '');
  const chapter = Number.parseInt(match[2] ?? '', 10);
  const verseStart = match[3] ? Number.parseInt(match[3], 10) : null;
  const verseEnd = match[4] ? Number.parseInt(match[4], 10) : null;
  const book = normalizeBookToken(rawBook);

  if (!book) {
    return {
      citation,
      verified: false,
      reason: `Unknown biblical book token: "${rawBook}".`,
    };
  }

  const maxChapter = BOOK_CHAPTERS[book];
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > maxChapter) {
    return {
      citation,
      verified: false,
      reason: `Invalid chapter for ${book}: ${chapter}.`,
    };
  }

  if (verseStart !== null && verseStart < 1) {
    return {
      citation,
      verified: false,
      reason: 'Verse numbering must start from 1.',
    };
  }

  if (verseStart !== null && verseEnd !== null && verseEnd < verseStart) {
    return {
      citation,
      verified: false,
      reason: 'Verse range is reversed.',
    };
  }

  return {
    citation,
    verified: true,
    reason: 'Validated as scriptural-style reference.',
  };
}

function verifyCorpusCitation(citation: string): CitationDecision | null {
  const normalized = normalizeSpaces(citation);

  const manuscriptPattern =
    /\b(?:P\d{2,3}|Papyrus\s*\d{2,3}|Codex\s+(?:Sinaiticus|Vaticanus|Alexandrinus)|[1-9]\d?Q[A-Za-z0-9-]+|DSS)\b/i;
  if (manuscriptPattern.test(normalized)) {
    return {
      citation,
      verified: true,
      reason: 'Matches recognized manuscript witness pattern.',
    };
  }

  const josephusPattern =
    /\bJosephus,\s*(?:Ant(?:\.|iquities)?|War)\s+\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?\b/i;
  if (josephusPattern.test(normalized)) {
    return {
      citation,
      verified: true,
      reason: 'Matches Josephus work citation pattern.',
    };
  }

  const philoPattern = /\bPhilo,\s*[A-Za-z ]+\b/i;
  if (philoPattern.test(normalized)) {
    return {
      citation,
      verified: true,
      reason: 'Matches Philo work citation pattern.',
    };
  }

  const stpPattern =
    /\b(?:1\s*En(?:och)?\.?|2\s*En(?:och)?\.?|Jub(?:ilees)?\.?|Sir(?:ach)?\.?|Wis(?:dom)?(?:\s+of\s+Solomon)?\.?|4\s*Ezr(?:a)?\.?|2\s*Bar(?:uch)?\.?)\b/i;
  if (stpPattern.test(normalized)) {
    return {
      citation,
      verified: true,
      reason: 'Matches Second Temple corpus citation pattern.',
    };
  }

  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function extractYear(work: RawCrossrefWork): number | null {
  const parts = work.published?.['date-parts'] ?? work.issued?.['date-parts'];
  if (!parts || !parts[0] || !Number.isFinite(parts[0][0])) {
    return null;
  }
  return parts[0][0];
}

async function verifyWithCrossref(
  citation: string,
  query: string,
  context: string,
): Promise<CitationDecision> {
  const doiMatch = citation.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
  const contextTokens = tokenize(`${query} ${context}`);

  if (doiMatch) {
    const doi = doiMatch[0];
    try {
      const payload = (await fetchJson(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      )) as { message?: RawCrossrefWork };
      const message = payload?.message;
      const title = message?.title?.[0] ?? '';
      const relevance = overlapRatio(tokenize(title), contextTokens);
      if (message && title && relevance >= 0.08) {
        return {
          citation,
          verified: true,
          reason: `DOI resolved in Crossref and passed relevance test (${relevance.toFixed(2)}).`,
        };
      }
      return {
        citation,
        verified: false,
        reason: 'DOI exists but contextual relevance score is too low.',
      };
    } catch (error) {
      return {
        citation,
        verified: false,
        reason: `DOI lookup failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      };
    }
  }

  try {
    const payload = (await fetchJson(
      `https://api.crossref.org/works?rows=3&query.bibliographic=${encodeURIComponent(citation)}`,
    )) as { message?: { items?: RawCrossrefWork[] } };
    const items = payload?.message?.items ?? [];
    if (items.length === 0) {
      return {
        citation,
        verified: false,
        reason: 'No Crossref candidate matched this bibliographic string.',
      };
    }

    let bestScore = 0;
    for (const item of items) {
      const title = item.title?.[0] ?? '';
      const year = extractYear(item);
      const bibliographic = `${title} ${year ?? ''}`;
      const score = overlapRatio(tokenize(citation), tokenize(bibliographic));
      if (score > bestScore) {
        bestScore = score;
      }
    }

    if (bestScore >= 0.35) {
      return {
        citation,
        verified: true,
        reason: `Crossref bibliographic match verified (score=${bestScore.toFixed(2)}).`,
      };
    }

    return {
      citation,
      verified: false,
      reason: `Crossref candidates found but similarity too low (score=${bestScore.toFixed(2)}).`,
    };
  } catch (error) {
    return {
      citation,
      verified: false,
      reason: `Crossref search failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
    };
  }
}

export async function auditCitations({
  query,
  context,
  citations,
}: CitationVerificationInput): Promise<CitationAuditResult> {
  const unique = Array.from(new Set(citations.map((citation) => normalizeSpaces(citation)).filter(Boolean)));
  const decisions: CitationDecision[] = [];

  for (const citation of unique) {
    const scriptural = verifyScriptureCitation(citation);
    if (scriptural) {
      decisions.push(scriptural);
      continue;
    }

    const corpus = verifyCorpusCitation(citation);
    if (corpus) {
      decisions.push(corpus);
      continue;
    }

    const crossref = await verifyWithCrossref(citation, query, context);
    decisions.push(crossref);
  }

  return {
    verified: decisions.filter((entry) => entry.verified).map((entry) => entry.citation),
    rejected: decisions
      .filter((entry) => !entry.verified)
      .map((entry) => ({ citation: entry.citation, reason: entry.reason })),
    checkedAt: new Date().toISOString(),
    verifier: 'rule-engine+crossref',
  };
}

export async function auditNodeCitations(node: Node, query: string): Promise<Node> {
  if (!node.citations || node.citations.length === 0) {
    return {
      ...node,
      citationAudit: {
        verified: [],
        rejected: [],
        checkedAt: new Date().toISOString(),
        verifier: 'rule-engine+crossref',
      },
    };
  }

  const audit = await auditCitations({
    query,
    context: `${node.label}\n${node.content}`,
    citations: node.citations,
  });

  return {
    ...node,
    citations: audit.verified,
    citationAudit: audit,
  };
}
