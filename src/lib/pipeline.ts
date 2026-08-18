import type {
  AppLanguage,
  CounterfactualResult,
  CounterfactualScenarioId,
  Link,
  ManuscriptPeerReview,
  ManuscriptPeerReviewRequest,
  Node,
  PhaseKey,
  ResearchMethodologyProfile,
  ResearchResult,
  VerificationResult,
} from '../types';
import { generateJson, generateText, getProviderLabel } from './llmClient';
import { isZhHant } from './i18n';
import { inferChronologyFromNode } from './chronology';
import {
  normalizeCounterfactualPayload,
  normalizeManuscriptPeerReviewPayload,
  normalizePublicationPayload,
  normalizeSingleLinkPayload,
  normalizeSingleNodePayload,
  normalizeStructuralPayload,
  normalizeSummaryPayload,
  normalizeVerificationPayload,
} from './normalizeResearch';
import {
  counterfactualPrompt,
  linkDebatePrompt,
  manuscriptPeerReviewPrompt,
  nodeEnrichmentPrompt,
  phase1PromptWithContext,
  publicationMarkdownPrompt,
  publicationPrompt,
  summaryPrompt,
  verificationPrompt,
} from './pipelinePrompts';
import { buildHeuristicNodeEnrichment, hasDeepNodePatch } from './nodeHeuristics';
import {
  getRecognizedNodeCitations,
  getRetainedNodeCitations,
  getVerifiedNodeCitations,
} from './citationVerification';

interface Logger {
  (phase: PhaseKey, status: 'running' | 'success' | 'error', message: string): void;
}

function linkId(link: Pick<Link, 'source' | 'target' | 'type'>): string {
  return `${link.source}::${link.target}::${link.type}`;
}

const MAX_MANUSCRIPT_REVIEW_CHARS = 50000;

