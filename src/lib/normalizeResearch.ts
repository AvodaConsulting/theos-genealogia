import type {
  CounterfactualResult,
  CounterfactualScenarioId,
  Link,
  Node,
  NodeType,
  SourceType,
  TraditionTag,
  VerificationResult,
} from '../types';

const VALID_SOURCES: ReadonlySet<SourceType> = new Set([
  'OT',
  'STP',
  'NT',
  'Hellenistic',
  'Manuscript',
]);

const VALID_NODE_TYPES: ReadonlySet<NodeType> = new Set([
  'verse',
  'concept',
  'context',
  'rupture',
  'variant',
]);

const MAX_NODES = 80;
const MAX_LINKS = 220;
const MAX_SUMMARY_CHARS = 24000;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asStringArray(value: unknown, maxItems = 24): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = asString(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    out.push(normalized);
    if (out.length >= maxItems) {
      break;
    }
  }

  return out;
}

function normalizeSourceToken(value: unknown): SourceType | null {
  if (VALID_SOURCES.has(value as SourceType)) {
    return value as SourceType;
  }

  const normalized = asString(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized === 'ot' ||
    normalized === 'old testament' ||
    normalized === 'hebrew bible' ||
    normalized === 'hb' ||
    normalized.includes('old testament') ||
    normalized.includes('hebrew bible')
  ) {
    return 'OT';
  }

  if (normalized === 'nt' || normalized === 'new testament' || normalized.includes('new testament')) {
    return 'NT';
  }

  if (
    normalized === 'hellenistic' ||
    normalized === 'greco-roman' ||
    normalized === 'greek philosophical' ||
    normalized.includes('hellenistic') ||
    normalized.includes('greco') ||
    normalized.includes('classical')
  ) {
    return 'Hellenistic';
  }

  if (
    normalized === 'manuscript' ||
    normalized === 'manuscripts' ||
    normalized === 'mss' ||
    normalized === 'ms' ||
    normalized === 'text-critical' ||
    normalized === 'textual witness' ||
    normalized.includes('manuscript') ||
    normalized.includes('textual')
  ) {
    return 'Manuscript';
  }

  if (
    normalized === 'stp' ||
    normalized === 'second temple' ||
    normalized === 'second temple period' ||
    normalized.includes('second temple')
  ) {
    return 'STP';
  }

  return null;
}

function sourceSignalScores(text: string): Record<SourceType, number> {
  const scores: Record<SourceType, number> = {
    OT: 0,
    STP: 0,
    NT: 0,
    Hellenistic: 0,
    Manuscript: 0,
  };

  const ntPattern =
    /\b(matt?(?:hew)?|mt|mark|mk|luke|lk|john|jn|acts|rom(?:ans)?|1\s*cor(?:inthians)?|2\s*cor(?:inthians)?|gal(?:atians)?|eph(?:esians)?|phil(?:ippians)?|col(?:ossians)?|1\s*thess(?:alonians)?|2\s*thess(?:alonians)?|1\s*tim(?:othy)?|2\s*tim(?:othy)?|titus|philem(?:on)?|heb(?:rews)?|james|1\s*pet(?:er)?|2\s*pet(?:er)?|1\s*john|2\s*john|3\s*john|jude|rev(?:elation)?|apocalypse)\b/i;
  const otPattern =
    /\b(gen(?:esis)?|exod(?:us)?|lev(?:iticus)?|num(?:bers)?|deut(?:eronomy)?|josh(?:ua)?|judg(?:es)?|ruth|1\s*sam(?:uel)?|2\s*sam(?:uel)?|1\s*kings?|2\s*kings?|1\s*chr(?:onicles)?|2\s*chr(?:onicles)?|ezra|neh(?:emiah)?|esth(?:er)?|job|ps(?:alm|alms)?|prov(?:erbs)?|eccl(?:esiastes)?|song(?:\s+of\s+songs)?|song of songs|isa(?:iah)?|jer(?:emiah)?|lam(?:entations)?|ezek(?:iel)?|dan(?:iel)?|hos(?:ea)?|joel|amos|obad(?:iah)?|jonah|mic(?:ah)?|nah(?:um)?|hab(?:akkuk)?|zeph(?:aniah)?|hag(?:gai)?|zech(?:ariah)?|mal(?:achi)?)\b/i;

  if (ntPattern.test(text)) {
    scores.NT += 3;
  }
  if (otPattern.test(text)) {
    scores.OT += 3;
  }
  if (/\b(lxx|septuagint|masoretic|mt)\b/i.test(text)) {
    scores.OT += 2;
  }
  if (
    /\b(4q|1q|11q|dead sea scrolls?|dss|codex\s+(sinaiticus|vaticanus|alexandrinus)|papyrus\s*p?\d+|p\d{2,3}|na28|ubs5)\b/i.test(
      text,
    )
  ) {
    scores.Manuscript += 3;
  }
  if (
    /\b(josephus|antiquities|philo|stoic|platon|aristotle|greco-roman|hellenistic|homer|euripides|plutarch|epictetus|seneca)\b/i.test(
      text,
    )
  ) {
    scores.Hellenistic += 3;
  }
  if (
    /\b(pseudepigrapha|1\s*enoch|2\s*enoch|3\s*enoch|jubilees|sirach|wisdom of solomon|qumran|testament of|apocalypse of|4\s*ezra|2\s*baruch)\b/i.test(
      text,
    )
  ) {
    scores.STP += 3;
  }

  return scores;
}

