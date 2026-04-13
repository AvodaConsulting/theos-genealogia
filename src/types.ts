export type SourceType = 'ANE' | 'OT' | 'STP' | 'NT' | 'Hellenistic' | 'Manuscript';
export type NodeType = 'verse' | 'concept' | 'context' | 'rupture' | 'variant';
export type AppLanguage = 'en' | 'zh-Hant';
export type LinkConfidence = 'high' | 'medium' | 'low';
export type HermeneuticFramework =
  | 'Historical-Critical'
  | 'Literary'
  | 'Reader-Response';
export type TraceHorizon = 'Core-70CE' | 'Extended-ANE';
export type AnalysisDepth = 'Standard' | 'Comprehensive';
export type CanonicalAssumption =
  | 'Traditional'
  | 'Expanded Canon'
  | 'Plural Canons'
  | 'Non-Canonical';
export type LanguagePhilosophy = 'Reference' | 'Use' | 'Differance' | 'Event';
export type CounterfactualScenarioId =
  | 'matthew-hebrew-not-lxx'
  | 'second-temple-not-destroyed'
  | 'philo-broad-circulation';

export interface ResearchMethodologyProfile {
  hermeneuticFrameworks: HermeneuticFramework[];
  traceHorizon: TraceHorizon;
  analysisDepth: AnalysisDepth;
  canonicalAssumption: CanonicalAssumption;
  languagePhilosophy: LanguagePhilosophy;
}

export interface CounterfactualResult {
  scenario: CounterfactualScenarioId;
  hypothesis: string;
  projectedShifts: string[];
  theologicalConsequences: string[];
  methodologicalReflection: string;
  citations: string[];
}

export interface IntertextualityStatsReport {
  linkId: string;
  sourceNodeId: string;
  targetNodeId: string;
  lexicalJaccard: number;
  ngramJaccard: number;
  syntacticSimilarity: number;
  conceptualCosine: number;
  conceptualDistance: number;
  contextualRarity: number;
  compositeScore: number;
  pValue: number;
  permutationIterations: number;
  overlapTokens: string[];
  interpretation: string;
}

export interface LivingPublication {
  id: string;
  title: string;
  generatedAt: string;
  versionLabel: string;
  markdown: string;
  citationIndex: Array<{
    citation: string;
    nodeIds: string[];
  }>;
  impactNotes: string[];
}

export type PeerReviewTargetType = 'publication' | 'node' | 'link';
export type PeerReviewSeverity = 'major' | 'moderate' | 'minor' | 'query';
export type PeerReviewStatus = 'open' | 'addressed';

export interface PeerReviewComment {
  id: string;
  reviewerAlias: string;
  targetType: PeerReviewTargetType;
  targetId: string;
  severity: PeerReviewSeverity;
  comment: string;
  createdAt: string;
  status: PeerReviewStatus;
}

export interface PeerReviewCommentInput {
  reviewerAlias: string;
  targetType: PeerReviewTargetType;
  targetId: string;
  severity: PeerReviewSeverity;
  comment: string;
}

export interface RevisionDiffReport {
  baselineCapturedAt: string;
  currentComparedAt: string;
  nodesAdded: string[];
  nodesRemoved: string[];
  linksAdded: string[];
  linksRemoved: string[];
  citationsAdded: string[];
  citationsRemoved: string[];
  rejectedCitationCountDelta: number;
}

export interface PeerReviewPacket {
  id: string;
  versionLabel: string;
  createdAt: string;
  title: string;
  anonymizedMarkdown: string;
}

export interface TraditionTag {
  id: string;
  label: string;
  independence?: 'independent' | 'convergent' | 'contested' | 'uncertain';
  notes?: string;
}

export interface NegativeScriptureEntry {
  book: string;
  mentionCountOutsideNT: number;
  ideologicalFunction?: string;
}

export interface NegativeScriptureIndex {
  generatedAt: string;
  absentInNT: NegativeScriptureEntry[];
  notes: string[];
}