function manuscriptReviewId(title: string, manuscript: string, generatedAt: string): string {
  let hash = 2166136261;
  const seed = `${title}\n${manuscript.length}\n${generatedAt}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `manuscript-review-${(hash >>> 0).toString(16)}`;
}

function collectVerifiedCitations(graph: { nodes: Node[]; links: Link[] }): string[] {
  return Array.from(
    new Set(
      graph.nodes
        .flatMap((node) => getVerifiedNodeCitations(node))
        .map((citation) => citation.trim())
        .filter(Boolean),
    ),
  );
}

function collectProvisionalCitations(graph: { nodes: Node[]; links: Link[] }): Array<{
  citation: string;
  status: 'recognized' | 'retained';
  note: string;
}> {
  const seen = new Set<string>();
  const entries: Array<{ citation: string; status: 'recognized' | 'retained'; note: string }> = [];

  for (const node of graph.nodes) {
    for (const entry of getRecognizedNodeCitations(node)) {
      const key = entry.citation.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        entries.push({ citation: entry.citation, status: 'recognized', note: entry.reason });
      }
    }
    for (const entry of getRetainedNodeCitations(node)) {
      const key = entry.citation.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        entries.push({ citation: entry.citation, status: 'retained', note: entry.rationale });
      }
    }
  }

  return entries;
}

function referenceTaggedBibliography(citations: string[]): string {
  if (citations.length === 0) {
    return '- [R0] No verified citation available';
  }
  return citations.map((citation, index) => `- [R${index + 1}] ${citation}`).join('\n');
}

function provisionalCitationAppendix(
  markdown: string,
  graph: { nodes: Node[]; links: Link[] },
  language: AppLanguage,
): string {
  const entries = collectProvisionalCitations(graph);
  if (entries.length === 0) {
    return markdown;
  }

  const heading = isZhHant(language)
    ? '## 待補核來源（不可視為已驗證書目）'
    : '## Sources Retained Pending Verification (Not Verified Bibliography)';
  const warning = isZhHant(language)
    ? '下列項目因可辨識的專門縮寫或研究者保留理由而留在研究脈絡中；它們不可作為已核實證據，發表前須補足定位與外部核驗。'
    : 'The following entries remain in the research context because they are recognized specialist abbreviations or were retained by the researcher; they are not verified evidence and require a locator plus external review before publication.';
  const lines = entries.map((entry) => {
    const label = entry.status === 'recognized'
      ? (isZhHant(language) ? '可辨識縮寫' : 'Recognized abbreviation')
      : (isZhHant(language) ? '研究者保留' : 'Researcher-retained');
    return `- ${entry.citation} [${label}]: ${entry.note}`;
  });

  return `${markdown}\n\n${heading}\n${warning}\n${lines.join('\n')}`;
}

function ensureStructuredSummary(summary: string, language: AppLanguage): string {
  if (/^#\s+/m.test(summary) && /^##\s+/m.test(summary)) {
    return summary;
  }

  if (isZhHant(language)) {
    return [
      '# 研究檔案',
      '',
      '## 摘要',
      summary.trim(),
      '',
      '## 系譜演進路徑',
      '模型未回傳完整分節標題；以上保留原始摘要內容。',
    ].join('\n');
  }

  return [
    '# Research Dossier',
    '',
    '## Abstract',
    summary.trim(),
    '',
    '## Genealogical Trajectory',
    'No section heading was returned by the model. The abstract above preserves the generated content.',
  ].join('\n');
}

function withDeterministicBibliography(
  summary: string,
  citations: string[],
  language: AppLanguage,
): string {
  const normalized = summary.trim();
  const bibliographyHeadingPattern = isZhHant(language)
    ? /^##\s+參考書目\b/im
    : /^##\s+Bibliography\b/im;
  const systemHeading = isZhHant(language)
    ? '## 參考書目（僅限已驗證來源，系統附加）'
    : '## Bibliography (Verified Sources Only, System-Appended)';
  const entries =
    citations.length > 0
      ? citations.map((citation) => `- ${citation}`).join('\n')
      : isZhHant(language)
        ? '- 無可用的已驗證引文'
        : '- No verified citation available';

  if (bibliographyHeadingPattern.test(normalized)) {
    return `${normalized}\n\n${systemHeading}\n${entries}`;
  }

  const heading = isZhHant(language)
    ? '## 參考書目（僅限已驗證來源）'
    : '## Bibliography (Verified Sources Only)';
  return `${normalized}\n\n${heading}\n${entries}`;
}

function ensureStructuredPublication(markdown: string, language: AppLanguage): string {
  if (/^#\s+/m.test(markdown) && /^##\s+/m.test(markdown)) {
    return markdown;
  }

  if (isZhHant(language)) {
    return [
      '# 動態出版草稿',
      '',
      '## 摘要',
      markdown.trim(),
      '',
      '## 概念系譜重建',
      '模型未回傳完整分節標題；以上保留原始生成內容。',
    ].join('\n');
  }

  return [
    '# Living Publication Draft',
    '',
    '## Abstract',
    markdown.trim(),
    '',
    '## Genealogical Reconstruction',
    'No section heading was returned by the model. The abstract above preserves generated content.',
  ].join('\n');
}

function withLockedPublicationBibliography(
  markdown: string,
  citations: string[],
  language: AppLanguage,
): string {
  const normalized = markdown.trim();
  const systemHeading = isZhHant(language)
    ? '## 參考書目（僅限已驗證來源，系統鎖定）'
    : '## Bibliography (Verified Sources Only, System Locked)';
  const entries = referenceTaggedBibliography(citations);
  return `${normalized}\n\n${systemHeading}\n${entries}`;
}

function buildVerificationNotice(graph: { nodes: Node[]; links: Link[] }, language: AppLanguage): string {
  const zh = isZhHant(language);
  const nodesWithoutCitations = graph.nodes.filter((node) => getVerifiedNodeCitations(node).length === 0);
  const rejected = graph.nodes.flatMap((node) =>
    (node.citationAudit?.rejected ?? []).map((entry) => `${node.id}: ${entry.citation} (${entry.reason})`),
  );
  const provisional = collectProvisionalCitations(graph);
  const verifiedCount = graph.nodes.reduce(
    (sum, node) => sum + getVerifiedNodeCitations(node).length,
    0,
  );
  const lowDating = graph.nodes
    .map((node) => ({ node, dating: inferChronologyFromNode(node) }))
    .filter((entry) => entry.dating.confidence === 'low');

  const lines: string[] = [];
  if (zh) {
    lines.push('## 驗證與風險提示');
    lines.push(
      `- 已驗證引文總數：${verifiedCount}。`,
    );
    lines.push(`- 無引文節點：${nodesWithoutCitations.length}。`);
    lines.push(`- 待補核引文：${rejected.length}。`);
    lines.push(`- 已保留待核來源：${provisional.length}。`);
    lines.push(`- 低可信度年代估值節點：${lowDating.length}。`);
    if (rejected.length > 0) {
      lines.push('- 以下引文尚未通過驗證，請勿視為確證：');
      for (const item of rejected.slice(0, 8)) {
        lines.push(`  - ${item}`);
      }
      if (rejected.length > 8) {
        lines.push(`  - 另有 ${rejected.length - 8} 筆未列出。`);
      }
    }
    if (lowDating.length > 0) {
      lines.push('- 以下節點年代僅為粗略推定，請以專門文獻復核：');
      for (const entry of lowDating.slice(0, 8)) {
        lines.push(`  - ${entry.node.label}: ${entry.dating.anchor}`);
      }
      if (lowDating.length > 8) {
        lines.push(`  - 另有 ${lowDating.length - 8} 個節點未列出。`);
      }
    }
    lines.push('- 若無法外部核驗，相關敘述僅可視為研究假設，不可視為定論。');
    return lines.join('\n');
  }

  lines.push('## Verification And Risk Notice');
  lines.push(
    `- Total verified citations: ${verifiedCount}.`,
  );
  lines.push(`- Nodes without citations: ${nodesWithoutCitations.length}.`);
  lines.push(`- Citations needing review: ${rejected.length}.`);
  lines.push(`- Sources retained pending verification: ${provisional.length}.`);
  lines.push(`- Nodes with low-confidence chronology estimates: ${lowDating.length}.`);
  if (rejected.length > 0) {
    lines.push('- The following citations remain unverified and should be treated as research leads, not evidence:');
    for (const item of rejected.slice(0, 8)) {
      lines.push(`  - ${item}`);
    }
    if (rejected.length > 8) {
      lines.push(`  - Plus ${rejected.length - 8} additional rejected items.`);
    }
  }
  if (lowDating.length > 0) {
    lines.push('- The following chronology anchors are low-confidence and require specialist review:');
    for (const entry of lowDating.slice(0, 8)) {
      lines.push(`  - ${entry.node.label}: ${entry.dating.anchor}`);
    }
    if (lowDating.length > 8) {
      lines.push(`  - Plus ${lowDating.length - 8} additional low-confidence nodes.`);
    }
  }
  lines.push('- Any claim lacking external confirmation should be treated as a research hypothesis.');
  return lines.join('\n');
}

function extractMarkdownText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function isLikelyJsonEnvelopeFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('json') ||
    message.includes('unexpected token') ||
    message.includes('unterminated') ||
    message.includes('end of json') ||
    message.includes('parse')
  );
}

function withLoggedFailure(error: unknown, phase: PhaseKey, log: Logger): never {
  const message = error instanceof Error ? error.message : 'Unexpected pipeline failure. Please try again.';
  log(phase, 'error', message);
  throw error;
}

export async function runStructuralPhase(
  query: string,
  profile: ResearchMethodologyProfile,
  language: AppLanguage,
  log: Logger,
  externalContext?: string,
): Promise<{ nodes: Node[]; links: Link[] }> {
  try {
    log(
      'phase1-structural-mapping',
      'running',
      `Constructing structural graph skeleton with ${getProviderLabel()}...`,
    );

    const raw = await generateJson<unknown>(
      phase1PromptWithContext(query, profile, language, externalContext),
      (attempt, waitMs) => {
      log(
        'phase1-structural-mapping',
        'running',
        `Rate limit detected. Retry ${attempt} in ${Math.round(waitMs / 1000)}s...`,
      );
      },
    );

    const normalized = normalizeStructuralPayload(raw);
    log(
      'phase1-structural-mapping',
      'success',
      `Captured ${normalized.nodes.length} nodes and ${normalized.links.length} links.`,
    );

    const sourceCounts = normalized.nodes.reduce<Record<string, number>>((acc, node) => {
      acc[node.source] = (acc[node.source] ?? 0) + 1;
      return acc;
    }, {});
    log(
      'phase1-structural-mapping',
      'running',
      `Source distribution: ANE=${sourceCounts.ANE ?? 0}, OT=${sourceCounts.OT ?? 0}, STP=${sourceCounts.STP ?? 0}, NT=${sourceCounts.NT ?? 0}, Hellenistic=${sourceCounts.Hellenistic ?? 0}, Manuscript=${sourceCounts.Manuscript ?? 0}.`,
    );

    if (normalized.links.length === 0) {
      log(
        'phase1-structural-mapping',
        'running',
        'No valid links were parsed from model output; retrying the trace may restore edge connectivity.',
      );
    }

    for (const note of normalized.notes) {
      log('phase1-structural-mapping', 'running', note);
    }

    return {
      nodes: normalized.nodes,
      links: normalized.links,
    };
  } catch (error) {
    return withLoggedFailure(error, 'phase1-structural-mapping', log);
  }
}

export async function enrichNodeOnDemand(
  query: string,
  graph: { nodes: Node[]; links: Link[] },
  nodeId: string,
  profile: ResearchMethodologyProfile,
  language: AppLanguage,
  log: Logger,
  externalContext?: string,
): Promise<{
  id: string;
  citations?: string[];
  linguisticAnalysis?: Node['linguisticAnalysis'];
  symptomaticAnalysis?: Node['symptomaticAnalysis'];
  manuscriptVariants?: Node['manuscriptVariants'];
  ruptureAnalysis?: Node['ruptureAnalysis'];
  conceptualTopography?: Node['conceptualTopography'];
} | null> {
  const node = graph.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`Unknown node: ${nodeId}`);
  }

  try {
    log('phase2-philological-enrichment', 'running', `Enriching node ${node.label}...`);
    const raw = await generateJson<unknown>(
      nodeEnrichmentPrompt(query, node, graph, profile, language, externalContext),
      (attempt, waitMs) => {
        log(
          'phase2-philological-enrichment',
          'running',
          `Rate limit detected. Retry ${attempt} in ${Math.round(waitMs / 1000)}s...`,
        );
      },
    );

    let patch = normalizeSingleNodePayload(raw, nodeId);
    if (!hasDeepNodePatch(patch)) {
      patch = buildHeuristicNodeEnrichment(node);
      log(
        'phase2-philological-enrichment',
        'running',
        `Model returned shallow payload for ${node.label}; applied local heuristic baseline enrichment.`,
      );
    }
    log(
      'phase2-philological-enrichment',
      'success',
      patch ? `Node ${node.label} enriched.` : `Node ${node.label} returned minimal enrichment.`,
    );

    return patch;
  } catch (error) {
    return withLoggedFailure(error, 'phase2-philological-enrichment', log);
  }
}

export async function enrichLinkOnDemand(
  query: string,
  graph: { nodes: Node[]; links: Link[] },
  selected: Pick<Link, 'source' | 'target' | 'type'>,
  profile: ResearchMethodologyProfile,
  language: AppLanguage,
  log: Logger,
  externalContext?: string,
): Promise<{
  source: string;
  target: string;
  type: string;
  scholarlyDebate?: Link['scholarlyDebate'];
  methodologyTagging?: Link['methodologyTagging'];
  intertextualityMetrics?: Link['intertextualityMetrics'];
} | null> {
  const link = graph.links.find((entry) => linkId(entry) === linkId(selected));
  if (!link) {
    throw new Error(`Unknown link: ${linkId(selected)}`);
  }

  try {
    log('phase3-academic-rigor', 'running', `Enriching debate for ${link.label}...`);
    const raw = await generateJson<unknown>(
      linkDebatePrompt(query, link, graph, profile, language, externalContext),
      (attempt, waitMs) => {
      log(
        'phase3-academic-rigor',
        'running',
        `Rate limit detected. Retry ${attempt} in ${Math.round(waitMs / 1000)}s...`,
      );
      },
    );

    const patch = normalizeSingleLinkPayload(raw, selected);
    log(
      'phase3-academic-rigor',
      'success',
      patch ? `Debate layer generated for ${link.label}.` : `No additional debate returned for ${link.label}.`,
    );

    return patch;
  } catch (error) {
    return withLoggedFailure(error, 'phase3-academic-rigor', log);
  }
}

export async function generateSummaryOnDemand(
  query: string,
  graph: { nodes: Node[]; links: Link[] },
  profile: ResearchMethodologyProfile,
  language: AppLanguage,
  log: Logger,
  externalContext?: string,
): Promise<string> {
  try {
    log('phase4-synthesis-summary', 'running', 'Generating on-demand summary...');
    const raw = await generateJson<unknown>(
      summaryPrompt(query, graph, profile, language, externalContext),
      (attempt, waitMs) => {
      log(
        'phase4-synthesis-summary',
        'running',
        `Rate limit detected. Retry ${attempt} in ${Math.round(waitMs / 1000)}s...`,
      );
      },
    );

    const summary = normalizeSummaryPayload(raw);
    const structured = ensureStructuredSummary(summary, language);
    const withBibliography = withDeterministicBibliography(
      structured,
      collectVerifiedCitations(graph),
      language,
    );
    const withProvisionalSources = provisionalCitationAppendix(withBibliography, graph, language);
    const withNotice = `${withProvisionalSources}\n\n${buildVerificationNotice(graph, language)}`;
    log('phase4-synthesis-summary', 'success', 'Summary generated.');
    return withNotice;
  } catch (error) {
    return withLoggedFailure(error, 'phase4-synthesis-summary', log);
  }
}

export async function generateCounterfactualOnDemand(
  query: string,
  graph: { nodes: Node[]; links: Link[] },
  scenario: CounterfactualScenarioId,
  profile: ResearchMethodologyProfile,
  language: AppLanguage,
  log: Logger,
  externalContext?: string,
): Promise<CounterfactualResult> {
  try {
    log('phase6-counterfactual-lab', 'running', `Running counterfactual scenario: ${scenario}...`);
    const raw = await generateJson<unknown>(
      counterfactualPrompt(query, graph, scenario, profile, language, externalContext),
      (attempt, waitMs) => {
        log(
          'phase6-counterfactual-lab',
          'running',
          `Rate limit detected. Retry ${attempt} in ${Math.round(waitMs / 1000)}s...`,
        );
      },
    );

    const normalized = normalizeCounterfactualPayload(raw, scenario);
    log('phase6-counterfactual-lab', 'success', 'Counterfactual simulation generated.');
    return normalized;
  } catch (error) {
    return withLoggedFailure(error, 'phase6-counterfactual-lab', log);
  }
}

export async function generateLivingPublicationOnDemand(
  query: string,
  graph: { nodes: Node[]; links: Link[] },
  profile: ResearchMethodologyProfile,
  language: AppLanguage,
  log: Logger,
  externalContext?: string,
): Promise<string> {
  try {
    log('phase9-living-publication', 'running', 'Generating publication-grade living draft...');
    let draft = '';

    try {
      const raw = await generateJson<unknown>(
        publicationPrompt(query, graph, profile, language, externalContext),
        (attempt, waitMs) => {
          log(
            'phase9-living-publication',
            'running',
            `Rate limit detected. Retry ${attempt} in ${Math.round(waitMs / 1000)}s...`,
          );
        },
      );
      draft = normalizePublicationPayload(raw);
    } catch (error) {
      if (!isLikelyJsonEnvelopeFailure(error)) {
        throw error;
      }

      log(
        'phase9-living-publication',
        'running',
        'JSON envelope failed on long publication draft. Retrying in plain-markdown fallback mode...',
      );

      const fallbackText = await generateText(
        publicationMarkdownPrompt(query, graph, profile, language, externalContext),
        (attempt, waitMs) => {
          log(
            'phase9-living-publication',
            'running',
            `Rate limit detected. Retry ${attempt} in ${Math.round(waitMs / 1000)}s...`,
          );
        },
      );
      draft = extractMarkdownText(fallbackText);
    }

    const structured = ensureStructuredPublication(draft, language);
    const locked = withLockedPublicationBibliography(
      structured,
      collectVerifiedCitations(graph),
      language,
    );
    const withProvisionalSources = provisionalCitationAppendix(locked, graph, language);
    const withNotice = `${withProvisionalSources}\n\n${buildVerificationNotice(graph, language)}`;
    log('phase9-living-publication', 'success', 'Publication-grade draft generated.');
    return withNotice;
  } catch (error) {
    return withLoggedFailure(error, 'phase9-living-publication', log);
  }
}

function applyCitationFixes(result: ResearchResult, verification: VerificationResult): ResearchResult {
  if (verification.status !== 'corrected' || !verification.citationFixes?.length) {
    return result;
  }

  const citationByNode = new Map(
    verification.citationFixes
      .filter((fix) => typeof fix.nodeId === 'string')
      .map((fix) => [fix.nodeId as string, fix.citations]),
  );

  const nodes = result.nodes.map((node) => ({
    ...node,
    citations: citationByNode.get(node.id) ?? node.citations,
  }));

  return {
    ...result,
    nodes,
  };
}

export async function verifyResearchOnDemand(
  result: ResearchResult,
  log: Logger,
): Promise<{ verification: VerificationResult; correctedResult: ResearchResult }> {
  try {
    log('phase5-verification', 'running', 'Peer-reviewing citations and claims...');
    const raw = await generateJson<unknown>(verificationPrompt(result), (attempt, waitMs) => {
      log(
        'phase5-verification',
        'running',
        `Rate limit detected. Retry ${attempt} in ${Math.round(waitMs / 1000)}s...`,
      );
    });

    const verification = normalizeVerificationPayload(raw);
    const correctedResult = applyCitationFixes(result, verification);

    log(
      'phase5-verification',
      'success',
      verification.status === 'verified'
        ? 'Citation verification passed.'
        : 'Citations corrected based on peer-review pass.',
    );

    return { verification, correctedResult };
  } catch (error) {
    return withLoggedFailure(error, 'phase5-verification', log);
  }
}

export async function generateManuscriptPeerReviewOnDemand(
  request: ManuscriptPeerReviewRequest,
  log: Logger,
): Promise<ManuscriptPeerReview> {
  const title = request.title.trim() || (request.outputLanguage === 'zh-Hant' ? '未命名稿件' : 'Untitled manuscript');
  const manuscript = request.manuscript.trim();

  if (!manuscript) {
    throw new Error(
      request.outputLanguage === 'zh-Hant'
        ? '請先貼上待審閱的稿件內容。'
        : 'Paste manuscript text before starting peer review.',
    );
  }

  if (manuscript.length > MAX_MANUSCRIPT_REVIEW_CHARS) {
    throw new Error(
      request.outputLanguage === 'zh-Hant'
        ? '稿件超出單次審閱長度上限。請按章節分拆後再審閱，避免模型略讀或截斷。'
        : 'The manuscript exceeds the single-review length limit. Review it by section to avoid truncation or shallow assessment.',
    );
  }

  try {
    log(
      'phase10-peer-review',
      'running',
      request.outputLanguage === 'zh-Hant'
        ? '正在以嚴格中文學術審稿標準檢視稿件…'
        : 'Reviewing manuscript with a strict academic peer-review standard...',
    );
    const raw = await generateJson<unknown>(
      manuscriptPeerReviewPrompt(title, manuscript, request.outputLanguage),
      (attempt, waitMs) => {
        log(
          'phase10-peer-review',
          'running',
          request.outputLanguage === 'zh-Hant'
            ? `遇到速率限制；將於 ${Math.round(waitMs / 1000)} 秒後進行第 ${attempt} 次重試。`
            : `Rate limit detected. Retry ${attempt} in ${Math.round(waitMs / 1000)}s...`,
        );
      },
    );

    const generatedAt = new Date().toISOString();
    const normalized = normalizeManuscriptPeerReviewPayload(raw, request.outputLanguage);
    const review: ManuscriptPeerReview = {
      id: manuscriptReviewId(title, manuscript, generatedAt),
      title,
      source: request.source,
      outputLanguage: request.outputLanguage,
      generatedAt,
      ...normalized,
    };
    log(
      'phase10-peer-review',
      'success',
      request.outputLanguage === 'zh-Hant'
        ? `嚴格審稿完成：${review.recommendation}。`
        : `Strict peer review complete: ${review.recommendation}.`,
    );
    return review;
  } catch (error) {
    return withLoggedFailure(error, 'phase10-peer-review', log);
  }
}