function inferSourceFromContext(text: string): SourceType {
  const scores = sourceSignalScores(text);
  const ranked = (Object.entries(scores) as Array<[SourceType, number]>).sort((a, b) => b[1] - a[1]);
  const [bestSource, bestScore] = ranked[0];
  if (bestScore <= 0) {
    return 'STP';
  }
  return bestSource;
}

function normalizeSource(value: unknown, contextText: string): SourceType {
  const explicit = normalizeSourceToken(value);
  const inferred = inferSourceFromContext(contextText);
  const scores = sourceSignalScores(contextText);

  if (!explicit) {
    return inferred;
  }

  const inferredScore = scores[inferred];
  const explicitScore = scores[explicit];
  if (inferred !== explicit && inferredScore >= 2 && inferredScore > explicitScore) {
    return inferred;
  }

  return explicit;
}

function normalizeNodeType(value: unknown): NodeType {
  if (VALID_NODE_TYPES.has(value as NodeType)) {
    return value as NodeType;
  }

  const normalized = asString(value).toLowerCase();
  if (normalized === 'verse') {
    return 'verse';
  }
  if (normalized === 'concept') {
    return 'concept';
  }
  if (normalized === 'context') {
    return 'context';
  }
  if (normalized === 'rupture') {
    return 'rupture';
  }
  if (normalized === 'variant') {
    return 'variant';
  }

  return 'concept';
}

function normalizeGreekHebrewMappings(
  value: unknown,
): NonNullable<Node['linguisticAnalysis']>['greekToHebrewMappings'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const out: NonNullable<Node['linguisticAnalysis']>['greekToHebrewMappings'] = [];

  for (const item of value) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }

    const greekLemma = asString(entry.greekLemma);
    const hebrewLemmas = asStringArray(entry.hebrewLemmas, 12);
    if (!greekLemma || hebrewLemmas.length === 0) {
      continue;
    }

    const lxxExamples = asStringArray(entry.lxxExamples, 12);
    const mtExamples = asStringArray(entry.mtExamples, 12);
    const notes = asString(entry.notes);

    out.push({
      greekLemma,
      hebrewLemmas,
      lxxExamples: lxxExamples.length > 0 ? lxxExamples : undefined,
      mtExamples: mtExamples.length > 0 ? mtExamples : undefined,
      notes: notes || undefined,
    });
  }

  return out.length > 0 ? out : undefined;
}

function normalizeSecondTempleParallels(
  value: unknown,
): NonNullable<Node['linguisticAnalysis']>['secondTempleParallels'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const allowed = new Set(['DSS', 'Pseudepigrapha', 'Philo', 'Josephus', 'Other']);
  const out: NonNullable<Node['linguisticAnalysis']>['secondTempleParallels'] = [];

  for (const item of value) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }

    const corpusRaw = asString(entry.corpus, 'Other');
    const corpus = allowed.has(corpusRaw) ? corpusRaw : 'Other';
    const reference = asString(entry.reference);
    const concept = asString(entry.concept);
    const notes = asString(entry.notes);
    if (!reference || !concept) {
      continue;
    }

    out.push({
      corpus: corpus as 'DSS' | 'Pseudepigrapha' | 'Philo' | 'Josephus' | 'Other',
      reference,
      concept,
      notes: notes || undefined,
    });
  }

  return out.length > 0 ? out : undefined;
}

function normalizeHellenisticParallels(
  value: unknown,
): NonNullable<Node['linguisticAnalysis']>['hellenisticParallels'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const out: NonNullable<Node['linguisticAnalysis']>['hellenisticParallels'] = [];

  for (const item of value) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }

    const author = asString(entry.author);
    const notes = asString(entry.notes);
    if (!author || !notes) {
      continue;
    }

    const work = asString(entry.work);
    const greekTerm = asString(entry.greekTerm);
    out.push({
      author,
      work: work || undefined,
      greekTerm: greekTerm || undefined,
      notes,
    });
  }

  return out.length > 0 ? out : undefined;
}

function normalizeLinguisticAnalysis(value: unknown): Node['linguisticAnalysis'] | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const analysis: Node['linguisticAnalysis'] = {
    greekTerm: asString(record.greekTerm) || undefined,
    hebrewTerm: asString(record.hebrewTerm) || undefined,
    lxxEquivalent: asString(record.lxxEquivalent) || undefined,
    morphology: asString(record.morphology) || undefined,
    semanticShift: asString(record.semanticShift) || undefined,
    genderGrammar: asString(record.genderGrammar) || undefined,
    untranslatable: asString(record.untranslatable) || undefined,
    greekToHebrewMappings: normalizeGreekHebrewMappings(record.greekToHebrewMappings),
    secondTempleParallels: normalizeSecondTempleParallels(record.secondTempleParallels),
    hellenisticParallels: normalizeHellenisticParallels(record.hellenisticParallels),
  };

  if (Object.values(analysis).every((valueEntry) => valueEntry === undefined)) {
    return undefined;
  }

  return analysis;
}

function normalizeSymptomaticAnalysis(value: unknown): Node['symptomaticAnalysis'] | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const analysis: Node['symptomaticAnalysis'] = {
    surplus: asString(record.surplus) || undefined,
    silence: asString(record.silence) || undefined,
    repetition: asString(record.repetition) || undefined,
    fantasy: asString(record.fantasy) || undefined,
  };

  if (Object.values(analysis).every((valueEntry) => valueEntry === undefined)) {
    return undefined;
  }

  return analysis;
}

