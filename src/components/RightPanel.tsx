import {
  AlertCircle,
  CheckCircle2,
  Download,
  FlaskConical,
  LibraryBig,
  Loader2,
  MoveHorizontal,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import { type ComponentPropsWithoutRef, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

import type {
  ConceptTopographyReport,
  CounterfactualResult,
  CounterfactualScenarioId,
  IntertextualityStatsReport,
  Link,
  LivingPublication,
  NegativeScriptureIndex,
  Node,
  OutlineProposal,
  PeerReviewGate,
  PeerReviewComment,
  PeerReviewCommentInput,
  PeerReviewPacket,
  PublicationSyncStatus,
  PersonalAcademicGenealogyReport,
  ResearchNote,
  ResearchNoteKind,
  RevisionDiffReport,
  ScholarlyEcosystemReport,
  TextualFluidityReport,
  UserStance,
  UserStanceInput,
  UserStanceValue,
  VerificationResult,
} from '../types';
import { cn } from '../lib/cn';

interface RightPanelProps {
  node?: Node;
  link?: Link;
  summary: string;
  verification?: VerificationResult;
  detailLoading?: boolean;
  onRegenerateNodeAnalysis: () => void;
  summaryLoading?: boolean;
  counterfactualLoading?: boolean;
  counterfactualScenario: CounterfactualScenarioId;
  counterfactualResult?: CounterfactualResult;
  onCounterfactualScenarioChange: (scenario: CounterfactualScenarioId) => void;
  onCounterfactualRun: () => void;
  intertextualityReport?: IntertextualityStatsReport;
  intertextualityLoading?: boolean;
  onRunIntertextualityTest: () => void;
  onRegenerateParallax: () => void;
  negativeScriptureIndex: NegativeScriptureIndex;
  conceptTopographyReport: ConceptTopographyReport;
  scholarlyEcosystem: ScholarlyEcosystemReport;
  textualFluidityReport?: TextualFluidityReport;
  outlineProposal: OutlineProposal;
  publicationSyncStatus: PublicationSyncStatus;
  researchNotes: ResearchNote[];
  pendingNoteKind: ResearchNoteKind;
  pendingNoteText: string;
  onPendingNoteKindChange: (kind: ResearchNoteKind) => void;
  onPendingNoteTextChange: (value: string) => void;
  onAddResearchNote: () => void;
  onDeleteResearchNote: (noteId: string) => void;
  userStances: UserStance[];
  personalGenealogyReport: PersonalAcademicGenealogyReport;
  onUpsertUserStance: (input: UserStanceInput) => void;
  publication?: LivingPublication;
  publicationLoading?: boolean;
  onGeneratePublication: () => void;
  onOpenPublicationNode: (nodeId: string) => void;
  peerReviewPacket?: PeerReviewPacket;
  peerReviewComments: PeerReviewComment[];
  peerReviewGate: PeerReviewGate;
  peerReviewLoading?: boolean;
  revisionDiff?: RevisionDiffReport;
  graphNodeCount: number;
  graphLinkCount: number;
  enrichedNodeCount: number;
  enrichedLinkCount: number;
  onGenerateBlindReviewPacket: () => void;
  onAddPeerReviewComment: (input: PeerReviewCommentInput) => void;
  onUpdatePeerReviewCommentStatus: (commentId: string, status: PeerReviewComment['status']) => void;
  tab: 'detail' | 'summary' | 'lab';
  onTabChange: (tab: 'detail' | 'summary' | 'lab') => void;
}

const COUNTERFACTUAL_LABELS: Record<CounterfactualScenarioId, string> = {
  'matthew-hebrew-not-lxx': 'Matthew Uses Hebrew Instead Of LXX',
  'second-temple-not-destroyed': 'Second Temple Not Destroyed',
  'philo-broad-circulation': 'Philo Broadly Circulates',
};

type ParallaxViewModel = {
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
  derived: boolean;
};

function fallbackParallaxFromReadings(link: Link): ParallaxViewModel | null {
  const readings = link.methodologyTagging?.readings;
  if (!readings || readings.length < 2) {
    return null;
  }

  const left = readings[0];
  const right = readings[1];
  return {
    leftStance: left.stance,
    rightStance: right.stance,
    leftReading: left.reading,
    rightReading: right.reading,
    rupturePoints: [
      {
        theme: 'Primary Question',
        leftClaim: left.keyQuestion,
        rightClaim: right.keyQuestion,
        whyIrreconcilable:
          'The two readings prioritize different controlling questions and therefore cannot be reduced to a single synthesis without loss.',
      },
    ],
    sliderNote: 'Generated from the first two stance readings because no explicit parallax block was returned.',
    derived: true,
  };
}

function fallbackParallaxFromDebate(link: Link): ParallaxViewModel | null {
  const debates = link.scholarlyDebate;
  if (!debates || debates.length < 2) {
    return null;
  }

  const left = debates[0];
  const right = debates[1];
  return {
    leftStance: `${left.scholar} (${left.year})`,
    rightStance: `${right.scholar} (${right.year})`,
    leftReading: left.position,
    rightReading: right.position,
    rupturePoints: [
      {
        theme: 'Methodological Tension',
        leftClaim: `${left.framework}: ${left.critique}`,
        rightClaim: `${right.framework}: ${right.critique}`,
        whyIrreconcilable:
          'The debate frames the same textual evidence through competing method constraints that yield divergent conclusions.',
      },
    ],
    sliderNote: 'Derived from two competing scholarly debate positions while explicit parallax data is pending.',
    derived: true,
  };
}

function getParallaxModel(link: Link): ParallaxViewModel | null {
  const explicit = link.methodologyTagging?.parallax;
  if (explicit) {
    return {
      ...explicit,
      derived: false,
    };
  }

  return fallbackParallaxFromReadings(link) ?? fallbackParallaxFromDebate(link);
}

function KeyValue({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <p className="text-sm text-slate-700">
      <span className="font-semibold text-slate-900">{label}:</span> {value}
    </p>
  );
}

function ToneBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
      {value}
    </span>
  );
}

