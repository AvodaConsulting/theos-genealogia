import type {
  AppLanguage,
  DigitalHermeneuticsModule,
  DigitalHermeneuticsReport,
  FrameworkModuleState,
  LivingPublication,
  NotebookCorpus,
  OutlineProposal,
  PeerReviewGate,
  PeerReviewPacket,
  PersonalAcademicGenealogyReport,
  PublicationSyncStatus,
  ResearchNote,
  ResearchResult,
  ScholarlyEcosystemReport,
  VerificationResult,
} from '../types';

interface BuildDigitalHermeneuticsReportInput {
  language: AppLanguage;
  result: ResearchResult;
  summaryLoaded: boolean;
  notebookCorpus?: NotebookCorpus;
  verification?: VerificationResult;
  publication?: LivingPublication;
  publicationSyncStatus: PublicationSyncStatus;
  peerReviewGate: PeerReviewGate;
  peerReviewPacket?: PeerReviewPacket;
  scholarlyEcosystem: ScholarlyEcosystemReport;
  researchNotes: ResearchNote[];
  personalGenealogyReport: PersonalAcademicGenealogyReport;
  outlineProposal: OutlineProposal;
  enrichedNodeCount: number;
  enrichedLinkCount: number;
}

function uniqueGraphCitations(result: ResearchResult): number {
  return new Set(
    result.nodes
      .flatMap((node) => node.citations ?? [])
      .map((citation) => citation.trim())
      .filter(Boolean),
  ).size;
}

function verifiedCitationCount(result: ResearchResult): number {
  return result.nodes.reduce((count, node) => count + (node.citationAudit?.verified.length ?? 0), 0);
}

function state(documented: boolean, partial: boolean): FrameworkModuleState {
  if (documented) {
    return 'evidenced';
  }
  return partial ? 'partial' : 'not-demonstrated';
}

function module(
  id: string,
  label: string,
  moduleState: FrameworkModuleState,
  summary: string,
  limitation: string,
  nextStep: string,
  metrics: DigitalHermeneuticsModule['metrics'],
): DigitalHermeneuticsModule {
  return { id, label, state: moduleState, summary, limitation, nextStep, metrics };
}