function normalizeManuscriptVariants(value: unknown): Node['manuscriptVariants'] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const out: NonNullable<Node['manuscriptVariants']> = [];
  for (const item of value) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }

    const manuscript = asString(entry.manuscript);
    const reading = asString(entry.reading);
    const significance = asString(entry.significance);
    if (!manuscript || !reading || !significance) {
      continue;
    }

    out.push({ manuscript, reading, significance });
  }

  return out.length > 0 ? out : undefined;
}

function normalizeScholarlyDebate(value: unknown): Link['scholarlyDebate'] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const out: NonNullable<Link['scholarlyDebate']> = [];
  for (const item of value) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }

    const scholar = asString(entry.scholar);
    const position = asString(entry.position);
    const framework = asString(entry.framework);
    const critique = asString(entry.critique);
    const yearRaw = entry.year;
    const year =
      typeof yearRaw === 'number' ? Math.trunc(yearRaw) : Number.parseInt(asString(yearRaw), 10);

    if (!scholar || !position || !framework || !critique || !Number.isFinite(year)) {
      continue;
    }

    out.push({ scholar, position, framework, critique, year });
  }

  return out.length > 0 ? out : undefined;
}

function normalizeMethodologyTagging(value: unknown): Link['methodologyTagging'] | undefined {
  const entry = asRecord(value);
  if (!entry) {
    return undefined;
  }

  const allowedFrameworks = new Set([
    'Historical-Critical',
    'Literary',
    'Reader-Response',
  ]);
  const hermeneuticFrameworksRaw = asStringArray(entry.hermeneuticFrameworks, 8);
  const hermeneuticFrameworks = hermeneuticFrameworksRaw.filter((item) =>
    allowedFrameworks.has(item),
  );

  const canonicalAssumptionRaw = asString(entry.canonicalAssumption);
  const canonicalOptions = new Set(['Traditional', 'Expanded Canon', 'Plural Canons', 'Non-Canonical']);
  const canonicalAssumption = canonicalOptions.has(canonicalAssumptionRaw)
    ? (canonicalAssumptionRaw as NonNullable<Link['methodologyTagging']>['canonicalAssumption'])
    : undefined;

  const languagePhilosophyRaw = asString(entry.languagePhilosophy);
  const languageOptions = new Set(['Reference', 'Use', 'Differance', 'Event']);
  const languagePhilosophy = languageOptions.has(languagePhilosophyRaw)
    ? (languagePhilosophyRaw as NonNullable<Link['methodologyTagging']>['languagePhilosophy'])
    : undefined;

  const readingsRaw = Array.isArray(entry.readings) ? entry.readings : [];
  const readings: NonNullable<Link['methodologyTagging']>['readings'] = [];
  for (const readingItem of readingsRaw) {
    const readingEntry = asRecord(readingItem);
    if (!readingEntry) {
      continue;
    }
    const stance = asString(readingEntry.stance);
    const reading = asString(readingEntry.reading);
    const keyQuestion = asString(readingEntry.keyQuestion);
    if (!stance || !reading || !keyQuestion) {
      continue;
    }
    readings.push({ stance, reading, keyQuestion });
  }

  const parallaxRaw = asRecord(entry.parallax);
  let parallax: NonNullable<Link['methodologyTagging']>['parallax'] | undefined;
  if (parallaxRaw) {
    const leftStance = asString(parallaxRaw.leftStance);
    const rightStance = asString(parallaxRaw.rightStance);
    const leftReading = asString(parallaxRaw.leftReading);
    const rightReading = asString(parallaxRaw.rightReading);
    const sliderNote = asString(parallaxRaw.sliderNote) || undefined;

    const rupturePointsRaw = Array.isArray(parallaxRaw.rupturePoints) ? parallaxRaw.rupturePoints : [];
    const rupturePoints: NonNullable<NonNullable<Link['methodologyTagging']>['parallax']>['rupturePoints'] = [];
    for (const pointItem of rupturePointsRaw) {
      const point = asRecord(pointItem);
      if (!point) {
        continue;
      }
      const theme = asString(point.theme);
      const leftClaim = asString(point.leftClaim);
      const rightClaim = asString(point.rightClaim);
      const whyIrreconcilable = asString(point.whyIrreconcilable);
      if (!theme || !leftClaim || !rightClaim || !whyIrreconcilable) {
        continue;
      }
      rupturePoints.push({ theme, leftClaim, rightClaim, whyIrreconcilable });
    }

    if (leftStance && rightStance && leftReading && rightReading && rupturePoints.length > 0) {
      parallax = {
        leftStance,
        rightStance,
        leftReading,
        rightReading,
        rupturePoints,
        sliderNote,
      };
    }
  }

  if (
    (!hermeneuticFrameworks || hermeneuticFrameworks.length === 0) &&
    !canonicalAssumption &&
    !languagePhilosophy &&
    readings.length === 0 &&
    !parallax
  ) {
    return undefined;
  }

  return {
    hermeneuticFrameworks:
      hermeneuticFrameworks.length > 0
        ? (hermeneuticFrameworks as NonNullable<Link['methodologyTagging']>['hermeneuticFrameworks'])
        : undefined,
    canonicalAssumption,
    languagePhilosophy,
    readings: readings.length > 0 ? readings : undefined,
    parallax,
  };
}