export interface ConceptTopographyEntry {
  nodeId: string;
  label: string;
  source: SourceType;
  tradition?: string;
  estimatedYear: number;
  datingAnchor?: string;
  datingConfidence?: 'high' | 'medium' | 'low';
  datingWarning?: string;
  semanticDensity: number;
  institutionalPower: number;
  driftScore: number;
  movementNote: string;
}

export interface ConceptTopographyReport {
  generatedAt: string;
  summary: string;
  entries: ConceptTopographyEntry[];
}

export interface TextualFluidityReadingCandidate {
  reading: string;
  probability: number;
  witnesses: string[];
}

export interface TextualFluidityReport {
  nodeId: string;
  witnessCount: number;
  variantCount: number;
  urtextCloud: TextualFluidityReadingCandidate[];
  driftIndex: number;
  assessment: string;
}

export interface ScholarlyEcosystemReport {
  generatedAt: string;
  timeline: Array<{
    year: number;
    scholar: string;
    framework: string;
    linkLabel: string;
    position: string;
  }>;
  frameworkClusters: Array<{
    framework: string;
    count: number;
  }>;
  contestedLinks: Array<{
    linkKey: string;
    linkLabel: string;
    scholarCount: number;
  }>;
}

export type UserStanceValue = 'support' | 'oppose' | 'qualified' | 'undecided';

export interface UserStanceInput {
  targetLinkKey: string;
  linkLabel: string;
  scholar: string;
  framework: string;
  positionSummary: string;
  stance: UserStanceValue;
  rationale?: string;
}

export interface UserStance extends UserStanceInput {
  id: string;
  updatedAt: string;
}

export interface PersonalAcademicGenealogyReport {
  generatedAt: string;
  profileSummary: string;
  stanceCount: number;
  connectedArguments: number;
  alignedFrameworks: Array<{
    framework: string;
    netAlignment: number;
    support: number;
    oppose: number;
    qualified: number;
    undecided: number;
  }>;
  scholarDialogues: Array<{
    scholar: string;
    support: number;
    oppose: number;
    qualified: number;
    undecided: number;
  }>;
  faultLines: string[];
}

export type ResearchNoteKind = 'observation' | 'question' | 'argument' | 'todo';
export type ResearchNoteTargetType = 'global' | 'node' | 'link';

export interface ResearchNote {
  id: string;
  createdAt: string;
  kind: ResearchNoteKind;
  targetType: ResearchNoteTargetType;
  targetId: string;
  content: string;
}

export interface OutlineProposal {
  generatedAt: string;
  title: string;
  sections: Array<{
    heading: string;
    rationale: string;
  }>;
  argumentGaps: string[];
  bibliographyByStyle: {
    sbl: string[];
    chicago: string[];
    mla: string[];
  };
}

export interface PublicationSyncStatus {
  status: 'up-to-date' | 'stale' | 'not-generated';
  evaluatedAt: string;
  changedNodeCount: number;
  changedLinkCount: number;
  changedCitationCount: number;
  impactedNodes: string[];
  notes: string[];
}

export interface PeerReviewGate {
  openMajor: number;
  openModerate: number;
  openMinor: number;
  openQuery: number;
  readyForPresentation: boolean;
  blockers: string[];
}

export interface NotebookSourceRecord {
  id: string;
  title: string;
  excerpt: string;
  citations?: string[];
  url?: string;
}

export interface NotebookCorpus {
  notebookId: string;
  notebookTitle?: string;
  syncedAt: string;
  sourceCount: number;
  sources: NotebookSourceRecord[];
  notes?: string[];
}