const markdownComponents = {
  h1: ({ className, ...props }: ComponentPropsWithoutRef<'h1'>) => (
    <h1
      className={cn(
        'mt-1 mb-4 border-b border-amber-200 pb-2 text-3xl font-black tracking-tight text-slate-900',
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }: ComponentPropsWithoutRef<'h2'>) => (
    <h2
      className={cn(
        'mt-6 mb-2 text-xl font-extrabold tracking-tight text-slate-900',
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: ComponentPropsWithoutRef<'h3'>) => (
    <h3 className={cn('mt-4 mb-1 text-lg font-bold text-slate-900', className)} {...props} />
  ),
  h4: ({ className, ...props }: ComponentPropsWithoutRef<'h4'>) => (
    <h4 className={cn('mt-3 mb-1 text-base font-bold text-slate-900', className)} {...props} />
  ),
  p: ({ className, ...props }: ComponentPropsWithoutRef<'p'>) => (
    <p className={cn('my-2 text-sm leading-7 text-slate-700', className)} {...props} />
  ),
  ul: ({ className, ...props }: ComponentPropsWithoutRef<'ul'>) => (
    <ul className={cn('my-2 list-disc space-y-1 pl-5 text-sm text-slate-700', className)} {...props} />
  ),
  ol: ({ className, ...props }: ComponentPropsWithoutRef<'ol'>) => (
    <ol className={cn('my-2 list-decimal space-y-1 pl-5 text-sm text-slate-700', className)} {...props} />
  ),
  li: ({ className, ...props }: ComponentPropsWithoutRef<'li'>) => (
    <li className={cn('leading-6', className)} {...props} />
  ),
  strong: ({ className, ...props }: ComponentPropsWithoutRef<'strong'>) => (
    <strong className={cn('font-extrabold text-slate-900', className)} {...props} />
  ),
  blockquote: ({ className, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote
      className={cn(
        'my-3 border-l-4 border-amber-300 bg-amber-50/60 px-3 py-2 text-sm italic text-slate-700',
        className,
      )}
      {...props}
    />
  ),
};

export function RightPanel({
  node,
  link,
  summary,
  verification,
  detailLoading = false,
  onRegenerateNodeAnalysis,
  summaryLoading = false,
  counterfactualLoading = false,
  counterfactualScenario,
  counterfactualResult,
  onCounterfactualScenarioChange,
  onCounterfactualRun,
  intertextualityReport,
  intertextualityLoading = false,
  onRunIntertextualityTest,
  onRegenerateParallax,
  negativeScriptureIndex,
  conceptTopographyReport,
  scholarlyEcosystem,
  textualFluidityReport,
  outlineProposal,
  publicationSyncStatus,
  researchNotes,
  pendingNoteKind,
  pendingNoteText,
  onPendingNoteKindChange,
  onPendingNoteTextChange,
  onAddResearchNote,
  onDeleteResearchNote,
  userStances,
  personalGenealogyReport,
  onUpsertUserStance,
  publication,
  publicationLoading = false,
  onGeneratePublication,
  onOpenPublicationNode,
  peerReviewPacket,
  peerReviewComments,
  peerReviewGate,
  peerReviewLoading = false,
  revisionDiff,
  graphNodeCount,
  graphLinkCount,
  enrichedNodeCount,
  enrichedLinkCount,
  onGenerateBlindReviewPacket,
  onAddPeerReviewComment,
  onUpdatePeerReviewCommentStatus,
  tab,
  onTabChange,
}: RightPanelProps) {
  const [summaryView, setSummaryView] = useState<'summary' | 'publication'>('summary');
  const [reviewerAlias, setReviewerAlias] = useState('Reviewer A');
  const [reviewTargetType, setReviewTargetType] = useState<PeerReviewComment['targetType']>('publication');
  const [reviewTargetId, setReviewTargetId] = useState('publication');
  const [reviewSeverity, setReviewSeverity] = useState<PeerReviewComment['severity']>('moderate');
  const [reviewCommentText, setReviewCommentText] = useState('');
  const [parallaxShift, setParallaxShift] = useState(50);
  const [stanceRationaleDrafts, setStanceRationaleDrafts] = useState<Record<string, string>>({});
  const parallaxModel = useMemo(() => (link ? getParallaxModel(link) : null), [link]);
  const stanceMap = useMemo(() => new Map(userStances.map((entry) => [entry.id, entry])), [userStances]);
  const summaryReady = useMemo(
    () => summary.trim().length > 0 && !/^Open Summary to generate/i.test(summary.trim()),
    [summary],
  );
  const readyForPresentation =
    Boolean(publication) &&
    publicationSyncStatus.status !== 'stale' &&
    peerReviewGate.readyForPresentation;
  const activeNoteTarget = node
    ? `node:${node.id}`
    : link
      ? `link:${link.source}::${link.target}::${link.type}`
      : 'global';

  const handleStanceChange = (
    debate: { scholar: string; framework: string; position: string },
    value: UserStanceValue,
  ) => {
    if (!link) {
      return;
    }
    const targetLinkKey = `${link.source}::${link.target}::${link.type}`;
    const stanceId = `${targetLinkKey}::${debate.scholar.trim().toLowerCase()}`;
    const rationale = stanceRationaleDrafts[stanceId] ?? stanceMap.get(stanceId)?.rationale ?? '';
    onUpsertUserStance({
      targetLinkKey,
      linkLabel: link.label,
      scholar: debate.scholar,
      framework: debate.framework,
      positionSummary: debate.position,
      stance: value,
      rationale: rationale.trim() || undefined,
    });
  };

  const saveStanceRationale = (debate: { scholar: string; framework: string; position: string }) => {
    if (!link) {
      return;
    }
    const targetLinkKey = `${link.source}::${link.target}::${link.type}`;
    const stanceId = `${targetLinkKey}::${debate.scholar.trim().toLowerCase()}`;
    const existing = stanceMap.get(stanceId);
    const rationale = stanceRationaleDrafts[stanceId] ?? existing?.rationale ?? '';
    onUpsertUserStance({
      targetLinkKey,
      linkLabel: link.label,
      scholar: debate.scholar,
      framework: debate.framework,
      positionSummary: debate.position,
      stance: existing?.stance ?? 'qualified',
      rationale: rationale.trim() || undefined,
    });
  };

  useEffect(() => {
    setParallaxShift(50);
  }, [link?.source, link?.target, link?.type]);

  const handleExportPublication = () => {
    if (!publication) {
      return;
    }
    const blob = new Blob([publication.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${publication.id}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const submitReviewComment = () => {
    onAddPeerReviewComment({
      reviewerAlias,
      targetType: reviewTargetType,
      targetId: reviewTargetId.trim() || 'publication',
      severity: reviewSeverity,
      comment: reviewCommentText,
    });
    setReviewCommentText('');
  };

  return (
    <aside className="w-full border-t border-amber-200/80 bg-parchment/95 p-4 xl:h-screen xl:w-[620px] xl:border-l xl:border-t-0 2xl:w-[700px]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-olive">
          Scholarly Output
          {detailLoading || summaryLoading || counterfactualLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
        </h2>
        <div className="rounded-xl border border-amber-200 bg-white/70 p-1">
          <button
            onClick={() => onTabChange('detail')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              tab === 'detail' ? 'bg-deepSea text-white' : 'text-slate-600',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <LibraryBig className="h-3.5 w-3.5" /> Detail
            </span>
          </button>
          <button
            onClick={() => onTabChange('summary')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              tab === 'summary' ? 'bg-deepSea text-white' : 'text-slate-600',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <ScrollText className="h-3.5 w-3.5" /> Summary
            </span>
          </button>
          <button
            onClick={() => onTabChange('lab')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              tab === 'lab' ? 'bg-deepSea text-white' : 'text-slate-600',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" /> Lab
            </span>
          </button>
        </div>
      </div>

      {tab === 'detail' ? (
        <div className="h-[48vh] space-y-4 overflow-y-auto rounded-2xl border border-amber-200 bg-white/80 p-4 xl:h-[calc(100vh-110px)]">
          {detailLoading ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating detailed node/link analysis...
            </p>
          ) : null}
          {node ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-ink">{node.label}</h3>
                <button
                  onClick={onRegenerateNodeAnalysis}
                  disabled={detailLoading}
                  className="inline-flex items-center gap-1 rounded border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={cn('h-3 w-3', detailLoading ? 'animate-spin' : '')} />
                  Refresh Node Analysis
                </button>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{node.content}</p>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {node.source} • {node.type}
              </p>
              {node.tradition ? (
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Tradition:</span> {node.tradition.label}
                  {node.tradition.independence ? ` (${node.tradition.independence})` : ''}
                </p>
              ) : null}

              <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Linguistic Analysis
                </h4>
                <KeyValue label="Greek" value={node.linguisticAnalysis?.greekTerm} />
                <KeyValue label="Hebrew" value={node.linguisticAnalysis?.hebrewTerm} />
                <KeyValue label="LXX Equivalent" value={node.linguisticAnalysis?.lxxEquivalent} />
                <KeyValue label="Morphology" value={node.linguisticAnalysis?.morphology} />
                <KeyValue label="Semantic Shift" value={node.linguisticAnalysis?.semanticShift} />
                <KeyValue label="Gender Grammar" value={node.linguisticAnalysis?.genderGrammar} />
                <KeyValue
                  label="Untranslatable"
                  value={node.linguisticAnalysis?.untranslatable}
                />
                {!(
                  node.linguisticAnalysis?.greekTerm ||
                  node.linguisticAnalysis?.hebrewTerm ||
                  node.linguisticAnalysis?.lxxEquivalent ||
                  node.linguisticAnalysis?.morphology ||
                  node.linguisticAnalysis?.semanticShift ||
                  node.linguisticAnalysis?.genderGrammar ||
                  node.linguisticAnalysis?.untranslatable ||
                  node.linguisticAnalysis?.greekToHebrewMappings?.length ||
                  node.linguisticAnalysis?.secondTempleParallels?.length ||
                  node.linguisticAnalysis?.hellenisticParallels?.length
                ) ? (
                  <p className="text-xs text-slate-500">
                    No linguistic analysis generated yet. Click Refresh Node Analysis to retry.
                  </p>
                ) : null}
              </div>

              {node.linguisticAnalysis?.greekToHebrewMappings?.length ? (
                <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    Greek to Hebrew Mapping
                  </h4>
                  {node.linguisticAnalysis.greekToHebrewMappings.map((mapping) => (
                    <div key={`${node.id}-${mapping.greekLemma}-${mapping.hebrewLemmas.join('|')}`}>
                      <p className="text-sm font-semibold text-slate-900">{mapping.greekLemma}</p>
                      <p className="text-sm text-slate-700">
                        Hebrew: {mapping.hebrewLemmas.join(', ')}
                      </p>
                      {mapping.lxxExamples?.length ? (
                        <p className="text-sm text-slate-700">
                          LXX: {mapping.lxxExamples.join('; ')}
                        </p>
                      ) : null}
                      {mapping.mtExamples?.length ? (
                        <p className="text-sm text-slate-700">
                          MT: {mapping.mtExamples.join('; ')}
                        </p>
                      ) : null}
                      {mapping.notes ? <p className="text-sm text-slate-700">{mapping.notes}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {node.linguisticAnalysis?.secondTempleParallels?.length ? (
                <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    Second Temple Parallels
                  </h4>
                  {node.linguisticAnalysis.secondTempleParallels.map((parallel) => (
                    <div key={`${node.id}-${parallel.corpus}-${parallel.reference}`}>
                      <p className="text-sm font-semibold text-slate-900">
                        {parallel.corpus}: {parallel.reference}
                      </p>
                      <p className="text-sm text-slate-700">{parallel.concept}</p>
                      {parallel.notes ? <p className="text-sm text-slate-700">{parallel.notes}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {node.linguisticAnalysis?.hellenisticParallels?.length ? (
                <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    Hellenistic Parallels
                  </h4>
                  {node.linguisticAnalysis.hellenisticParallels.map((parallel) => (
                    <div key={`${node.id}-${parallel.author}-${parallel.work ?? parallel.notes}`}>
                      <p className="text-sm font-semibold text-slate-900">
                        {parallel.author}
                        {parallel.work ? `, ${parallel.work}` : ''}
                      </p>
                      {parallel.greekTerm ? (
                        <p className="text-sm text-slate-700">Greek Term: {parallel.greekTerm}</p>
                      ) : null}
                      <p className="text-sm text-slate-700">{parallel.notes}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Symptomatic Analysis
                </h4>
                <KeyValue label="Surplus" value={node.symptomaticAnalysis?.surplus} />
                <KeyValue label="Silence" value={node.symptomaticAnalysis?.silence} />
                <KeyValue label="Repetition" value={node.symptomaticAnalysis?.repetition} />
                <KeyValue label="Fantasy" value={node.symptomaticAnalysis?.fantasy} />
                {!(
                  node.symptomaticAnalysis?.surplus ||
                  node.symptomaticAnalysis?.silence ||
                  node.symptomaticAnalysis?.repetition ||
                  node.symptomaticAnalysis?.fantasy
                ) ? (
                  <p className="text-xs text-slate-500">
                    No symptomatic analysis generated yet. Click Refresh Node Analysis to retry.
                  </p>
                ) : null}
              </div>

              {node.manuscriptVariants?.length ? (
                <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    Manuscript Variants
                  </h4>
                  {node.manuscriptVariants.map((variant) => (
                    <div key={`${node.id}-${variant.manuscript}-${variant.reading}`}>
                      <p className="text-sm font-semibold text-slate-900">{variant.manuscript}</p>
                      <p className="text-sm text-slate-700">{variant.reading}</p>
                      <p className="text-sm text-slate-700">{variant.significance}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Textual Fluidity
                </h4>
                {textualFluidityReport && textualFluidityReport.nodeId === node.id ? (
                  <>
                    <KeyValue label="Witness Count" value={String(textualFluidityReport.witnessCount)} />
                    <KeyValue label="Variant Count" value={String(textualFluidityReport.variantCount)} />
                    <KeyValue label="Drift Index" value={textualFluidityReport.driftIndex.toFixed(3)} />
                    <p className="text-sm text-slate-700">{textualFluidityReport.assessment}</p>
                    <div className="rounded-lg border border-amber-100 bg-white p-2">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Virtual Urtext Cloud
                      </p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {textualFluidityReport.urtextCloud.map((candidate) => (
                          <li key={`${node.id}-urtext-${candidate.reading}`}>
                            <p className="font-semibold text-slate-800">
                              {candidate.probability.toFixed(2)} • {candidate.reading}
                            </p>
                            <p>{candidate.witnesses.join(', ')}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">
                    No manuscript-variant probability cloud available for this node yet.
                  </p>
                )}
              </div>

              {node.ruptureAnalysis ? (
                <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    Rupture Diagnostics
                  </h4>
                  {node.ruptureAnalysis.semanticRuptures?.map((rupture) => (
                    <div key={`${node.id}-sem-${rupture.from}-${rupture.to}`}>
                      <p className="text-sm font-semibold text-slate-900">
                        Semantic: {rupture.from} {'->'} {rupture.to}
                      </p>
                      <p className="text-sm text-slate-700">{rupture.significance}</p>
                    </div>
                  ))}
                  {node.ruptureAnalysis.syntacticRuptures?.map((rupture) => (
                    <div key={`${node.id}-syn-${rupture.from}-${rupture.to}`}>
                      <p className="text-sm font-semibold text-slate-900">
                        Syntactic: {rupture.from} {'->'} {rupture.to}
                      </p>
                      <p className="text-sm text-slate-700">{rupture.significance}</p>
                    </div>
                  ))}
                  {node.ruptureAnalysis.untranslatables?.map((entry) => (
                    <div key={`${node.id}-unt-${entry.term}`}>
                      <p className="text-sm font-semibold text-slate-900">Untranslatable: {entry.term}</p>
                      <p className="text-sm text-slate-700">{entry.lossProfile}</p>
                      {entry.implications ? (
                        <p className="text-sm text-slate-700">{entry.implications}</p>
                      ) : null}
                    </div>
                  ))}
                  {node.ruptureAnalysis.historicalSilences?.map((entry) => (
                    <div key={`${node.id}-sil-${entry.missingReference}`}>
                      <p className="text-sm font-semibold text-slate-900">
                        Historical Silence: {entry.missingReference}
                      </p>
                      <p className="text-sm text-slate-700">{entry.hypothesis}</p>
                      {entry.ideologicalFunction ? (
                        <p className="text-sm text-slate-700">{entry.ideologicalFunction}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {node.conceptualTopography ? (
                <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    Conceptual Topography
                  </h4>
                  <KeyValue label="Temporal Axis" value={node.conceptualTopography.temporalAxis} />
                  <KeyValue label="Semantic Axis" value={node.conceptualTopography.semanticAxis} />
                  <KeyValue label="Power Axis" value={node.conceptualTopography.powerAxis} />
                  <KeyValue label="Cloud Movement" value={node.conceptualTopography.cloudMovement} />
                </div>
              ) : null}

              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Citations
                </h4>
                {node.citations.length > 0 ? (
                  <ul className="list-inside list-disc text-sm text-slate-700">
                    {node.citations.map((citation) => (
                      <li key={`${node.id}-${citation}`}>{citation}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No verified citations available for this node.</p>
                )}

                {node.citationAudit?.rejected?.length ? (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">
                      Rejected Citations ({node.citationAudit.rejected.length})
                    </p>
                    <ul className="mt-1 list-inside list-disc text-xs text-red-700">
                      {node.citationAudit.rejected.map((entry) => (
                        <li key={`${node.id}-rej-${entry.citation}`}>
                          {entry.citation}: {entry.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {!node && link ? (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-ink">{link.label}</h3>
              <p className="text-sm text-slate-700">{link.description}</p>
              <p className="text-xs uppercase tracking-wider text-slate-500">{link.type}</p>

              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <button
                  onClick={onRunIntertextualityTest}
                  disabled={intertextualityLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-deepSea px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#18304f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  {intertextualityLoading ? 'Running Statistical Test...' : 'Run Statistical Test'}
                </button>
                {intertextualityReport ? (
                  <p className="mt-2 text-xs text-emerald-700">
                    Last result: p={intertextualityReport.pValue.toExponential(2)} • composite{' '}
                    {intertextualityReport.compositeScore.toFixed(3)}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">No statistical report generated yet for this link.</p>
                )}
              </div>

              {link.scholarlyDebate?.length ? (
                <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    Scholarly Debate
                  </h4>
                  {link.scholarlyDebate.map((debate) => (
                    <div key={`${link.source}-${link.target}-${debate.scholar}-${debate.year}`}>
                      <p className="text-sm font-semibold text-slate-900">
                        {debate.scholar} ({debate.year})
                      </p>
                      <p className="text-sm text-slate-700">{debate.position}</p>
                      <p className="text-sm text-slate-700">Framework: {debate.framework}</p>
                      <p className="text-sm text-slate-700">Critique: {debate.critique}</p>
                      <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-[140px_1fr_auto]">
                        <select
                          value={
                            stanceMap.get(
                              `${link.source}::${link.target}::${link.type}::${debate.scholar.trim().toLowerCase()}`,
                            )?.stance ?? 'undecided'
                          }
                          onChange={(event) =>
                            handleStanceChange(debate, event.target.value as UserStanceValue)
                          }
                          className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700"
                        >
                          <option value="support">Support</option>
                          <option value="qualified">Qualified</option>
                          <option value="oppose">Oppose</option>
                          <option value="undecided">Undecided</option>
                        </select>
                        <input
                          value={
                            stanceRationaleDrafts[
                              `${link.source}::${link.target}::${link.type}::${debate.scholar.trim().toLowerCase()}`
                            ] ??
                            stanceMap.get(
                              `${link.source}::${link.target}::${link.type}::${debate.scholar.trim().toLowerCase()}`,
                            )?.rationale ??
                            ''
                          }
                          onChange={(event) =>
                            setStanceRationaleDrafts((prev) => ({
                              ...prev,
                              [`${link.source}::${link.target}::${link.type}::${debate.scholar.trim().toLowerCase()}`]:
                                event.target.value,
                            }))
                          }
                          className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700"
                          placeholder="Your rationale..."
                        />
                        <button
                          onClick={() => saveStanceRationale(debate)}
                          className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-amber-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No scholarly debate loaded for this connection yet.</p>
              )}

              {link.methodologyTagging ? (
                <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    Methodology Tagging
                  </h4>
                  {link.methodologyTagging.hermeneuticFrameworks?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {link.methodologyTagging.hermeneuticFrameworks.map((framework) => (
                        <ToneBadge key={`${link.source}-${link.target}-${framework}`} value={framework} />
                      ))}
                    </div>
                  ) : null}
                  <KeyValue label="Canonical Assumption" value={link.methodologyTagging.canonicalAssumption} />
                  <KeyValue label="Language Philosophy" value={link.methodologyTagging.languagePhilosophy} />

                  {link.methodologyTagging.readings?.length ? (
                    <div className="overflow-x-auto rounded-lg border border-amber-100 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-amber-50 text-slate-700">
                          <tr>
                            <th className="px-2 py-1.5 font-semibold">Stance</th>
                            <th className="px-2 py-1.5 font-semibold">Reading</th>
                            <th className="px-2 py-1.5 font-semibold">Key Question</th>
                          </tr>
                        </thead>
                        <tbody>
                          {link.methodologyTagging.readings.map((reading, index) => (
                            <tr key={`${link.source}-${link.target}-reading-${index}`} className="align-top">
                              <td className="border-t border-amber-100 px-2 py-1.5 text-slate-900">
                                {reading.stance}
                              </td>
                              <td className="border-t border-amber-100 px-2 py-1.5 text-slate-700">
                                {reading.reading}
                              </td>
                              <td className="border-t border-amber-100 px-2 py-1.5 text-slate-700">
                                {reading.keyQuestion}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2 rounded-xl border border-amber-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    <MoveHorizontal className="h-3.5 w-3.5" />
                    Parallax Shift
                  </h4>
                  <div className="flex items-center gap-1.5">
                    {parallaxModel ? (
                      parallaxModel.derived ? (
                        <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                          Derived
                        </span>
                      ) : (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                          Explicit
                        </span>
                      )
                    ) : (
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Pending
                      </span>
                    )}
                    <button
                      onClick={onRegenerateParallax}
                      disabled={detailLoading}
                      className="inline-flex items-center gap-1 rounded border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw className={cn('h-3 w-3', detailLoading ? 'animate-spin' : '')} />
                      {parallaxModel ? 'Refresh' : 'Generate'}
                    </button>
                  </div>
                </div>

                {parallaxModel ? (
                  <>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div
                        className="rounded-lg border border-amber-100 bg-amber-50/40 p-2 transition-opacity"
                        style={{ opacity: 0.35 + ((100 - parallaxShift) / 100) * 0.65 }}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          {parallaxModel.leftStance}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">{parallaxModel.leftReading}</p>
                      </div>
                      <div
                        className="rounded-lg border border-amber-100 bg-amber-50/40 p-2 transition-opacity"
                        style={{ opacity: 0.35 + (parallaxShift / 100) * 0.65 }}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          {parallaxModel.rightStance}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">{parallaxModel.rightReading}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                        <span>Focus: {parallaxModel.leftStance}</span>
                        <span>Focus: {parallaxModel.rightStance}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={parallaxShift}
                        onChange={(event) => setParallaxShift(Number(event.target.value))}
                        className="w-full accent-deepSea"
                      />
                      <p className="text-[11px] text-slate-500">
                        Move the slider to shift attention across the two irreconcilable readings.
                      </p>
                      {parallaxModel.sliderNote ? (
                        <p className="text-[11px] text-slate-500">{parallaxModel.sliderNote}</p>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Rupture Points
                      </p>
                      <ul className="mt-1 space-y-1.5 text-xs text-slate-700">
                        {parallaxModel.rupturePoints.map((point, index) => (
                          <li
                            key={`${link.source}-${link.target}-parallax-${index}-${point.theme}`}
                            className="rounded border border-amber-100 bg-white/80 p-2"
                          >
                            <p className="font-semibold text-slate-900">{point.theme}</p>
                            <p>
                              <span className="font-semibold text-slate-800">{parallaxModel.leftStance}:</span>{' '}
                              {point.leftClaim}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-800">{parallaxModel.rightStance}:</span>{' '}
                              {point.rightClaim}
                            </p>
                            <p className="text-slate-600">{point.whyIrreconcilable}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">
                    Parallax data will appear after link enrichment returns at least two stance readings.
                  </p>
                )}
              </div>

              {link.intertextualityMetrics ? (
                <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    Intertextuality Significance
                  </h4>
                  <KeyValue label="Lexical Overlap" value={link.intertextualityMetrics.lexicalOverlap} />
                  <KeyValue
                    label="Syntactic Similarity"
                    value={link.intertextualityMetrics.syntacticSimilarity}
                  />
                  <KeyValue
                    label="Conceptual Distance"
                    value={link.intertextualityMetrics.conceptualDistance}
                  />
                  <KeyValue label="Contextual Rarity" value={link.intertextualityMetrics.contextualRarity} />
                  <KeyValue label="p-Value" value={link.intertextualityMetrics.pValue} />
                  <KeyValue label="Conclusion" value={link.intertextualityMetrics.conclusion} />
                </div>
              ) : null}

              {intertextualityReport ? (
                <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                    Statistical Report
                  </h4>
                  <KeyValue
                    label="Lexical Jaccard"
                    value={intertextualityReport.lexicalJaccard.toFixed(3)}
                  />
                  <KeyValue
                    label="Bigram Jaccard"
                    value={intertextualityReport.ngramJaccard.toFixed(3)}
                  />
                  <KeyValue
                    label="Syntactic Similarity"
                    value={intertextualityReport.syntacticSimilarity.toFixed(3)}
                  />
                  <KeyValue
                    label="Conceptual Cosine"
                    value={intertextualityReport.conceptualCosine.toFixed(3)}
                  />
                  <KeyValue
                    label="Contextual Rarity"
                    value={intertextualityReport.contextualRarity.toFixed(3)}
                  />
                  <KeyValue
                    label="Composite Score"
                    value={intertextualityReport.compositeScore.toFixed(3)}
                  />
                  <KeyValue
                    label="p-Value"
                    value={`${intertextualityReport.pValue.toExponential(2)} (${intertextualityReport.permutationIterations} permutations)`}
                  />
                  <KeyValue label="Interpretation" value={intertextualityReport.interpretation} />
                  {intertextualityReport.overlapTokens.length > 0 ? (
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Overlap Tokens:</span>{' '}
                      {intertextualityReport.overlapTokens.join(', ')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {!node && !link ? (
            <p className="text-sm text-slate-500">Select a node or link from the graph to inspect details.</p>
          ) : null}
        </div>
      ) : tab === 'summary' ? (
        <div className="h-[48vh] overflow-y-auto rounded-2xl border border-amber-200 bg-white/80 p-4 xl:h-[calc(100vh-110px)]">
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
              Guided Workflow
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between rounded-md border border-amber-100 bg-white p-2">
                <p className="text-slate-700">
                  {graphNodeCount > 0 && graphLinkCount > 0 ? 'Done' : 'Pending'}: Build structural graph
                  ({graphNodeCount} nodes, {graphLinkCount} links)
                </p>
                {graphNodeCount > 0 && graphLinkCount > 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border border-amber-100 bg-white p-2">
                <p className="text-slate-700">
                  {(enrichedNodeCount > 0 || enrichedLinkCount > 0) ? 'Done' : 'Pending'}: Enrich nodes/links
                  ({enrichedNodeCount} nodes, {enrichedLinkCount} links)
                </p>
                <button
                  onClick={() => onTabChange('detail')}
                  className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-100"
                >
                  Open Detail
                </button>
              </div>

              <div className="flex items-center justify-between rounded-md border border-amber-100 bg-white p-2">
                <p className="text-slate-700">{summaryReady ? 'Done' : 'Pending'}: Generate summary draft</p>
                <button
                  onClick={() => setSummaryView('summary')}
                  className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-100"
                >
                  Open Summary
                </button>
              </div>

              <div className="flex items-center justify-between rounded-md border border-amber-100 bg-white p-2">
                <p className="text-slate-700">{publication ? 'Done' : 'Pending'}: Generate living publication</p>
                <button
                  onClick={onGeneratePublication}
                  disabled={publicationLoading}
                  className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publicationLoading ? 'Generating...' : 'Generate'}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-md border border-amber-100 bg-white p-2">
                <p className="text-slate-700">
                  {peerReviewPacket ? 'Done' : 'Pending'}: Generate blind review packet
                </p>
                <button
                  onClick={onGenerateBlindReviewPacket}
                  disabled={peerReviewLoading || !publication}
                  className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {peerReviewLoading ? 'Generating...' : 'Generate'}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-md border border-amber-100 bg-white p-2">
                <p className="text-slate-700">
                  {readyForPresentation ? 'Ready' : 'Pending'}: Presentation gate
                </p>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                    readyForPresentation ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800',
                  )}
                >
                  {readyForPresentation ? 'Ready' : 'Needs Work'}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-3 inline-flex rounded-lg border border-amber-200 bg-white p-1">
            <button
              onClick={() => setSummaryView('summary')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold',
                summaryView === 'summary' ? 'bg-deepSea text-white' : 'text-slate-700',
              )}
            >
              Summary Draft
            </button>
            <button
              onClick={() => setSummaryView('publication')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold',
                summaryView === 'publication' ? 'bg-deepSea text-white' : 'text-slate-700',
              )}
            >
              Living Publication
            </button>
          </div>

          {summaryLoading ? (
            <p className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating summary...
            </p>
          ) : null}
          {summaryView === 'summary' ? (
            <>
              <div className="max-w-none">
                <ReactMarkdown components={markdownComponents}>
                  {summary || 'Open Summary to generate the synthesis essay.'}
                </ReactMarkdown>
              </div>

              {verification ? (
                <div
                  className={cn(
                    'mt-4 rounded-xl border p-3',
                    verification.status === 'verified'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-amber-200 bg-amber-50',
                  )}
                >
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    {verification.status === 'verified' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-700" />
                    )}
                    Verification: {verification.status}
                  </div>
                  {verification.notes?.length ? (
                    <ul className="list-inside list-disc text-sm text-slate-700">
                      {verification.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Living Publication
                </h4>
                <button
                  onClick={onGeneratePublication}
                  disabled={publicationLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-deepSea px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#18304f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ScrollText className="h-3.5 w-3.5" />
                  {publicationLoading ? 'Generating...' : 'Generate'}
                </button>
              </div>

              {publication ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    {publication.versionLabel} • {new Date(publication.generatedAt).toLocaleString()}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{publication.title}</p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportPublication}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-amber-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export .md
                    </button>
                  </div>

                  <div className="rounded-lg border border-amber-100 bg-white p-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Publication Draft
                    </p>
                    <div className="max-h-[40vh] overflow-y-auto rounded-md border border-amber-100 bg-amber-50/30 p-2">
                      <ReactMarkdown components={markdownComponents}>
                        {publication.markdown}
                      </ReactMarkdown>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-100 bg-white p-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Citation Index
                    </p>
                    {publication.citationIndex.length > 0 ? (
                      <ul className="space-y-1 text-xs text-slate-700">
                        {publication.citationIndex.map((entry) => (
                          <li key={`pub-citation-${entry.citation}`}>
                            <p className="font-semibold text-slate-800">{entry.citation}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {entry.nodeIds.map((nodeId) => (
                                <button
                                  key={`pub-node-${entry.citation}-${nodeId}`}
                                  onClick={() => onOpenPublicationNode(nodeId)}
                                  className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] text-slate-700 hover:bg-amber-100"
                                >
                                  Open {nodeId}
                                </button>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">No citation index generated.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-amber-100 bg-white p-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Impact Monitor
                    </p>
                    {publication.impactNotes.length > 0 ? (
                      <ul className="list-inside list-disc text-xs text-slate-700">
                        {publication.impactNotes.map((note) => (
                          <li key={`impact-${note}`}>{note}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">No impact notes.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-amber-100 bg-white p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Peer Review Workflow
                      </p>
                      <button
                        onClick={onGenerateBlindReviewPacket}
                        disabled={peerReviewLoading}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {peerReviewLoading ? 'Generating...' : 'Generate Blind Packet'}
                      </button>
                    </div>

                    {peerReviewPacket ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600">
                          {peerReviewPacket.versionLabel} • {new Date(peerReviewPacket.createdAt).toLocaleString()}
                        </p>
                        <div className="max-h-44 overflow-y-auto rounded-md border border-amber-100 bg-amber-50/30 p-2">
                          <ReactMarkdown components={markdownComponents}>
                            {peerReviewPacket.anonymizedMarkdown}
                          </ReactMarkdown>
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <input
                            value={reviewerAlias}
                            onChange={(event) => setReviewerAlias(event.target.value)}
                            className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700"
                            placeholder="Reviewer Alias"
                          />
                          <select
                            value={reviewSeverity}
                            onChange={(event) =>
                              setReviewSeverity(event.target.value as PeerReviewComment['severity'])
                            }
                            className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700"
                          >
                            <option value="major">Major</option>
                            <option value="moderate">Moderate</option>
                            <option value="minor">Minor</option>
                            <option value="query">Query</option>
                          </select>
                          <select
                            value={reviewTargetType}
                            onChange={(event) =>
                              setReviewTargetType(event.target.value as PeerReviewComment['targetType'])
                            }
                            className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700"
                          >
                            <option value="publication">Publication</option>
                            <option value="node">Node</option>
                            <option value="link">Link</option>
                          </select>
                          <input
                            value={reviewTargetId}
                            onChange={(event) => setReviewTargetId(event.target.value)}
                            className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700"
                            placeholder="Target ID (e.g. node-id or source::target::type)"
                          />
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {publication ? (
                            <button
                              onClick={() => {
                                setReviewTargetType('publication');
                                setReviewTargetId(publication.id);
                              }}
                              className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 hover:bg-amber-50"
                            >
                              Use Publication ID
                            </button>
                          ) : null}
                          {node ? (
                            <button
                              onClick={() => {
                                setReviewTargetType('node');
                                setReviewTargetId(node.id);
                              }}
                              className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 hover:bg-amber-50"
                            >
                              Use Node: {node.id}
                            </button>
                          ) : null}
                          {link ? (
                            <button
                              onClick={() => {
                                setReviewTargetType('link');
                                setReviewTargetId(`${link.source}::${link.target}::${link.type}`);
                              }}
                              className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 hover:bg-amber-50"
                            >
                              Use Current Link
                            </button>
                          ) : null}
                        </div>

                        <textarea
                          value={reviewCommentText}
                          onChange={(event) => setReviewCommentText(event.target.value)}
                          rows={3}
                          className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                          placeholder="Reviewer comment..."
                        />
                        <button
                          onClick={submitReviewComment}
                          disabled={!reviewCommentText.trim()}
                          className="inline-flex items-center gap-1 rounded-md bg-deepSea px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#18304f] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Add Review Comment
                        </button>

                        {revisionDiff ? (
                          <div className="rounded-md border border-amber-100 bg-amber-50/40 p-2">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                              Revision Diff Since Packet
                            </p>
                            <ul className="list-inside list-disc text-[11px] text-slate-700">
                              <li>Nodes added: {revisionDiff.nodesAdded.length}</li>
                              <li>Nodes removed: {revisionDiff.nodesRemoved.length}</li>
                              <li>Links added: {revisionDiff.linksAdded.length}</li>
                              <li>Links removed: {revisionDiff.linksRemoved.length}</li>
                              <li>Citations added: {revisionDiff.citationsAdded.length}</li>
                              <li>Citations removed: {revisionDiff.citationsRemoved.length}</li>
                              <li>Rejected citation delta: {revisionDiff.rejectedCitationCountDelta}</li>
                            </ul>
                          </div>
                        ) : null}

                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                            Review Comments ({peerReviewComments.length})
                          </p>
                          {peerReviewComments.length > 0 ? (
                            <ul className="space-y-1.5">
                              {peerReviewComments.map((entry) => (
                                <li
                                  key={entry.id}
                                  className="rounded border border-amber-100 bg-amber-50/40 p-2 text-xs text-slate-700"
                                >
                                  <p className="font-semibold text-slate-800">
                                    {entry.reviewerAlias} • {entry.severity.toUpperCase()} • {entry.targetType}:{' '}
                                    {entry.targetId}
                                  </p>
                                  <p>{entry.comment}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="text-[11px] text-slate-500">
                                      {new Date(entry.createdAt).toLocaleString()}
                                    </span>
                                    <button
                                      onClick={() =>
                                        onUpdatePeerReviewCommentStatus(
                                          entry.id,
                                          entry.status === 'open' ? 'addressed' : 'open',
                                        )
                                      }
                                      className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700"
                                    >
                                      Mark {entry.status === 'open' ? 'Addressed' : 'Open'}
                                    </button>
                                    <span className="text-[11px] font-semibold text-slate-600">
                                      {entry.status}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-slate-500">No review comments yet.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Generate a blind packet to start reviewer mapping and revision tracking.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Generate a living publication to map bibliography entries back to graph nodes.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
              Outline Proposal
            </h4>
            <p className="text-sm font-semibold text-slate-900">{outlineProposal.title}</p>
            <p className="text-[11px] text-slate-500">
              Generated {new Date(outlineProposal.generatedAt).toLocaleString()}
            </p>

            <div className="mt-2 space-y-2">
              {outlineProposal.sections.map((section, index) => (
                <div key={`outline-${section.heading}`} className="rounded-md border border-amber-100 bg-white p-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                    Section {index + 1}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{section.heading}</p>
                  <p className="text-xs text-slate-700">{section.rationale}</p>
                </div>
              ))}
            </div>

            <div className="mt-2 rounded-md border border-amber-100 bg-white p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Argument Gaps
              </p>
              {outlineProposal.argumentGaps.length > 0 ? (
                <ul className="list-inside list-disc text-xs text-slate-700">
                  {outlineProposal.argumentGaps.map((gap) => (
                    <li key={`gap-${gap}`}>{gap}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No structural gaps detected in current graph coverage.</p>
              )}
            </div>

            <div className="mt-2 rounded-md border border-amber-100 bg-white p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Bibliography Preview
              </p>
              <p className="text-[11px] text-slate-500">
                SBL {outlineProposal.bibliographyByStyle.sbl.length} entries • Chicago{' '}
                {outlineProposal.bibliographyByStyle.chicago.length} • MLA{' '}
                {outlineProposal.bibliographyByStyle.mla.length}
              </p>
              {outlineProposal.bibliographyByStyle.sbl.length > 0 ? (
                <ul className="mt-1 list-inside list-disc text-xs text-slate-700">
                  {outlineProposal.bibliographyByStyle.sbl.slice(0, 6).map((entry) => (
                    <li key={`sbl-${entry}`}>{entry}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No verified citations available for bibliography export.</p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
              Research Notes
            </h4>
            <p className="text-[11px] text-slate-500">Current target: {activeNoteTarget}</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[150px_1fr]">
              <select
                value={pendingNoteKind}
                onChange={(event) => onPendingNoteKindChange(event.target.value as ResearchNoteKind)}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value="observation">Observation</option>
                <option value="question">Question</option>
                <option value="argument">Argument</option>
                <option value="todo">To-Do</option>
              </select>
              <textarea
                value={pendingNoteText}
                onChange={(event) => onPendingNoteTextChange(event.target.value)}
                rows={2}
                className="w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700"
                placeholder="Add a research note linked to selected node/link or global context..."
              />
            </div>
            <button
              onClick={onAddResearchNote}
              disabled={!pendingNoteText.trim()}
              className="mt-2 inline-flex items-center gap-1 rounded-md bg-deepSea px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#18304f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add Note
            </button>

            <div className="mt-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Note Log ({researchNotes.length})
              </p>
              {researchNotes.length > 0 ? (
                <ul className="max-h-44 space-y-1.5 overflow-y-auto">
                  {researchNotes.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded border border-amber-100 bg-white p-2 text-xs text-slate-700"
                    >
                      <p className="font-semibold text-slate-800">
                        {entry.kind.toUpperCase()} • {entry.targetType}:{entry.targetId}
                      </p>
                      <p>{entry.content}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                        <button
                          onClick={() => onDeleteResearchNote(entry.id)}
                          className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] text-slate-700 hover:bg-amber-100"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No research notes yet.</p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
              Publication Sync
            </h4>
            <p className="text-sm font-semibold text-slate-900">
              Status:{' '}
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs',
                  publicationSyncStatus.status === 'up-to-date'
                    ? 'bg-emerald-100 text-emerald-800'
                    : publicationSyncStatus.status === 'stale'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700',
                )}
              >
                {publicationSyncStatus.status}
              </span>
            </p>
            <p className="text-[11px] text-slate-500">
              Evaluated {new Date(publicationSyncStatus.evaluatedAt).toLocaleString()}
            </p>
            <ul className="mt-2 list-inside list-disc text-xs text-slate-700">
              <li>Changed nodes: {publicationSyncStatus.changedNodeCount}</li>
              <li>Changed links: {publicationSyncStatus.changedLinkCount}</li>
              <li>Changed citations: {publicationSyncStatus.changedCitationCount}</li>
            </ul>
            {publicationSyncStatus.impactedNodes.length > 0 ? (
              <p className="mt-1 text-xs text-slate-700">
                Impacted nodes: {publicationSyncStatus.impactedNodes.join(', ')}
              </p>
            ) : null}
            {publicationSyncStatus.notes.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                {publicationSyncStatus.notes.map((note) => (
                  <li key={`sync-note-${note}`}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
              Peer Review Gate
            </h4>
            <p className="text-sm font-semibold text-slate-900">
              Readiness:{' '}
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs',
                  peerReviewGate.readyForPresentation
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-700',
                )}
              >
                {peerReviewGate.readyForPresentation ? 'Ready for presentation' : 'Not ready'}
              </span>
            </p>
            <ul className="mt-2 list-inside list-disc text-xs text-slate-700">
              <li>Open major: {peerReviewGate.openMajor}</li>
              <li>Open moderate: {peerReviewGate.openModerate}</li>
              <li>Open minor: {peerReviewGate.openMinor}</li>
              <li>Open query: {peerReviewGate.openQuery}</li>
            </ul>
            {peerReviewGate.blockers.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-xs text-red-700">
                {peerReviewGate.blockers.map((blocker) => (
                  <li key={`blocker-${blocker}`}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-emerald-700">No blocking review issues remain.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="h-[48vh] space-y-4 overflow-y-auto rounded-2xl border border-amber-200 bg-white/80 p-4 xl:h-[calc(100vh-110px)]">
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <h3 className="mb-2 text-sm font-semibold text-ink">Counterfactual Lab</h3>
            <p className="mb-3 text-xs text-slate-600">
              Simulate alternative historical trajectories and inspect theological-methodological consequences.
            </p>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-olive">
              Scenario
            </label>
            <select
              value={counterfactualScenario}
              onChange={(event) =>
                onCounterfactualScenarioChange(event.target.value as CounterfactualScenarioId)
              }
              className="mb-3 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-bronze"
            >
              {(Object.keys(COUNTERFACTUAL_LABELS) as CounterfactualScenarioId[]).map((scenario) => (
                <option key={scenario} value={scenario}>
                  {COUNTERFACTUAL_LABELS[scenario]}
                </option>
              ))}
            </select>
            <button
              onClick={onCounterfactualRun}
              disabled={counterfactualLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-deepSea px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#18304f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              {counterfactualLoading ? 'Simulating...' : 'Run What-if'}
            </button>
          </div>

          {counterfactualResult ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Hypothesis
                </h4>
                <p className="text-sm text-slate-700">{counterfactualResult.hypothesis}</p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Projected Shifts
                </h4>
                {counterfactualResult.projectedShifts.length > 0 ? (
                  <ul className="list-inside list-disc text-sm text-slate-700">
                    {counterfactualResult.projectedShifts.map((shift) => (
                      <li key={shift}>{shift}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No projected shifts returned.</p>
                )}
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Theological Consequences
                </h4>
                {counterfactualResult.theologicalConsequences.length > 0 ? (
                  <ul className="list-inside list-disc text-sm text-slate-700">
                    {counterfactualResult.theologicalConsequences.map((consequence) => (
                      <li key={consequence}>{consequence}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No consequences returned.</p>
                )}
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Methodological Reflection
                </h4>
                <div className="prose prose-sm max-w-none text-slate-700">
                  <ReactMarkdown>{counterfactualResult.methodologicalReflection}</ReactMarkdown>
                </div>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  Citations
                </h4>
                {counterfactualResult.citations.length > 0 ? (
                  <ul className="list-inside list-disc text-sm text-slate-700">
                    {counterfactualResult.citations.map((citation) => (
                      <li key={citation}>{citation}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No citations returned.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Select a scenario and run the simulation to generate counterfactual analysis.
            </p>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <h3 className="mb-2 text-sm font-semibold text-ink">Negative Scripture Index</h3>
            <p className="text-[11px] text-slate-500">
              Generated {new Date(negativeScriptureIndex.generatedAt).toLocaleString()}
            </p>
            {negativeScriptureIndex.notes.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-slate-700">
                {negativeScriptureIndex.notes.map((note) => (
                  <li key={`neg-note-${note}`}>{note}</li>
                ))}
              </ul>
            ) : null}
            {negativeScriptureIndex.absentInNT.length > 0 ? (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-amber-100 bg-white p-2">
                {negativeScriptureIndex.absentInNT.map((entry) => (
                  <li key={`neg-${entry.book}`} className="text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">
                      {entry.book} ({entry.mentionCountOutsideNT})
                    </p>
                    {entry.ideologicalFunction ? <p>{entry.ideologicalFunction}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No negative scripture pattern detected.</p>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <h3 className="mb-2 text-sm font-semibold text-ink">Concept Topography</h3>
            <p className="text-xs text-slate-700">{conceptTopographyReport.summary}</p>
            {conceptTopographyReport.entries.length > 0 ? (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-amber-100 bg-white p-2">
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {conceptTopographyReport.entries.slice(0, 20).map((entry) => (
                    <li key={`topo-${entry.nodeId}`} className="rounded border border-amber-100 bg-amber-50/30 p-2">
                      <p className="font-semibold text-slate-900">
                        {entry.label} ({entry.source})
                      </p>
                      <p>
                        Year {entry.estimatedYear} • Drift {entry.driftScore.toFixed(2)} • Power{' '}
                        {entry.institutionalPower.toFixed(2)}
                      </p>
                      <p>{entry.movementNote}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No topography entries available.</p>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <h3 className="mb-2 text-sm font-semibold text-ink">Scholarly Ecosystem</h3>
            <p className="text-[11px] text-slate-500">
              Generated {new Date(scholarlyEcosystem.generatedAt).toLocaleString()}
            </p>

            <div className="mt-2 rounded-md border border-amber-100 bg-white p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Framework Clusters
              </p>
              {scholarlyEcosystem.frameworkClusters.length > 0 ? (
                <ul className="list-inside list-disc text-xs text-slate-700">
                  {scholarlyEcosystem.frameworkClusters.slice(0, 8).map((cluster) => (
                    <li key={`cluster-${cluster.framework}`}>
                      {cluster.framework}: {cluster.count}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No debate frameworks detected yet.</p>
              )}
            </div>

            <div className="mt-2 rounded-md border border-amber-100 bg-white p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Contested Links
              </p>
              {scholarlyEcosystem.contestedLinks.length > 0 ? (
                <ul className="list-inside list-disc text-xs text-slate-700">
                  {scholarlyEcosystem.contestedLinks.slice(0, 8).map((item) => (
                    <li key={`contested-${item.linkKey}`}>
                      {item.linkLabel}: {item.scholarCount} scholars
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No contested links with multiple scholars yet.</p>
              )}
            </div>

            <div className="mt-2 rounded-md border border-amber-100 bg-white p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Debate Timeline
              </p>
              {scholarlyEcosystem.timeline.length > 0 ? (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-slate-700">
                  {scholarlyEcosystem.timeline.slice(0, 14).map((event, index) => (
                    <li key={`eco-${event.year}-${event.scholar}-${index}`}>
                      <span className="font-semibold text-slate-900">{event.year}</span> {event.scholar} ({event.framework}) on {event.linkLabel}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No timeline events available.</p>
              )}
            </div>

            <div className="mt-2 rounded-md border border-amber-100 bg-white p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Personal Academic Genealogy
              </p>
              <p className="text-xs text-slate-700">{personalGenealogyReport.profileSummary}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Stances: {personalGenealogyReport.stanceCount} • Linked arguments:{' '}
                {personalGenealogyReport.connectedArguments}
              </p>
              {personalGenealogyReport.alignedFrameworks.length > 0 ? (
                <ul className="mt-1 list-inside list-disc text-xs text-slate-700">
                  {personalGenealogyReport.alignedFrameworks.slice(0, 6).map((entry) => (
                    <li key={`align-${entry.framework}`}>
                      {entry.framework}: net {entry.netAlignment.toFixed(2)} (S:{entry.support} Q:
                      {entry.qualified} O:{entry.oppose})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">
                  No stance tags yet. Set support/oppose/qualified in Scholarly Debate cards.
                </p>
              )}
              {personalGenealogyReport.faultLines.length > 0 ? (
                <ul className="mt-1 list-inside list-disc text-xs text-red-700">
                  {personalGenealogyReport.faultLines.map((entry) => (
                    <li key={`fault-${entry}`}>{entry}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