function normalizeIntertextualityMetrics(value: unknown): Link['intertextualityMetrics'] | undefined {
  const entry = asRecord(value);
  if (!entry) {
    return undefined;
  }

  const allowedScale = new Set(['low', 'medium', 'high']);
  const lexicalOverlapRaw = asString(entry.lexicalOverlap).toLowerCase();
  const syntacticSimilarityRaw = asString(entry.syntacticSimilarity).toLowerCase();
  const conceptualDistanceRaw = asString(entry.conceptualDistance).toLowerCase();
  const contextualRarityRaw = asString(entry.contextualRarity).toLowerCase();

  const metrics: Link['intertextualityMetrics'] = {
    lexicalOverlap: allowedScale.has(lexicalOverlapRaw)
      ? (lexicalOverlapRaw as NonNullable<Link['intertextualityMetrics']>['lexicalOverlap'])
      : undefined,
    syntacticSimilarity: allowedScale.has(syntacticSimilarityRaw)
      ? (syntacticSimilarityRaw as NonNullable<Link['intertextualityMetrics']>['syntacticSimilarity'])
      : undefined,
    conceptualDistance: allowedScale.has(conceptualDistanceRaw)
      ? (conceptualDistanceRaw as NonNullable<Link['intertextualityMetrics']>['conceptualDistance'])
      : undefined,
    contextualRarity: allowedScale.has(contextualRarityRaw)
      ? (contextualRarityRaw as NonNullable<Link['intertextualityMetrics']>['contextualRarity'])
      : undefined,
    pValue: asString(entry.pValue) || undefined,
    conclusion: asString(entry.conclusion) || undefined,
  };

  if (Object.values(metrics).every((metric) => metric === undefined)) {
    return undefined;
  }

  return metrics;
}

function normalizeRuptureAnalysis(value: unknown): Node['ruptureAnalysis'] | undefined {
  const entry = asRecord(value);
  if (!entry) {
    return undefined;
  }

  const semanticRuptures: NonNullable<Node['ruptureAnalysis']>['semanticRuptures'] = [];
  if (Array.isArray(entry.semanticRuptures)) {
    for (const item of entry.semanticRuptures) {
      const rupture = asRecord(item);
      if (!rupture) {
        continue;
      }
      const from = asString(rupture.from);
      const to = asString(rupture.to);
      const significance = asString(rupture.significance);
      if (!from || !to || !significance) {
        continue;
      }
      semanticRuptures.push({ from, to, significance });
    }
  }

  const syntacticRuptures: NonNullable<Node['ruptureAnalysis']>['syntacticRuptures'] = [];
  if (Array.isArray(entry.syntacticRuptures)) {
    for (const item of entry.syntacticRuptures) {
      const rupture = asRecord(item);
      if (!rupture) {
        continue;
      }
      const from = asString(rupture.from);
      const to = asString(rupture.to);
      const significance = asString(rupture.significance);
      if (!from || !to || !significance) {
        continue;
      }
      syntacticRuptures.push({ from, to, significance });
    }
  }

  const untranslatables: NonNullable<Node['ruptureAnalysis']>['untranslatables'] = [];
  if (Array.isArray(entry.untranslatables)) {
    for (const item of entry.untranslatables) {
      const untranslatable = asRecord(item);
      if (!untranslatable) {
        continue;
      }
      const term = asString(untranslatable.term);
      const lossProfile = asString(untranslatable.lossProfile);
      const implications = asString(untranslatable.implications);
      if (!term || !lossProfile) {
        continue;
      }
      untranslatables.push({ term, lossProfile, implications: implications || undefined });
    }
  }

  const historicalSilences: NonNullable<Node['ruptureAnalysis']>['historicalSilences'] = [];
  if (Array.isArray(entry.historicalSilences)) {
    for (const item of entry.historicalSilences) {
      const silence = asRecord(item);
      if (!silence) {
        continue;
      }
      const missingReference = asString(silence.missingReference);
      const hypothesis = asString(silence.hypothesis);
      const ideologicalFunction = asString(silence.ideologicalFunction);
      if (!missingReference || !hypothesis) {
        continue;
      }
      historicalSilences.push({
        missingReference,
        hypothesis,
        ideologicalFunction: ideologicalFunction || undefined,
      });
    }
  }

  if (
    semanticRuptures.length === 0 &&
    syntacticRuptures.length === 0 &&
    untranslatables.length === 0 &&
    historicalSilences.length === 0
  ) {
    return undefined;
  }

  return {
    semanticRuptures: semanticRuptures.length > 0 ? semanticRuptures : undefined,
    syntacticRuptures: syntacticRuptures.length > 0 ? syntacticRuptures : undefined,
    untranslatables: untranslatables.length > 0 ? untranslatables : undefined,
    historicalSilences: historicalSilences.length > 0 ? historicalSilences : undefined,
  };
}

function normalizeConceptualTopography(value: unknown): Node['conceptualTopography'] | undefined {
  const entry = asRecord(value);
  if (!entry) {
    return undefined;
  }

  const topography: Node['conceptualTopography'] = {
    temporalAxis: asString(entry.temporalAxis) || undefined,
    semanticAxis: asString(entry.semanticAxis) || undefined,
    powerAxis: asString(entry.powerAxis) || undefined,
    cloudMovement: asString(entry.cloudMovement) || undefined,
  };

  if (Object.values(topography).every((axis) => axis === undefined)) {
    return undefined;
  }

  return topography;
}

function createUniqueId(rawId: string, used: Set<string>, index: number): string {
  const base =
    rawId
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `node-${index + 1}`;

  let candidate = base;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  used.add(candidate);
  return candidate;
}

