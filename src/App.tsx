import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { CenterPanel } from './components/CenterPanel';
import { GeminiAccessGate } from './components/GeminiAccessGate';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { mockResearchResult } from './data/mockResearch';
import {
  enrichLinkOnDemand,
  enrichNodeOnDemand,
  generateCounterfactualOnDemand,
  generateLivingPublicationOnDemand,
  generateSummaryOnDemand,
  runStructuralPhase,
} from './lib/pipeline';
import { auditNodeCitations } from './lib/citationVerification';
import { buildConceptTopographyReport } from './lib/conceptTopography';
import { computeIntertextualityStats, statsToLinkMetrics } from './lib/intertextuality';
import { computePeerReviewGate, computeRevisionDiff, createBlindReviewPacket, createPeerReviewComment } from './lib/peerReview';
import { computePublicationSyncStatus } from './lib/publicationSync';
import { createLivingPublication } from './lib/publication';
import { computePersonalAcademicGenealogy } from './lib/personalGenealogy';
import { buildNotebookPromptContext, fetchNotebookCorpus } from './lib/notebooklmBridge';
import { buildOutlineProposal } from './lib/researchWorkflow';
import { buildNegativeScriptureIndex, applyHeuristicRuptureDiagnosticsToGraph } from './lib/ruptureDiagnostics';
import { buildScholarlyEcosystemReport } from './lib/scholarlyEcosystem';
import { computeTextualFluidity } from './lib/textualFluidity';
import {
  clearGeminiRuntime,
  configureGeminiRuntime,
  getGeminiRuntimeSnapshot,
  verifyGeminiRuntimeCredentials,
} from './lib/llmClient';
import type {
  ActivityLogEntry,
  ConceptTopographyReport,
  CounterfactualResult,
  CounterfactualScenarioId,
  IntertextualityStatsReport,
  Link,
  LivingPublication,
  NegativeScriptureIndex,
  Node,
  NotebookCorpus,
  OutlineProposal,
  PeerReviewGate,
  PeerReviewComment,
  PeerReviewCommentInput,
  PeerReviewPacket,
  PhaseKey,
  PublicationSyncStatus,
  ResearchNote,
  ResearchNoteKind,
  ResearchNoteTargetType,
  ResearchMethodologyProfile,
  ResearchResult,
  ScholarlyEcosystemReport,
  TextualFluidityReport,
  UserStance,
  UserStanceInput,
  PersonalAcademicGenealogyReport,
  RevisionDiffReport,
  VerificationResult,
} from './types';

const SUMMARY_PLACEHOLDER =
  'Open the Summary tab to generate the synthesis essay from the current graph state.';
const DEFAULT_METHOD_PROFILE: ResearchMethodologyProfile = {
  hermeneuticFrameworks: ['Historical-Critical', 'Literary'],
  canonicalAssumption: 'Expanded Canon',
  languagePhilosophy: 'Differance',
};
const DEFAULT_COUNTERFACTUAL_SCENARIO: CounterfactualScenarioId = 'matthew-hebrew-not-lxx';
const REQUIRED_HERMENEUTICS: ResearchMethodologyProfile['hermeneuticFrameworks'] = [
  'Historical-Critical',
  'Literary',
];

function normalizeMethodologyProfile(profile: ResearchMethodologyProfile): ResearchMethodologyProfile {
  return {
    ...profile,
    hermeneuticFrameworks: Array.from(
      new Set([...REQUIRED_HERMENEUTICS, ...(profile.hermeneuticFrameworks ?? [])]),
    ),
  };
}