export function buildDigitalHermeneuticsReport({
  language,
  result,
  summaryLoaded,
  notebookCorpus,
  verification,
  publication,
  publicationSyncStatus,
  peerReviewGate,
  peerReviewPacket,
  scholarlyEcosystem,
  researchNotes,
  personalGenealogyReport,
  outlineProposal,
  enrichedNodeCount,
  enrichedLinkCount,
}: BuildDigitalHermeneuticsReportInput): DigitalHermeneuticsReport {
  const zh = language === 'zh-Hant';
  const totalNodes = result.nodes.length;
  const totalLinks = result.links.length;
  const notebookSources = notebookCorpus?.sourceCount ?? 0;
  const citations = uniqueGraphCitations(result);
  const auditedNodes = result.nodes.filter((node) => node.citationAudit).length;
  const verifiedCitations = verifiedCitationCount(result);
  const debatedLinks = result.links.filter((link) => (link.scholarlyDebate?.length ?? 0) > 0).length;
  const testedLinks = result.links.filter((link) => link.intertextualityMetrics?.pValue).length;
  const hasSummary = summaryLoaded && result.summary.trim().length > 0;
  const publicationIsCurrent = publicationSyncStatus.status === 'up-to-date';
  const hasPersistentStorage = false;

  const modules: DigitalHermeneuticsModule[] = [
    module(
      'corpus',
      zh ? '語料接入' : 'Corpus Ingestion',
      state(notebookSources > 0 && verifiedCitations > 0, notebookSources > 0 || citations > 0),
      zh
        ? '顯示目前工作階段是否有已同步外部語料及圖譜引文。'
        : 'Shows whether this session has synced external material and graph citations.',
      zh
        ? '此指標不評估來源的學術品質、授權範圍或書目正確性。'
        : 'This indicator does not assess source quality, licensing, or bibliographic accuracy.',
      zh
        ? '以可核對的書目記錄補足外部語料來源。'
        : 'Add externally checkable bibliographic records for imported sources.',
      [
        { label: zh ? '同步來源' : 'Synced sources', value: String(notebookSources) },
        { label: zh ? '圖譜引文' : 'Graph citations', value: String(citations) },
        { label: zh ? '已核驗引文' : 'Audited citations', value: String(verifiedCitations) },
      ],
    ),
    module(
      'workflow',
      zh ? '研究流程' : 'Research Workflow',
      state(totalNodes > 0 && totalLinks > 0 && hasSummary && enrichedNodeCount > 0, totalNodes > 0 || totalLinks > 0),
      zh
        ? '顯示結構追蹤、深化分析與綜合輸出是否已在目前工作階段使用。'
        : 'Shows whether structural tracing, enrichment, and synthesis have been used in this session.',
      zh
        ? '完成步驟不等於其結論已獲學術核實。'
        : 'Completed workflow steps do not establish that their conclusions are academically verified.',
      zh
        ? '逐一復核關鍵節點與連線的證據鏈。'
        : 'Review the evidence chain for each material node and link.',
      [
        { label: zh ? '節點' : 'Nodes', value: String(totalNodes) },
        { label: zh ? '連線' : 'Links', value: String(totalLinks) },
        { label: zh ? '已深化節點' : 'Enriched nodes', value: String(enrichedNodeCount) },
        { label: zh ? '已深化連線' : 'Enriched links', value: String(enrichedLinkCount) },
      ],
    ),
    module(
      'debate',
      zh ? '學術爭議記錄' : 'Scholarly Debate Record',
      state(debatedLinks > 0 && personalGenealogyReport.stanceCount > 0, debatedLinks > 0 || scholarlyEcosystem.contestedLinks.length > 0),
      zh
        ? '顯示圖譜是否記錄競爭立場與使用者對爭點的回應。'
        : 'Shows whether the graph records competing positions and the user’s responses to them.',
      zh
        ? '記錄到的立場不代表已完整覆蓋相關學術文獻。'
        : 'Recorded positions do not demonstrate complete coverage of the relevant scholarship.',
      zh
        ? '為每個關鍵爭點加入可追溯的學者、著作與具體論證。'
        : 'Attach traceable scholars, works, and arguments to each material dispute.',
      [
        { label: zh ? '含爭論連線' : 'Debated links', value: String(debatedLinks) },
        { label: zh ? '爭議連線' : 'Contested links', value: String(scholarlyEcosystem.contestedLinks.length) },
        { label: zh ? '立場記錄' : 'Recorded stances', value: String(personalGenealogyReport.stanceCount) },
      ],
    ),
    module(
      'integrity',
      zh ? '證據與審核' : 'Evidence and Review',
      state(
        totalNodes > 0 &&
          auditedNodes === totalNodes &&
          verifiedCitations > 0 &&
          peerReviewGate.reviewCompleted &&
          peerReviewGate.readyForPresentation,
        auditedNodes > 0 || verification !== undefined || testedLinks > 0,
      ),
      zh
        ? '顯示引文稽核、互文性檢驗及已記錄的審稿問題。'
        : 'Shows citation auditing, intertextuality checks, and recorded review issues.',
      zh
        ? '系統稽核不能替代專家對原始文獻、語文與論證的獨立判讀。'
        : 'System checks do not replace independent expert assessment of primary sources, language, or argument.',
      zh
        ? '在發表前由領域專家複核所有決定性證據與引文。'
        : 'Have a domain expert review every decisive piece of evidence and citation before publication.',
      [
        { label: zh ? '已稽核節點' : 'Audited nodes', value: `${auditedNodes}/${totalNodes}` },
        { label: zh ? '已核驗引文' : 'Verified citations', value: String(verifiedCitations) },
        { label: zh ? '統計檢驗連線' : 'Stat-tested links', value: String(testedLinks) },
        {
          label: zh ? '實質審稿' : 'Substantive review',
          value: peerReviewGate.reviewCompleted ? (zh ? '已完成' : 'Complete') : (zh ? '未完成' : 'Not completed'),
        },
        { label: zh ? '重大未結案' : 'Open major findings', value: String(peerReviewGate.openMajor) },
      ],
    ),
    module(
      'provenance',
      zh ? '出版溯源' : 'Publication Provenance',
      state(
        Boolean(publication?.citationIndex.length) && Boolean(peerReviewPacket) && publicationIsCurrent,
        Boolean(publication),
      ),
      zh
        ? '顯示出版草稿是否附有可回溯至圖譜節點的引文索引。'
        : 'Shows whether a publication draft has a citation index that routes back to graph nodes.',
      zh
        ? '目前版本沒有跨工作階段保存的溯源快照。'
        : 'The current version does not preserve provenance snapshots across sessions.',
      zh
        ? '保存每次出版與審稿版本的不可變溯源快照。'
        : 'Persist immutable provenance snapshots for each publication and review version.',
      [
        { label: zh ? '出版稿' : 'Publication', value: publication ? (zh ? '有' : 'Yes') : (zh ? '無' : 'No') },
        { label: zh ? '引文索引' : 'Citation index', value: String(publication?.citationIndex.length ?? 0) },
        { label: zh ? '匿名封包' : 'Blind packet', value: peerReviewPacket ? (zh ? '有' : 'Yes') : (zh ? '無' : 'No') },
        { label: zh ? '出版同步' : 'Publication sync', value: publicationSyncStatus.status },
      ],
    ),
    module(
      'memory',
      zh ? '研究記憶' : 'Research Memory',
      state(hasPersistentStorage, researchNotes.length > 0 || Boolean(publication) || outlineProposal.sections.length > 0),
      zh
        ? '顯示目前工作階段的筆記、大綱及出版草稿。'
        : 'Shows notes, outlines, and publication drafts in the current session.',
      zh
        ? '目前未證明有持久化專案儲存；重新整理瀏覽器可能清除這些內容。'
        : 'Durable project storage is not demonstrated; a browser refresh may clear this material.',
      zh
        ? '加入本地或伺服器端的專案儲存與版本紀錄。'
        : 'Add local or server-side project storage with version history.',
      [
        { label: zh ? '研究筆記' : 'Research notes', value: String(researchNotes.length) },
        { label: zh ? '大綱章節' : 'Outline sections', value: String(outlineProposal.sections.length) },
        { label: zh ? '持久化儲存' : 'Durable storage', value: zh ? '未證明' : 'Not demonstrated' },
      ],
    ),
  ];

  const evidenceGaps: string[] = [];
  if (notebookSources === 0) {
    evidenceGaps.push(zh ? '未同步外部語料。' : 'No external corpus is synced.');
  }
  if (auditedNodes < totalNodes) {
    evidenceGaps.push(zh ? '仍有節點未完成引文稽核。' : 'Some nodes have not completed citation auditing.');
  }
  if (!publication) {
    evidenceGaps.push(zh ? '尚未產生可供溯源的出版草稿。' : 'No publication draft is available for provenance review.');
  }
  if (!hasPersistentStorage) {
    evidenceGaps.push(zh ? '研究筆記與出版物尚無持久化專案儲存。' : 'Research notes and publications do not yet have durable project storage.');
  }
  if (!peerReviewGate.reviewCompleted) {
    evidenceGaps.push(zh ? '尚未完成實質論文審稿。' : 'No substantive manuscript review has been completed.');
  }
  if (peerReviewGate.openMajor > 0) {
    evidenceGaps.push(zh ? '尚有重大審稿問題未處理。' : 'Major peer-review findings remain open.');
  }

  const nextActions = modules
    .filter((entry) => entry.state !== 'evidenced')
    .slice(0, 4)
    .map((entry) => `${entry.label}: ${entry.nextStep}`);

  return {
    generatedAt: new Date().toISOString(),
    productName: zh ? '數位詮釋學功能覆蓋圖' : 'Digital Hermeneutics Capability Map',
    assessmentLabel: zh ? '功能覆蓋，非品質評分' : 'Capability coverage, not quality scoring',
    assessmentNotice: zh
      ? '本頁僅根據目前工作階段中可觀察的功能與資料狀態列示覆蓋範圍；它不是學術品質認證、可發表性判定或同行評審結論。'
      : 'This page reports observable capabilities and session data only; it is not a certification of scholarly quality, publishability, or peer-review outcome.',
    summary: zh
      ? '此圖用於辨認哪些研究工作已有可觀察記錄，以及哪些證據、審核與保存環節仍然缺失。'
      : 'This map identifies which research activities have observable records and which evidence, review, and preservation steps remain absent.',
    modules,
    evidenceGaps,
    nextActions,
  };
}