function aliasKey(value: string): string {
  return value.trim().toLowerCase();
}

function slugAlias(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeLinkType(rawType: unknown, label?: string, description?: string): string {
  const raw = asString(rawType).toLowerCase();
  const text = `${raw} ${asString(label).toLowerCase()} ${asString(description).toLowerCase()}`;

  if (/\b(direct[-\s]?citation|explicit[-\s]?citation|quotation|quoted|proof[-\s]?text|fulfillment)\b/.test(text)) {
    return 'direct-citation';
  }
  if (/\b(allusion|echo|intertext|typolog|暗引|典故|意象)\b/.test(text)) {
    return 'allusion';
  }
  if (/\b(translation|interpretation|lxx|septuagint|targum|rendering|詮釋|翻譯)\b/.test(text)) {
    return 'translation-interpretation';
  }
  if (/\b(inversion|reversal|subversion|反轉|顛覆)\b/.test(text)) {
    return 'inversion';
  }
  if (/\b(parallel|resonance|convergence|co-?tradition|共鳴|平行)\b/.test(text)) {
    return 'parallel';
  }
  if (/\b(conceptual|semantic|development|trajectory|reframing|evolution|系譜|演變)\b/.test(text)) {
    return 'conceptual-development';
  }
  if (/\b(inferred[-\s]?sequence)\b/.test(text)) {
    return 'inferred-sequence';
  }

  return 'conceptual-development';
}

const DESCRIPTION_PLACEHOLDER_PATTERNS: RegExp[] = [
  /^no description provided\.?$/i,
  /^no description\.?$/i,
  /^none\.?$/i,
  /^n\/a\.?$/i,
  /^not provided\.?$/i,
  /^unknown\.?$/i,
  /^tbd\.?$/i,
];

function isPlaceholderDescription(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }
  return DESCRIPTION_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function relationPhraseForType(type: string): string {
  switch (type) {
    case 'direct-citation':
      return 'directly cites';
    case 'allusion':
      return 'alludes to';
    case 'translation-interpretation':
      return 'translates or interprets';
    case 'inversion':
      return 'inverts or subverts';
    case 'parallel':
      return 'runs in parallel resonance with';
    case 'inferred-sequence':
      return 'is sequenced before';
    case 'conceptual-development':
    default:
      return 'develops conceptually toward';
  }
}

function createFallbackLinkDescription(
  type: string,
  sourceLabel: string,
  targetLabel: string,
  rawLabel: string,
): string {
  if (sourceLabel && targetLabel) {
    return `${sourceLabel} ${relationPhraseForType(type)} ${targetLabel}.`;
  }
  if (rawLabel) {
    return `${rawLabel} (${type.replace(/[_-]+/g, ' ')}).`;
  }
  return `Connection classified as ${type.replace(/[_-]+/g, ' ')}.`;
}

function normalizeTraditionTag(value: unknown): TraditionTag | undefined {
  if (typeof value === 'string') {
    const label = asString(value);
    if (!label) {
      return undefined;
    }
    return {
      id: slugAlias(label) || 'tradition',
      label,
      independence: 'uncertain',
    };
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const label = asString(record.label);
  const idRaw = asString(record.id);
  const id = slugAlias(idRaw || label);
  if (!id || !label) {
    return undefined;
  }

  const independenceRaw = asString(record.independence).toLowerCase();
  const independenceMap: Record<string, TraditionTag['independence']> = {
    independent: 'independent',
    convergent: 'convergent',
    contested: 'contested',
    uncertain: 'uncertain',
  };
  const independence = independenceMap[independenceRaw];
  const notes = asString(record.notes) || undefined;

  return {
    id,
    label,
    independence,
    notes,
  };
}

function inferTraditionFallback(
  node: Record<string, unknown>,
  label: string,
  content: string,
  citations: string[],
): TraditionTag | undefined {
  const explicit =
    normalizeTraditionTag(node.tradition) ??
    normalizeTraditionTag({
      id: node.traditionId,
      label: node.traditionLabel,
      independence: node.traditionIndependence,
      notes: node.traditionNotes,
    });
  if (explicit) {
    return explicit;
  }

  const text = `${label} ${content} ${citations.join(' ')}`.toLowerCase();
  if (/\b(?:aaron|aaronic|priestly)\b/.test(text)) {
    return {
      id: 'priestly-aaronic',
      label: 'Priestly / Aaronic Stream',
      independence: 'independent',
    };
  }
  if (/\b(?:david|davidic|royal|son of david)\b/.test(text)) {
    return {
      id: 'royal-davidic',
      label: 'Royal / Davidic Stream',
      independence: 'independent',
    };
  }
  if (/\b(?:apocalyptic|enoch|watchers|beast|dragon)\b/.test(text)) {
    return {
      id: 'apocalyptic-stream',
      label: 'Apocalyptic Stream',
      independence: 'independent',
    };
  }

  return undefined;
}

function inferTraditionsFromGraph(nodes: Node[], links: Link[]): Map<string, TraditionTag> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }

  const bridgeLikePattern =
    /\b(converg|bridge|appropriat|reception|influenc|association|echo|reuse|intertext|application|fulfill)\b/i;

  for (const link of links) {
    if (!nodeIds.has(link.source) || !nodeIds.has(link.target)) {
      continue;
    }
    const text = `${link.type} ${link.label} ${link.description}`;
    if (bridgeLikePattern.test(text)) {
      continue;
    }
    adjacency.get(link.source)?.add(link.target);
    adjacency.get(link.target)?.add(link.source);
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }
    const queue = [node.id];
    const component: string[] = [];
    visited.add(node.id);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  if (components.length < 2) {
    return new Map();
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const out = new Map<string, TraditionTag>();

  components
    .sort((a, b) => b.length - a.length)
    .forEach((component, index) => {
      const componentNodes = component.map((id) => nodeById.get(id)).filter(Boolean) as Node[];
      const sourceCounts = componentNodes.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.source] = (acc[entry.source] ?? 0) + 1;
        return acc;
      }, {});
      const dominantSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Mixed';
      const leadLabel = componentNodes[0]?.label ?? `Stream ${index + 1}`;
      const tag: TraditionTag = {
        id: `inferred-stream-${index + 1}`,
        label: `Inferred ${dominantSource} Stream ${index + 1}: ${leadLabel.slice(0, 32)}`,
        independence: 'independent',
        notes:
          'Inferred automatically from graph topology because explicit tradition metadata was absent.',
      };
      for (const nodeId of component) {
        out.set(nodeId, tag);
      }
    });

  return out;
}