export interface Node {
  id: string;
  type: NodeType;
  source: SourceType;
  label: string;
  content: string;
  citations: string[];
  tradition?: TraditionTag;
  linguisticAnalysis?: {
    greekTerm?: string;
    hebrewTerm?: string;
    lxxEquivalent?: string;
    morphology?: string;
    semanticShift?: string;
    genderGrammar?: string;
    untranslatable?: string;
    greekToHebrewMappings?: Array<{
      greekLemma: string;
      hebrewLemmas: string[];
      lxxExamples?: string[];
      mtExamples?: string[];
      notes?: string;
    }>;
    secondTempleParallels?: Array<{
      corpus: 'DSS' | 'Pseudepigrapha' | 'Philo' | 'Josephus' | 'Other';
      reference: string;
      concept: string;
      notes?: string;
    }>;
    hellenisticParallels?: Array<{
      author: string;
      work?: string;
      greekTerm?: string;
      notes: string;
    }>;
    nearEasternParallels?: Array<{
      culture: string;
      corpus?: string;
      reference?: string;
      motifOrTerm: string;
      notes: string;
    }>;
  };
  symptomaticAnalysis?: {
    surplus?: string;
    silence?: string;
    repetition?: string;
    fantasy?: string;
  };
  manuscriptVariants?: {
    manuscript: string;
    reading: string;
    significance: string;
  }[];
  ruptureAnalysis?: {
    semanticRuptures?: Array<{
      from: string;
      to: string;
      significance: string;
    }>;
    syntacticRuptures?: Array<{
      from: string;
      to: string;
      significance: string;
    }>;
    untranslatables?: Array<{
      term: string;
      lossProfile: string;
      implications?: string;
    }>;
    historicalSilences?: Array<{
      missingReference: string;
      hypothesis: string;
      ideologicalFunction?: string;
    }>;
  };
  conceptualTopography?: {
    temporalAxis?: string;
    semanticAxis?: string;
    powerAxis?: string;
    cloudMovement?: string;
  };
  citationAudit?: {
    verified: string[];
    rejected?: Array<{
      citation: string;
      reason: string;
    }>;
    checkedAt: string;
    verifier: string;
  };
}

export interface Link {
  source: string;
  target: string;
  type: string;
  label: string;
  description: string;
  confidence?: LinkConfidence;
  scholarlyDebate?: {
    scholar: string;
    position: string;
    year: number;
    framework: string;
    critique: string;
  }[];
  methodologyTagging?: {
    hermeneuticFrameworks?: HermeneuticFramework[];
    canonicalAssumption?: CanonicalAssumption;
    languagePhilosophy?: LanguagePhilosophy;
    readings?: Array<{
      stance: string;
      reading: string;
      keyQuestion: string;
    }>;
    parallax?: {
      leftStance: string;
      rightStance: string;
      leftReading: string;
      rightReading: string;
      rupturePoints: Array<{
        theme: string;
        leftClaim: string;
        rightClaim: string;
        whyIrreconcilable: string;
      }>;
      sliderNote?: string;
    };
  };
  intertextualityMetrics?: {
    lexicalOverlap?: 'low' | 'medium' | 'high';
    syntacticSimilarity?: 'low' | 'medium' | 'high';
    conceptualDistance?: 'low' | 'medium' | 'high';
    contextualRarity?: 'low' | 'medium' | 'high';
    pValue?: string;
    conclusion?: string;
  };
}

export interface ResearchResult {
  nodes: Node[];
  links: Link[];
  summary: string;
}

export type PhaseKey =
  | 'phase0-notebook-sync'
  | 'phase1-structural-mapping'
  | 'phase2-philological-enrichment'
  | 'phase3-academic-rigor'
  | 'phase4-synthesis-summary'
  | 'phase5-verification'
  | 'phase6-counterfactual-lab'
  | 'phase7-intertextuality-stats'
  | 'phase8-citation-audit'
  | 'phase9-living-publication'
  | 'phase10-peer-review';

export interface ActivityLogEntry {
  id: string;
  phase: PhaseKey;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  timestamp: string;
}

export interface VerificationResult {
  status: 'verified' | 'corrected';
  notes?: string[];
  citationFixes?: Array<{
    nodeId?: string;
    linkId?: string;
    citations: string[];
    rationale?: string;
  }>;
}

export interface PipelineResult {
  result: ResearchResult;
  verification: VerificationResult;
}