function formatTime(date = new Date()): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function makeLogEntry(
  phase: PhaseKey,
  status: ActivityLogEntry['status'],
  message: string,
): ActivityLogEntry {
  return {
    id: `${phase}-${status}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    phase,
    status,
    message,
    timestamp: formatTime(),
  };
}

function linkKey(link: Pick<Link, 'source' | 'target' | 'type'>): string {
  return `${link.source}::${link.target}::${link.type}`;
}

function makeNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeNodePatch(
  node: Node,
  patch: {
    id: string;
    citations?: string[];
    linguisticAnalysis?: Node['linguisticAnalysis'];
    symptomaticAnalysis?: Node['symptomaticAnalysis'];
    manuscriptVariants?: Node['manuscriptVariants'];
    ruptureAnalysis?: Node['ruptureAnalysis'];
    conceptualTopography?: Node['conceptualTopography'];
    citationAudit?: Node['citationAudit'];
  },
): Node {
  if (node.id !== patch.id) {
    return node;
  }

  return {
    ...node,
    citations: patch.citations ?? node.citations,
    linguisticAnalysis: patch.linguisticAnalysis
      ? { ...node.linguisticAnalysis, ...patch.linguisticAnalysis }
      : node.linguisticAnalysis,
    symptomaticAnalysis: patch.symptomaticAnalysis
      ? { ...node.symptomaticAnalysis, ...patch.symptomaticAnalysis }
      : node.symptomaticAnalysis,
    manuscriptVariants: patch.manuscriptVariants ?? node.manuscriptVariants,
    ruptureAnalysis: patch.ruptureAnalysis
      ? { ...node.ruptureAnalysis, ...patch.ruptureAnalysis }
      : node.ruptureAnalysis,
    conceptualTopography: patch.conceptualTopography
      ? { ...node.conceptualTopography, ...patch.conceptualTopography }
      : node.conceptualTopography,
    citationAudit: patch.citationAudit ?? node.citationAudit,
  };
}

function mergeLinkPatch(
  link: Link,
  patch: {
    source: string;
    target: string;
    type: string;
    scholarlyDebate?: Link['scholarlyDebate'];
    methodologyTagging?: Link['methodologyTagging'];
    intertextualityMetrics?: Link['intertextualityMetrics'];
  },
): Link {
  if (linkKey(link) !== linkKey(patch)) {
    return link;
  }

  return {
    ...link,
    scholarlyDebate: patch.scholarlyDebate ?? link.scholarlyDebate,
    methodologyTagging: patch.methodologyTagging ?? link.methodologyTagging,
    intertextualityMetrics: patch.intertextualityMetrics ?? link.intertextualityMetrics,
  };
}

export default function App() {
  const initialGeminiRuntime = useMemo(() => getGeminiRuntimeSnapshot(), []);
  const [accessVerified, setAccessVerified] = useState(false);
  const [accessVerifying, setAccessVerifying] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [gateApiKey, setGateApiKey] = useState(initialGeminiRuntime.apiKey);
  const [gateModel, setGateModel] = useState(initialGeminiRuntime.model);
  const [gateRememberKey, setGateRememberKey] = useState(initialGeminiRuntime.keySource === 'localStorage');
  const [hasSavedLocalKey, setHasSavedLocalKey] = useState(initialGeminiRuntime.keySource === 'localStorage');
  const [providerLabel, setProviderLabel] = useState(`Gemini (${initialGeminiRuntime.model})`);

  const [query, setQuery] = useState(
    'The concept of Logos in John 1 and its genealogy from MT/LXX through STP literature.',
  );
  const [activeQuery, setActiveQuery] = useState(query);
  const [mode, setMode] = useState<'graph' | 'timeline' | 'topography'>('graph');
  const [rightTab, setRightTab] = useState<'detail' | 'summary' | 'lab'>('detail');

  const [structureLoading, setStructureLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [counterfactualLoading, setCounterfactualLoading] = useState(false);

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [result, setResult] = useState<ResearchResult>(mockResearchResult);
  const [verification, setVerification] = useState<VerificationResult | undefined>(undefined);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(mockResearchResult.nodes[0]?.id);
  const [selectedLinkId, setSelectedLinkId] = useState<string | undefined>();
  const [methodology, setMethodology] = useState<ResearchMethodologyProfile>(DEFAULT_METHOD_PROFILE);
  const [activeMethodology, setActiveMethodology] =
    useState<ResearchMethodologyProfile>(DEFAULT_METHOD_PROFILE);
  const [counterfactualScenario, setCounterfactualScenario] = useState<CounterfactualScenarioId>(
    DEFAULT_COUNTERFACTUAL_SCENARIO,
  );
  const [counterfactualByScenario, setCounterfactualByScenario] = useState<
    Partial<Record<CounterfactualScenarioId, CounterfactualResult>>
  >({});
  const [intertextualityReports, setIntertextualityReports] = useState<
    Record<string, IntertextualityStatsReport>
  >({});
  const [intertextualityLoading, setIntertextualityLoading] = useState(false);
  const [publication, setPublication] = useState<LivingPublication | undefined>();
  const [publicationLoading, setPublicationLoading] = useState(false);
  const [publicationBaselineResult, setPublicationBaselineResult] = useState<ResearchResult | undefined>();
  const [peerReviewPacket, setPeerReviewPacket] = useState<PeerReviewPacket | undefined>();
  const [peerReviewComments, setPeerReviewComments] = useState<PeerReviewComment[]>([]);
  const [peerReviewLoading, setPeerReviewLoading] = useState(false);
  const [researchNotes, setResearchNotes] = useState<ResearchNote[]>([]);
  const [userStances, setUserStances] = useState<UserStance[]>([]);
  const [notebookRef, setNotebookRef] = useState('');
  const [notebookCorpus, setNotebookCorpus] = useState<NotebookCorpus | undefined>();
  const [notebookSyncLoading, setNotebookSyncLoading] = useState(false);
  const [notebookSyncError, setNotebookSyncError] = useState<string | null>(null);
  const [pendingNoteKind, setPendingNoteKind] = useState<ResearchNoteKind>('observation');
  const [pendingNoteText, setPendingNoteText] = useState('');
  const [revisionBaseline, setRevisionBaseline] = useState<{ capturedAt: string; result: ResearchResult } | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  const [nodeLoaded, setNodeLoaded] = useState<Record<string, boolean>>({});
  const [linkLoaded, setLinkLoaded] = useState<Record<string, boolean>>({});
  const [summaryLoaded, setSummaryLoaded] = useState(true);

  const nodeInFlightRef = useRef(new Set<string>());
  const linkInFlightRef = useRef(new Set<string>());
  const summaryInFlightRef = useRef(false);
  const counterfactualInFlightRef = useRef(new Set<CounterfactualScenarioId>());

  const selectedNode = useMemo(
    () => result.nodes.find((node) => node.id === selectedNodeId),
    [result.nodes, selectedNodeId],
  );

  const selectedLink = useMemo(() => {
    if (!selectedLinkId) {
      return undefined;
    }

    return result.links.find((link) => linkKey(link) === selectedLinkId);
  }, [result.links, selectedLinkId]);

  const selectedIntertextualityReport = useMemo(() => {
    if (!selectedLinkId) {
      return undefined;
    }
    return intertextualityReports[selectedLinkId];
  }, [intertextualityReports, selectedLinkId]);

  const revisionDiff: RevisionDiffReport | undefined = useMemo(() => {
    if (!revisionBaseline) {
      return undefined;
    }
    return computeRevisionDiff(revisionBaseline, result);
  }, [revisionBaseline, result]);

  const negativeScriptureIndex: NegativeScriptureIndex = useMemo(
    () => buildNegativeScriptureIndex(result.nodes),
    [result.nodes],
  );

  const conceptTopographyReport: ConceptTopographyReport = useMemo(
    () => buildConceptTopographyReport(result.nodes, result.links),
    [result.nodes, result.links],
  );

  const scholarlyEcosystem: ScholarlyEcosystemReport = useMemo(
    () => buildScholarlyEcosystemReport(result.links),
    [result.links],
  );

  const selectedNodeTextualFluidity: TextualFluidityReport | undefined = useMemo(
    () => (selectedNode ? computeTextualFluidity(selectedNode) : undefined),
    [selectedNode],
  );
  const enrichedNodeCount = useMemo(
    () => Object.values(nodeLoaded).filter(Boolean).length,
    [nodeLoaded],
  );
  const enrichedLinkCount = useMemo(
    () => Object.values(linkLoaded).filter(Boolean).length,
    [linkLoaded],
  );

  const outlineProposal: OutlineProposal = useMemo(
    () => buildOutlineProposal(activeQuery, result, researchNotes),
    [activeQuery, result, researchNotes],
  );

  const publicationSyncStatus: PublicationSyncStatus = useMemo(
    () => computePublicationSyncStatus(publication, publicationBaselineResult, result),
    [publication, publicationBaselineResult, result],
  );

  const peerReviewGate: PeerReviewGate = useMemo(
    () => computePeerReviewGate(peerReviewComments),
    [peerReviewComments],
  );

  const personalGenealogyReport: PersonalAcademicGenealogyReport = useMemo(
    () => computePersonalAcademicGenealogy(userStances, researchNotes),
    [userStances, researchNotes],
  );
  const notebookPromptContext = useMemo(
    () => buildNotebookPromptContext(notebookCorpus),
    [notebookCorpus],
  );

  const appendLog = (phase: PhaseKey, status: 'running' | 'success' | 'error', message: string) => {
    setLogs((prev) => [...prev, makeLogEntry(phase, status, message)]);
  };

  async function auditGraphNodeCitations(nodes: Node[], queryText: string): Promise<Node[]> {
    appendLog('phase8-citation-audit', 'running', `Verifying ${nodes.length} node citation sets...`);
    const auditedNodes: Node[] = [];

    for (const node of nodes) {
      const audited = await auditNodeCitations(node, queryText);
      auditedNodes.push(audited);
    }

    const verifiedCount = auditedNodes.reduce((count, node) => count + (node.citations?.length ?? 0), 0);
    const rejectedCount = auditedNodes.reduce(
      (count, node) => count + (node.citationAudit?.rejected?.length ?? 0),
      0,
    );
    appendLog(
      'phase8-citation-audit',
      'success',
      `Citation audit complete: ${verifiedCount} verified, ${rejectedCount} rejected.`,
    );

    return applyHeuristicRuptureDiagnosticsToGraph(auditedNodes);
  }

  async function ensureNodeEnriched(
    nodeId: string,
    graphOverride?: { nodes: Node[]; links: Link[] },
    options?: { force?: boolean },
  ) {
    const force = options?.force === true;
    if ((!force && nodeLoaded[nodeId]) || nodeInFlightRef.current.has(nodeId)) {
      return;
    }

    const graph = graphOverride ?? { nodes: result.nodes, links: result.links };
    nodeInFlightRef.current.add(nodeId);
    setDetailLoading(true);

    try {
      const patch = await enrichNodeOnDemand(
        activeQuery,
        graph,
        nodeId,
        activeMethodology,
        appendLog,
        notebookPromptContext,
      );
      const hasDeepPatch = Boolean(
        patch?.linguisticAnalysis ||
          patch?.symptomaticAnalysis ||
          patch?.manuscriptVariants ||
          patch?.ruptureAnalysis ||
          patch?.conceptualTopography,
      );

      if (patch) {
        let patchForMerge: Parameters<typeof mergeNodePatch>[1] = patch;
        const baseNode = graph.nodes.find((entry) => entry.id === nodeId);
        if (baseNode) {
          const patchedNode: Node = mergeNodePatch(baseNode, patch);
          const auditedNodeRaw = await auditNodeCitations(patchedNode, activeQuery);
          const auditedNode = applyHeuristicRuptureDiagnosticsToGraph([auditedNodeRaw])[0];
          patchForMerge = {
            ...patch,
            citations: auditedNode.citations,
            citationAudit: auditedNode.citationAudit,
            ruptureAnalysis: auditedNode.ruptureAnalysis,
          };
        }

        setResult((prev) => ({
          ...prev,
          nodes: prev.nodes.map((node) => mergeNodePatch(node, patchForMerge)),
        }));
      }

      if (hasDeepPatch) {
        setNodeLoaded((prev) => ({ ...prev, [nodeId]: true }));
      } else {
        appendLog(
          'phase2-philological-enrichment',
          'running',
          'Node returned shallow payload; use Generate/Refresh Node Analysis to retry deep output.',
        );
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to enrich node.';
      setError(message);
    } finally {
      nodeInFlightRef.current.delete(nodeId);
      if (nodeInFlightRef.current.size === 0 && linkInFlightRef.current.size === 0) {
        setDetailLoading(false);
      }
    }
  }

  async function ensureLinkEnriched(
    selected: Pick<Link, 'source' | 'target' | 'type'>,
    options?: { force?: boolean },
  ) {
    const force = options?.force === true;
    const key = linkKey(selected);
    if ((!force && linkLoaded[key]) || linkInFlightRef.current.has(key)) {
      return;
    }

    const graph = { nodes: result.nodes, links: result.links };
    linkInFlightRef.current.add(key);
    setDetailLoading(true);

    try {
      const patch = await enrichLinkOnDemand(
        activeQuery,
        graph,
        selected,
        activeMethodology,
        appendLog,
        notebookPromptContext,
      );
      if (patch) {
        setResult((prev) => ({
          ...prev,
          links: prev.links.map((link) => mergeLinkPatch(link, patch)),
        }));
      }
      setLinkLoaded((prev) => ({ ...prev, [key]: true }));
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to enrich link.';
      setError(message);
    } finally {
      linkInFlightRef.current.delete(key);
      if (nodeInFlightRef.current.size === 0 && linkInFlightRef.current.size === 0) {
        setDetailLoading(false);
      }
    }
  }

  async function ensureSummaryGenerated(graphOverride?: { nodes: Node[]; links: Link[] }) {
    if (summaryLoaded || summaryInFlightRef.current) {
      return;
    }

    summaryInFlightRef.current = true;
    setSummaryLoading(true);

    try {
      const graph = graphOverride ?? { nodes: result.nodes, links: result.links };
      const summary = await generateSummaryOnDemand(
        activeQuery,
        graph,
        activeMethodology,
        appendLog,
        notebookPromptContext,
      );
      setResult((prev) => ({ ...prev, summary }));
      setSummaryLoaded(true);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to generate summary.';
      setError(message);
    } finally {
      summaryInFlightRef.current = false;
      setSummaryLoading(false);
    }
  }

  async function ensureCounterfactualGenerated(
    scenario: CounterfactualScenarioId,
    graphOverride?: { nodes: Node[]; links: Link[] },
  ) {
    if (counterfactualByScenario[scenario] || counterfactualInFlightRef.current.has(scenario)) {
      return;
    }

    const graph = graphOverride ?? { nodes: result.nodes, links: result.links };
    counterfactualInFlightRef.current.add(scenario);
    setCounterfactualLoading(true);

    try {
      const output = await generateCounterfactualOnDemand(
        activeQuery,
        graph,
        scenario,
        activeMethodology,
        appendLog,
        notebookPromptContext,
      );
      setCounterfactualByScenario((prev) => ({ ...prev, [scenario]: output }));
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : 'Failed to generate counterfactual analysis.';
      setError(message);
    } finally {
      counterfactualInFlightRef.current.delete(scenario);
      if (counterfactualInFlightRef.current.size === 0) {
        setCounterfactualLoading(false);
      }
    }
  }

  async function runIntertextualityTest() {
    if (!selectedLink) {
      return;
    }

    const key = linkKey(selectedLink);
    setIntertextualityLoading(true);
    appendLog('phase7-intertextuality-stats', 'running', `Computing statistics for ${selectedLink.label}...`);

    try {
      const report = await Promise.resolve().then(() =>
        computeIntertextualityStats({ nodes: result.nodes, links: result.links }, selectedLink, 500),
      );

      if (!report) {
        throw new Error('Could not compute intertextuality report for the selected link.');
      }

      setIntertextualityReports((prev) => ({ ...prev, [key]: report }));
      setResult((prev) => ({
        ...prev,
        links: prev.links.map((entry) =>
          linkKey(entry) === key
            ? {
                ...entry,
                intertextualityMetrics: statsToLinkMetrics(report),
              }
            : entry,
        ),
      }));

      appendLog(
        'phase7-intertextuality-stats',
        'success',
        `Statistical test completed (p=${report.pValue.toExponential(2)}).`,
      );
    } catch (statsError) {
      const message =
        statsError instanceof Error
          ? statsError.message
          : 'Failed to compute intertextuality statistics.';
      setError(message);
      appendLog('phase7-intertextuality-stats', 'error', message);
    } finally {
      setIntertextualityLoading(false);
    }
  }

  async function generateLivingPublication() {
    if (result.nodes.length === 0) {
      return;
    }

    setPublicationLoading(true);
    appendLog('phase9-living-publication', 'running', 'Generating living publication package...');
    try {
      const publicationMarkdown = await generateLivingPublicationOnDemand(
        activeQuery,
        { nodes: result.nodes, links: result.links },
        activeMethodology,
        appendLog,
        notebookPromptContext,
      );
      const built = await Promise.resolve().then(() =>
        createLivingPublication(activeQuery, result, publicationMarkdown),
      );
      setPublication(built);
      setPublicationBaselineResult(JSON.parse(JSON.stringify(result)) as ResearchResult);
      appendLog('phase9-living-publication', 'success', `Living publication generated (${built.versionLabel}).`);
    } catch (pubError) {
      const message =
        pubError instanceof Error ? pubError.message : 'Failed to generate living publication.';
      setError(message);
      appendLog('phase9-living-publication', 'error', message);
    } finally {
      setPublicationLoading(false);
    }
  }

  async function generateBlindReviewPacket() {
    if (!publication) {
      setError('Generate a living publication first before creating a blind review packet.');
      return;
    }

    setPeerReviewLoading(true);
    appendLog('phase10-peer-review', 'running', 'Creating blind review packet...');
    try {
      const packet = createBlindReviewPacket(publication, result);
      setPeerReviewPacket(packet);
      setRevisionBaseline({
        capturedAt: packet.createdAt,
        result: JSON.parse(JSON.stringify(result)) as ResearchResult,
      });
      setPeerReviewComments([]);
      appendLog('phase10-peer-review', 'success', `Blind review packet created (${packet.versionLabel}).`);
    } catch (reviewError) {
      const message =
        reviewError instanceof Error ? reviewError.message : 'Failed to generate blind review packet.';
      setError(message);
      appendLog('phase10-peer-review', 'error', message);
    } finally {
      setPeerReviewLoading(false);
    }
  }

  function addPeerReviewComment(input: PeerReviewCommentInput) {
    if (!input.comment.trim()) {
      return;
    }
    const comment = createPeerReviewComment(input);
    setPeerReviewComments((prev) => [comment, ...prev]);
    appendLog(
      'phase10-peer-review',
      'success',
      `Review comment added on ${input.targetType}:${input.targetId} (${input.severity}).`,
    );
  }

  function updatePeerReviewCommentStatus(commentId: string, status: PeerReviewComment['status']) {
    setPeerReviewComments((prev) =>
      prev.map((comment) => (comment.id === commentId ? { ...comment, status } : comment)),
    );
  }

  function addResearchNote() {
    const content = pendingNoteText.trim();
    if (!content) {
      return;
    }

    let targetType: ResearchNoteTargetType = 'global';
    let targetId = 'global';
    if (selectedNodeId) {
      targetType = 'node';
      targetId = selectedNodeId;
    } else if (selectedLink) {
      targetType = 'link';
      targetId = linkKey(selectedLink);
    }

    const note: ResearchNote = {
      id: makeNoteId(),
      createdAt: new Date().toISOString(),
      kind: pendingNoteKind,
      targetType,
      targetId,
      content,
    };

    setResearchNotes((prev) => [note, ...prev]);
    setPendingNoteText('');
    appendLog('phase9-living-publication', 'running', `Research note added (${note.kind}) on ${targetType}:${targetId}.`);
  }

  function deleteResearchNote(noteId: string) {
    setResearchNotes((prev) => prev.filter((note) => note.id !== noteId));
  }

  function upsertUserStance(input: UserStanceInput) {
    const id = `${input.targetLinkKey}::${input.scholar.trim().toLowerCase()}`;
    const updatedAt = new Date().toISOString();
    setUserStances((prev) => {
      const index = prev.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return [{ ...input, id, updatedAt }, ...prev];
      }
      const next = [...prev];
      next[index] = { ...next[index], ...input, updatedAt };
      return next;
    });
  }

  async function syncNotebookSources(): Promise<NotebookCorpus | undefined> {
    const ref = notebookRef.trim();
    if (!ref) {
      return undefined;
    }

    setNotebookSyncLoading(true);
    setNotebookSyncError(null);
    appendLog('phase0-notebook-sync', 'running', 'Syncing NotebookLM corpus...');
    try {
      const corpus = await fetchNotebookCorpus(ref);
      setNotebookCorpus(corpus);
      appendLog(
        'phase0-notebook-sync',
        'success',
        `Notebook sync complete: ${corpus.sourceCount} sources loaded.`,
      );
      return corpus;
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Notebook sync failed.';
      setNotebookSyncError(message);
      appendLog('phase0-notebook-sync', 'error', message);
      return undefined;
    } finally {
      setNotebookSyncLoading(false);
    }
  }

  function openCitationNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setSelectedLinkId(undefined);
    setRightTab('detail');
    void ensureNodeEnriched(nodeId);
  }

  function handleNodeAnalysisRegenerate() {
    if (!selectedNodeId) {
      return;
    }
    void ensureNodeEnriched(selectedNodeId, undefined, { force: true });
  }

  async function handleTrace() {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    setError(null);
    setLogs([]);
    setStructureLoading(true);
    const normalizedMethodology = normalizeMethodologyProfile(methodology);
    setMethodology(normalizedMethodology);
    setActiveMethodology(normalizedMethodology);
    setRightTab('detail');
    setResult({
      nodes: [],
      links: [],
      summary: SUMMARY_PLACEHOLDER,
    });
    setVerification(undefined);
    setSelectedNodeId(undefined);
    setSelectedLinkId(undefined);
    setCounterfactualByScenario({});
    setIntertextualityReports({});
    setIntertextualityLoading(false);
    setPublication(undefined);
    setPublicationLoading(false);
    setPublicationBaselineResult(undefined);
    setPeerReviewPacket(undefined);
    setPeerReviewComments([]);
    setPeerReviewLoading(false);
    setResearchNotes([]);
    setUserStances([]);
    setPendingNoteText('');
    setRevisionBaseline(undefined);
    counterfactualInFlightRef.current.clear();

    try {
      let traceExternalContext = notebookPromptContext;
      if (notebookRef.trim()) {
        const syncedCorpus = await syncNotebookSources();
        if (syncedCorpus) {
          traceExternalContext = buildNotebookPromptContext(syncedCorpus);
        }
      }

      setActiveQuery(trimmed);
      const structural = await runStructuralPhase(
        trimmed,
        normalizedMethodology,
        appendLog,
        traceExternalContext,
      );
      const auditedNodes = await auditGraphNodeCitations(structural.nodes, trimmed);

      setResult({
        nodes: auditedNodes,
        links: structural.links,
        summary: SUMMARY_PLACEHOLDER,
      });
      setVerification(undefined);
      setSelectedNodeId(auditedNodes[0]?.id);
      setSelectedLinkId(undefined);

      setNodeLoaded({});
      setLinkLoaded({});
      setSummaryLoaded(false);

      nodeInFlightRef.current.clear();
      linkInFlightRef.current.clear();
      summaryInFlightRef.current = false;
    } catch (pipelineError) {
      const message =
        pipelineError instanceof Error ? pipelineError.message : 'Unknown pipeline failure.';
      setError(message);
    } finally {
      setStructureLoading(false);
      setDetailLoading(false);
      setSummaryLoading(false);
      setCounterfactualLoading(false);
    }
  }

  const handleNodeSelect = (node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedLinkId(undefined);
    setRightTab('detail');
    void ensureNodeEnriched(node.id);
  };

  const handleLinkSelect = (link: Link) => {
    setSelectedLinkId(linkKey(link));
    setSelectedNodeId(undefined);
    setRightTab('detail');
    void ensureLinkEnriched(link);
  };

  const handleParallaxRegenerate = () => {
    if (!selectedLink) {
      return;
    }
    void ensureLinkEnriched(selectedLink, { force: true });
  };

  const handleTabChange = (tab: 'detail' | 'summary' | 'lab') => {
    setRightTab(tab);

    if (tab === 'summary') {
      void ensureSummaryGenerated();
      return;
    }

    if (tab === 'lab') {
      return;
    }

    if (selectedNodeId) {
      void ensureNodeEnriched(selectedNodeId);
      return;
    }

    if (selectedLink) {
      void ensureLinkEnriched(selectedLink);
    }
  };

  async function handleVerifyAccess() {
    const apiKey = gateApiKey.trim();
    if (!apiKey) {
      setAccessError('Please provide your Gemini API key.');
      return;
    }

    setAccessVerifying(true);
    setAccessError(null);

    try {
      const verification = await verifyGeminiRuntimeCredentials(apiKey, gateModel);
      configureGeminiRuntime({
        apiKey,
        model: verification.model,
        persist: gateRememberKey,
      });
      setGateModel(verification.model);
      setProviderLabel(verification.providerLabel);
      setHasSavedLocalKey(gateRememberKey);
      setAccessVerified(true);
    } catch (verifyError) {
      const message =
        verifyError instanceof Error ? verifyError.message : 'Failed to verify Gemini API key.';
      setAccessError(message);
    } finally {
      setAccessVerifying(false);
    }
  }

  function handleForgetSavedKey() {
    clearGeminiRuntime({ clearPersisted: true });
    setGateApiKey('');
    setGateRememberKey(false);
    setHasSavedLocalKey(false);
    setAccessError(null);
  }

  function handleChangeApiKey() {
    setAccessVerified(false);
    setAccessError(null);
  }

  if (!accessVerified) {
    return (
      <GeminiAccessGate
        apiKey={gateApiKey}
        model={gateModel}
        rememberKey={gateRememberKey}
        loading={accessVerifying}
        error={accessError}
        hasSavedKey={hasSavedLocalKey}
        onApiKeyChange={setGateApiKey}
        onModelChange={setGateModel}
        onRememberKeyChange={setGateRememberKey}
        onVerify={handleVerifyAccess}
        onForgetSavedKey={handleForgetSavedKey}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff5dc_0%,_#f1e8d5_45%,_#e6dcc9_100%)] text-ink xl:overflow-hidden">
      <div className="flex flex-col xl:h-screen xl:flex-row">
        <LeftPanel
          query={query}
          onQueryChange={setQuery}
          methodology={methodology}
          onMethodologyChange={setMethodology}
          onTrace={handleTrace}
          loading={structureLoading}
          logs={logs}
          notebookRef={notebookRef}
          onNotebookRefChange={setNotebookRef}
          onNotebookSync={syncNotebookSources}
          notebookSyncLoading={notebookSyncLoading}
          notebookCorpus={notebookCorpus}
          notebookSyncError={notebookSyncError}
          providerLabel={providerLabel}
          onChangeAccessKey={handleChangeApiKey}
        />

        <CenterPanel
          mode={mode}
          onModeChange={setMode}
          nodes={result.nodes}
          links={result.links}
          conceptTopographyReport={conceptTopographyReport}
          loading={structureLoading}
          selectedNodeId={selectedNodeId}
          selectedLinkId={selectedLinkId}
          onNodeSelect={handleNodeSelect}
          onLinkSelect={handleLinkSelect}
        />

        <RightPanel
          node={selectedNode}
          link={selectedLink}
          summary={result.summary}
          verification={verification}
          detailLoading={detailLoading}
          onRegenerateNodeAnalysis={handleNodeAnalysisRegenerate}
          summaryLoading={summaryLoading}
          counterfactualLoading={counterfactualLoading}
          counterfactualScenario={counterfactualScenario}
          counterfactualResult={counterfactualByScenario[counterfactualScenario]}
          onCounterfactualScenarioChange={setCounterfactualScenario}
          onCounterfactualRun={() => void ensureCounterfactualGenerated(counterfactualScenario)}
          intertextualityReport={selectedIntertextualityReport}
          intertextualityLoading={intertextualityLoading}
          onRunIntertextualityTest={() => void runIntertextualityTest()}
          onRegenerateParallax={handleParallaxRegenerate}
          negativeScriptureIndex={negativeScriptureIndex}
          conceptTopographyReport={conceptTopographyReport}
          scholarlyEcosystem={scholarlyEcosystem}
          textualFluidityReport={selectedNodeTextualFluidity}
          outlineProposal={outlineProposal}
          publicationSyncStatus={publicationSyncStatus}
          researchNotes={researchNotes}
          pendingNoteKind={pendingNoteKind}
          pendingNoteText={pendingNoteText}
          onPendingNoteKindChange={setPendingNoteKind}
          onPendingNoteTextChange={setPendingNoteText}
          onAddResearchNote={addResearchNote}
          onDeleteResearchNote={deleteResearchNote}
          userStances={userStances}
          personalGenealogyReport={personalGenealogyReport}
          onUpsertUserStance={upsertUserStance}
          publication={publication}
          publicationLoading={publicationLoading}
          onGeneratePublication={() => void generateLivingPublication()}
          onOpenPublicationNode={openCitationNode}
          peerReviewPacket={peerReviewPacket}
          peerReviewComments={peerReviewComments}
          peerReviewGate={peerReviewGate}
          peerReviewLoading={peerReviewLoading}
          revisionDiff={revisionDiff}
          graphNodeCount={result.nodes.length}
          graphLinkCount={result.links.length}
          enrichedNodeCount={enrichedNodeCount}
          enrichedLinkCount={enrichedLinkCount}
          onGenerateBlindReviewPacket={() => void generateBlindReviewPacket()}
          onAddPeerReviewComment={addPeerReviewComment}
          onUpdatePeerReviewCommentStatus={updatePeerReviewCommentStatus}
          tab={rightTab}
          onTabChange={handleTabChange}
        />
      </div>

      <AnimatePresence>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-scholar"
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