export function normalizeStructuralPayload(raw: unknown): {
  nodes: Node[];
  links: Link[];
  notes: string[];
} {
  const record = asRecord(raw);
  const rawNodes = Array.isArray(record?.nodes) ? record.nodes : [];
  const rawLinks = Array.isArray(record?.links) ? record.links : [];
  const notes: string[] = [];

  const usedNodeIds = new Set<string>();
  const aliasToNodeId = new Map<string, string>();
  const nodes: Node[] = [];

  rawNodes.forEach((item, index) => {
    const node = asRecord(item);
    if (!node) {
      return;
    }

    const rawId = asString(node.id);
    const id = createUniqueId(rawId, usedNodeIds, index);
    const label = asString(node.label, id);
    const content = asString(node.content, 'No content provided.');
    const citations = asStringArray(node.citations, 32);
    const tradition = inferTraditionFallback(node, label, content, citations);
    const sourceContext = `${asString(node.source)} ${label} ${content} ${citations.join(' ')}`;

    if (rawId) {
      aliasToNodeId.set(aliasKey(rawId), id);
      aliasToNodeId.set(slugAlias(rawId), id);
    }
    aliasToNodeId.set(aliasKey(id), id);
    aliasToNodeId.set(slugAlias(id), id);
    aliasToNodeId.set(aliasKey(label), id);
    aliasToNodeId.set(slugAlias(label), id);

    const normalized: Node = {
      id,
      type: normalizeNodeType(node.type),
      source: normalizeSource(node.source, sourceContext),
      label,
      content,
      citations,
      tradition,
      linguisticAnalysis: normalizeLinguisticAnalysis(node.linguisticAnalysis),
      symptomaticAnalysis: normalizeSymptomaticAnalysis(node.symptomaticAnalysis),
      manuscriptVariants: normalizeManuscriptVariants(node.manuscriptVariants),
      ruptureAnalysis: normalizeRuptureAnalysis(node.ruptureAnalysis),
      conceptualTopography: normalizeConceptualTopography(node.conceptualTopography),
    };

    nodes.push(normalized);
  });

  if (nodes.length === 0) {
    nodes.push({
      id: 'fallback-node',
      type: 'concept',
      source: 'STP',
      label: 'No Parsable Nodes',
      content: 'The model returned an unparseable node payload. Please retry with a narrower query.',
      citations: [],
    });
    notes.push('Node payload was malformed. Inserted fallback node.');
  }

  if (nodes.length > MAX_NODES) {
    notes.push(`Trimmed node count from ${nodes.length} to ${MAX_NODES} for UI stability.`);
    nodes.splice(MAX_NODES);
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const seenLinks = new Set<string>();
  const links: Link[] = [];

  for (const item of rawLinks) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }

    const sourceRaw = asString(entry.source);
    const targetRaw = asString(entry.target);
    const source =
      aliasToNodeId.get(aliasKey(sourceRaw)) ??
      aliasToNodeId.get(slugAlias(sourceRaw)) ??
      sourceRaw;
    const target =
      aliasToNodeId.get(aliasKey(targetRaw)) ??
      aliasToNodeId.get(slugAlias(targetRaw)) ??
      targetRaw;
    if (!nodeIds.has(source) || !nodeIds.has(target) || source === target) {
      continue;
    }

    const type = normalizeLinkType(entry.type, asString(entry.label), asString(entry.description));
    const signature = `${source}::${target}::${type}`;
    if (seenLinks.has(signature)) {
      continue;
    }

    seenLinks.add(signature);
    const label = asString(entry.label, type);
    const descriptionRaw = asString(entry.description);
    const sourceLabel = nodeById.get(source)?.label ?? source;
    const targetLabel = nodeById.get(target)?.label ?? target;
    const description = isPlaceholderDescription(descriptionRaw)
      ? createFallbackLinkDescription(type, sourceLabel, targetLabel, label)
      : descriptionRaw;

    links.push({
      source,
      target,
      type,
      label,
      description,
      scholarlyDebate: normalizeScholarlyDebate(entry.scholarlyDebate),
      methodologyTagging: normalizeMethodologyTagging(entry.methodologyTagging),
      intertextualityMetrics: normalizeIntertextualityMetrics(entry.intertextualityMetrics),
    });

    if (links.length >= MAX_LINKS) {
      notes.push(`Trimmed link count to ${MAX_LINKS} for UI stability.`);
      break;
    }
  }

  if (links.length === 0 && nodes.length > 1) {
    const sourceRank: Record<SourceType, number> = {
      OT: 1,
      STP: 2,
      Hellenistic: 3,
      NT: 4,
      Manuscript: 5,
    };
    const sorted = [...nodes].sort((a, b) => sourceRank[a.source] - sourceRank[b.source]);
    for (let index = 1; index < sorted.length; index += 1) {
      const source = sorted[index - 1].id;
      const target = sorted[index].id;
      const signature = `${source}::${target}::inferred-sequence`;
      if (seenLinks.has(signature)) {
        continue;
      }
      links.push({
        source,
        target,
        type: 'inferred-sequence',
        label: 'Inferred Sequence',
        description:
          'Connectivity inferred by the client because no valid edges were parsed from the model output.',
      });
      seenLinks.add(signature);
      if (links.length >= MAX_LINKS) {
        break;
      }
    }
    notes.push('No parsable links returned. Added inferred sequence links for graph continuity.');
  }

  const explicitTraditionCount = nodes.filter((node) => node.tradition).length;
  if (explicitTraditionCount === 0) {
    const inferredTraditions = inferTraditionsFromGraph(nodes, links);
    if (inferredTraditions.size > 0) {
      for (const node of nodes) {
        const inferred = inferredTraditions.get(node.id);
        if (inferred) {
          node.tradition = inferred;
        }
      }
      notes.push(
        `No explicit tradition metadata returned. Inferred ${new Set(Array.from(inferredTraditions.values()).map((entry) => entry.id)).size} parallel tradition streams from graph topology.`,
      );
    }
  }

  return { nodes, links, notes };
}

