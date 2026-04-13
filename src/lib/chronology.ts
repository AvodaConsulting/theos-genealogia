import type { AppLanguage, Node } from '../types';

export type ChronologyConfidence = 'high' | 'medium' | 'low';

export interface ChronologyInference {
  year: number;
  anchor: string;
  confidence: ChronologyConfidence;
  warning?: string;
}

const SOURCE_FALLBACK_YEAR: Record<Node['source'], number> = {
  ANE: -1200,
  OT: -550,
  STP: -150,
  NT: 60,
  Hellenistic: -250,
  Manuscript: 200,
};

const NT_BOOK_YEAR: Record<string, number> = {
  matthew: 80,
  mark: 70,
  luke: 85,
  john: 95,
  acts: 90,
  romans: 57,
  '1corinthians': 54,
  '2corinthians': 56,
  galatians: 49,
  ephesians: 62,
  philippians: 61,
  colossians: 60,
  '1thessalonians': 50,
  '2thessalonians': 51,
  '1timothy': 63,
  '2timothy': 66,
  titus: 63,
  philemon: 61,
  hebrews: 70,
  james: 60,
  '1peter': 63,
  '2peter': 80,
  '1john': 95,
  '2john': 95,
  '3john': 95,
  jude: 75,
  revelation: 96,
};

const STP_BOOK_YEAR: Record<string, number> = {
  wisdomofsolomon: -30,
  sirach: -180,
  '1enoch': -150,
  '2enoch': 40,
  jubilees: -150,
  '4ezra': 95,
  '2baruch': 90,
  '1maccabees': -100,
  '2maccabees': -80,
  psalmsofsolomon: -40,
};

const OT_FINAL_FORM_YEAR: Record<string, number> = {
  genesis: -450,
  exodus: -450,
  leviticus: -450,
  numbers: -450,
  deuteronomy: -430,
  joshua: -500,
  judges: -500,
  ruth: -450,
  '1samuel': -550,
  '2samuel': -550,
  '1kings': -550,
  '2kings': -550,
  '1chronicles': -350,
  '2chronicles': -350,
  ezra: -350,
  nehemiah: -350,
  esther: -300,
  job: -350,
  psalms: -300,
  proverbs: -300,
  ecclesiastes: -250,
  songofsongs: -300,
  isaiah: -500,
  jeremiah: -500,
  lamentations: -500,
  ezekiel: -500,
  daniel: -165,
  hosea: -550,
  joel: -400,
  amos: -550,
  obadiah: -500,
  jonah: -350,
  micah: -550,
  nahum: -500,
  habakkuk: -500,
  zephaniah: -550,
  haggai: -520,
  zechariah: -500,
  malachi: -450,
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
  psalmsofsolomon: 'psalmsofsolomon',
};

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeBookToken(raw: string): string | null {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!compact) {
    return null;
  }
  return BOOK_ALIASES[compact] ?? null;
}

function inferFromCitation(citation: string): ChronologyInference | null {
  const normalized = normalizeSpaces(citation);

  if (/\bLXX\b/i.test(normalized)) {
    return {
      year: -220,
      anchor: `LXX translation layer inferred from citation: ${normalized}`,
      confidence: 'medium',
      warning:
        'LXX books were translated over multiple centuries; plotted as a midpoint heuristic.',
    };
  }

  if (/\b(?:Josephus|Antiquities|War)\b/i.test(normalized)) {
    return {
      year: 93,
      anchor: `Josephus-era witness inferred from citation: ${normalized}`,
      confidence: 'medium',
    };
  }
  if (/\bPhilo\b/i.test(normalized)) {
    return {
      year: 30,
      anchor: `Philo-era witness inferred from citation: ${normalized}`,
      confidence: 'medium',
    };
  }
  if (/\b(?:1\s*En(?:och)?\.?|Jub(?:ilees)?\.?)\b/i.test(normalized)) {
    return {
      year: -150,
      anchor: `Second Temple corpus inferred from citation: ${normalized}`,
      confidence: 'medium',
    };
  }
  if (/\bSir(?:ach)?\.?/i.test(normalized)) {
    return {
      year: -180,
      anchor: `Sirach-era witness inferred from citation: ${normalized}`,
      confidence: 'medium',
    };
  }
  if (/\bWis(?:dom)?(?:\s+of\s+Solomon)?\.?/i.test(normalized)) {
    return {
      year: -30,
      anchor: `Wisdom of Solomon-era witness inferred from citation: ${normalized}`,
      confidence: 'medium',
    };
  }
  if (/\b(?:DSS|[1-9]\d?Q[A-Za-z0-9-]+)\b/i.test(normalized)) {
    return {
      year: -100,
      anchor: `DSS/Qumran witness inferred from citation: ${normalized}`,
      confidence: 'medium',
    };
  }
  if (
    /\b(?:Enuma Elish|Atrahasis|Gilgamesh|KTU|CAT\s+\d|Ugarit|Ugaritic|Pyramid Texts?|Coffin Texts?|Avesta|Yasna|Vendidad)\b/i.test(
      normalized,
    )
  ) {
    return {
      year: -1200,
      anchor: `ANE comparative corpus inferred from citation: ${normalized}`,
      confidence: 'low',
      warning:
        'ANE sources span wide periods; plotted as a coarse chronological anchor.',
    };
  }

  const stripped = normalized
    .replace(/\b(?:LXX|MT|HB|GNT|NA28|UBS5)\b/gi, '')
    .trim();
  const scriptureMatch = stripped.match(/^([1-3]?\s*[A-Za-z. ]+)\s+\d+(?::\d+(?:-\d+)?)?$/);
  if (!scriptureMatch) {
    return null;
  }

  const token = normalizeBookToken(scriptureMatch[1] ?? '');
  if (!token) {
    return null;
  }

  if (Number.isFinite(NT_BOOK_YEAR[token])) {
    return {
      year: NT_BOOK_YEAR[token],
      anchor: `NT composition horizon inferred from citation: ${normalized}`,
      confidence: 'medium',
    };
  }
  if (Number.isFinite(STP_BOOK_YEAR[token])) {
    return {
      year: STP_BOOK_YEAR[token],
      anchor: `Second Temple composition horizon inferred from citation: ${normalized}`,
      confidence: 'medium',
    };
  }
  if (Number.isFinite(OT_FINAL_FORM_YEAR[token])) {
    return {
      year: OT_FINAL_FORM_YEAR[token],
      anchor: `Hebrew Bible final-form horizon inferred from citation: ${normalized}`,
      confidence: 'low',
      warning:
        'OT dating is debated; plotted by approximate final-form horizon, not autographic composition.',
    };
  }

  return null;
}

export function inferChronologyFromNode(node: Pick<Node, 'source' | 'citations'>): ChronologyInference {
  for (const citation of node.citations ?? []) {
    const inferred = inferFromCitation(citation);
    if (inferred) {
      return inferred;
    }
  }

  return {
    year: SOURCE_FALLBACK_YEAR[node.source],
    anchor: `Fallback by source lane: ${node.source}`,
    confidence: 'low',
    warning:
      'No robust citation-date anchor detected; using source-era fallback.',
  };
}

export function chronologyConfidenceLabel(
  confidence: ChronologyConfidence,
  language: AppLanguage,
): string {
  if (language !== 'zh-Hant') {
    if (confidence === 'high') return 'High';
    if (confidence === 'medium') return 'Medium';
    return 'Low';
  }
  if (confidence === 'high') return '高';
  if (confidence === 'medium') return '中';
  return '低';
}