export function normalizePhase2Nodes(
  raw: unknown,
  validNodeIds: ReadonlySet<string>,
): Array<{
  id: string;
  citations?: string[];
  linguisticAnalysis?: Node['linguisticAnalysis'];
  symptomaticAnalysis?: Node['symptomaticAnalysis'];
}> {
  const record = asRecord(raw);
  const rawNodes = Array.isArray(record?.nodes) ? record.nodes : [];
  const updates: Array<{
    id: string;
    citations?: string[];
    linguisticAnalysis?: Node['linguisticAnalysis'];
    symptomaticAnalysis?: Node['symptomaticAnalysis'];
  }> = [];

  for (const item of rawNodes) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }

    const id = asString(entry.id);
    if (!id || !validNodeIds.has(id)) {
      continue;
    }

    const citations = asStringArray(entry.citations, 32);
    const linguisticAnalysis = normalizeLinguisticAnalysis(entry.linguisticAnalysis);
    const symptomaticAnalysis = normalizeSymptomaticAnalysis(entry.symptomaticAnalysis);

    if (!linguisticAnalysis && !symptomaticAnalysis && citations.length === 0) {
      continue;
    }

    updates.push({
      id,
      citations: citations.length > 0 ? citations : undefined,
      linguisticAnalysis,
      symptomaticAnalysis,
    });
  }

  return updates;
}

export function normalizePhase3Payload(
  raw: unknown,
  validNodeIds: ReadonlySet<string>,
): {
  nodes: Array<{
    id: string;
    manuscriptVariants?: Node['manuscriptVariants'];
    citations?: string[];
  }>;
  links: Array<{
    source: string;
    target: string;
    type: string;
    scholarlyDebate?: Link['scholarlyDebate'];
  }>;
} {
  const record = asRecord(raw);
  const rawNodes = Array.isArray(record?.nodes) ? record.nodes : [];
  const rawLinks = Array.isArray(record?.links) ? record.links : [];

  const nodes: Array<{
    id: string;
    manuscriptVariants?: Node['manuscriptVariants'];
    citations?: string[];
  }> = [];

  for (const item of rawNodes) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }

    const id = asString(entry.id);
    if (!id || !validNodeIds.has(id)) {
      continue;
    }

    const citations = asStringArray(entry.citations, 32);
    const manuscriptVariants = normalizeManuscriptVariants(entry.manuscriptVariants);
    if (!manuscriptVariants && citations.length === 0) {
      continue;
    }

    nodes.push({
      id,
      manuscriptVariants,
      citations: citations.length > 0 ? citations : undefined,
    });
  }

  const links: Array<{
    source: string;
    target: string;
    type: string;
    scholarlyDebate?: Link['scholarlyDebate'];
  }> = [];

  for (const item of rawLinks) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }

    const source = asString(entry.source);
    const target = asString(entry.target);
    if (!source || !target || !validNodeIds.has(source) || !validNodeIds.has(target)) {
      continue;
    }

    links.push({
      source,
      target,
      type: normalizeLinkType(entry.type, asString(entry.label), asString(entry.description)),
      scholarlyDebate: normalizeScholarlyDebate(entry.scholarlyDebate),
    });
  }

  return { nodes, links };
}

export function normalizeSummaryPayload(raw: unknown): string {
  const record = asRecord(raw);
  const summary = asString(record?.summary, 'No summary generated.');
  if (summary.length <= MAX_SUMMARY_CHARS) {
    return summary;
  }

  return `${summary.slice(0, MAX_SUMMARY_CHARS)}\n\n[Summary truncated for UI stability.]`;
}

export function normalizeCounterfactualPayload(
  raw: unknown,
  scenario: CounterfactualScenarioId,
): CounterfactualResult {
  const record = asRecord(raw);
  const hypothesis = asString(record?.hypothesis, 'No hypothesis generated.');
  const projectedShifts = asStringArray(record?.projectedShifts, 12);
  const theologicalConsequences = asStringArray(record?.theologicalConsequences, 12);
  const methodologicalReflection = asString(
    record?.methodologicalReflection,
    'No methodological reflection generated.',
  );
  const citations = asStringArray(record?.citations, 20);

  const scenarioRaw = asString(record?.scenario);
  const normalizedScenario: CounterfactualScenarioId =
    scenarioRaw === 'matthew-hebrew-not-lxx' ||
    scenarioRaw === 'second-temple-not-destroyed' ||
    scenarioRaw === 'philo-broad-circulation'
      ? scenarioRaw
      : scenario;

  return {
    scenario: normalizedScenario,
    hypothesis,
    projectedShifts,
    theologicalConsequences,
    methodologicalReflection,
    citations,
  };
}

export function normalizePublicationPayload(raw: unknown): string {
  const record = asRecord(raw);
  const publicationMarkdown = asString(record?.publicationMarkdown, 'No publication draft generated.');
  if (publicationMarkdown.length <= MAX_SUMMARY_CHARS * 2) {
    return publicationMarkdown;
  }

  return `${publicationMarkdown.slice(0, MAX_SUMMARY_CHARS * 2)}\n\n[Publication draft truncated for UI stability.]`;
}

export function normalizeVerificationPayload(raw: unknown): VerificationResult {
  const record = asRecord(raw);
  const statusRaw = asString(record?.status, 'verified');
  const status: VerificationResult['status'] = statusRaw === 'corrected' ? 'corrected' : 'verified';

  const notes = asStringArray(record?.notes, 40);

  const citationFixes: NonNullable<VerificationResult['citationFixes']> = [];
  const rawFixes = Array.isArray(record?.citationFixes) ? record.citationFixes : [];

  for (const item of rawFixes) {
    const entry = asRecord(item);
    if (!entry) {
      continue;
    }

    const citations = asStringArray(entry.citations, 24);
    if (citations.length === 0) {
      continue;
    }

    citationFixes.push({
      nodeId: asString(entry.nodeId) || undefined,
      linkId: asString(entry.linkId) || undefined,
      citations,
      rationale: asString(entry.rationale) || undefined,
    });
  }

  return {
    status,
    notes: notes.length > 0 ? notes : undefined,
    citationFixes: citationFixes.length > 0 ? citationFixes : undefined,
  };
}

export function normalizeSingleNodePayload(
  raw: unknown,
  nodeId: string,
): {
  id: string;
  citations?: string[];
  linguisticAnalysis?: Node['linguisticAnalysis'];
  symptomaticAnalysis?: Node['symptomaticAnalysis'];
  manuscriptVariants?: Node['manuscriptVariants'];
  ruptureAnalysis?: Node['ruptureAnalysis'];
  conceptualTopography?: Node['conceptualTopography'];
} | null {
  const root = asRecord(raw);
  const entry = asRecord(root?.node) ?? root;
  if (!entry) {
    return null;
  }

  const id = nodeId;

  const citations = asStringArray(entry.citations, 32);
  const linguisticAnalysis = normalizeLinguisticAnalysis(entry.linguisticAnalysis);
  const symptomaticAnalysis = normalizeSymptomaticAnalysis(entry.symptomaticAnalysis);
  const manuscriptVariants = normalizeManuscriptVariants(entry.manuscriptVariants);
  const ruptureAnalysis = normalizeRuptureAnalysis(entry.ruptureAnalysis);
  const conceptualTopography = normalizeConceptualTopography(entry.conceptualTopography);

  if (
    !linguisticAnalysis &&
    !symptomaticAnalysis &&
    !manuscriptVariants &&
    !ruptureAnalysis &&
    !conceptualTopography &&
    citations.length === 0
  ) {
    return null;
  }

  return {
    id,
    citations: citations.length > 0 ? citations : undefined,
    linguisticAnalysis,
    symptomaticAnalysis,
    manuscriptVariants,
    ruptureAnalysis,
    conceptualTopography,
  };
}

export function normalizeSingleLinkPayload(
  raw: unknown,
  link: Pick<Link, 'source' | 'target' | 'type'>,
): {
  source: string;
  target: string;
  type: string;
  scholarlyDebate?: Link['scholarlyDebate'];
  methodologyTagging?: Link['methodologyTagging'];
  intertextualityMetrics?: Link['intertextualityMetrics'];
} | null {
  const entry = asRecord(raw);
  if (!entry) {
    return null;
  }

  const source = asString(entry.source, link.source);
  const target = asString(entry.target, link.target);
  const typeInput = asString(entry.type, link.type);
  const type = normalizeLinkType(typeInput, asString(entry.label), asString(entry.description));
  const expectedType = normalizeLinkType(link.type, asString(entry.label), asString(entry.description));

  if (source !== link.source || target !== link.target || type !== expectedType) {
    return null;
  }

  const scholarlyDebate = normalizeScholarlyDebate(entry.scholarlyDebate);
  const methodologyTagging = normalizeMethodologyTagging(entry.methodologyTagging);
  const intertextualityMetrics = normalizeIntertextualityMetrics(entry.intertextualityMetrics);
  if (!scholarlyDebate && !methodologyTagging && !intertextualityMetrics) {
    return null;
  }

  return {
    source,
    target,
    type,
    scholarlyDebate,
    methodologyTagging,
    intertextualityMetrics,
  };
}
