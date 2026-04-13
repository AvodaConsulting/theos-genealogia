import { BookOpenCheck, Sparkles } from 'lucide-react';

import type {
  AnalysisDepth,
  AppLanguage,
  ActivityLogEntry,
  CanonicalAssumption,
  HermeneuticFramework,
  LanguagePhilosophy,
  TraceHorizon,
  ResearchMethodologyProfile,
  NotebookCorpus,
} from '../types';
import { ActivityLog } from './ActivityLog';

const HERMENEUTIC_OPTIONS: HermeneuticFramework[] = [
  'Historical-Critical',
  'Literary',
  'Reader-Response',
];
const REQUIRED_HERMENEUTICS: HermeneuticFramework[] = ['Historical-Critical', 'Literary'];

const CANONICAL_OPTIONS: CanonicalAssumption[] = [
  'Traditional',
  'Expanded Canon',
  'Plural Canons',
  'Non-Canonical',
];

const TRACE_HORIZON_OPTIONS: TraceHorizon[] = ['Core-70CE', 'Extended-ANE'];
const ANALYSIS_DEPTH_OPTIONS: AnalysisDepth[] = ['Standard', 'Comprehensive'];

const LANGUAGE_OPTIONS: LanguagePhilosophy[] = ['Reference', 'Use', 'Differance', 'Event'];

interface LeftPanelProps {
  language: AppLanguage;
  onLanguageChange: (value: AppLanguage) => void;
  query: string;
  onQueryChange: (value: string) => void;
  methodology: ResearchMethodologyProfile;
  onMethodologyChange: (value: ResearchMethodologyProfile) => void;
  onTrace: () => void;
  loading: boolean;
  logs: ActivityLogEntry[];
  notebookRef: string;
  onNotebookRefChange: (value: string) => void;
  onNotebookSync: () => void;
  notebookSyncLoading: boolean;
  notebookCorpus?: NotebookCorpus;
  notebookSyncError?: string | null;
  providerLabel?: string;
  onChangeAccessKey?: () => void;
}

export function LeftPanel({
  language,
  onLanguageChange,
  query,
  onQueryChange,
  methodology,
  onMethodologyChange,
  onTrace,
  loading,
  logs,
  notebookRef,
  onNotebookRefChange,
  onNotebookSync,
  notebookSyncLoading,
  notebookCorpus,
  notebookSyncError,
  providerLabel,
  onChangeAccessKey,
}: LeftPanelProps) {
  const zh = language === 'zh-Hant';
  const copy = {
    llmAccess: zh ? 'LLM 連線' : 'LLM Access',
    changeApiKey: zh ? '更換 API Key' : 'Change API Key',
    prompt: zh ? '研究問題' : 'Research Prompt',
    promptPlaceholder: zh ? '例如：約翰福音 1 章中的 Logos 概念…' : 'The concept of Logos in John 1...',
    notebookSync: zh ? 'NotebookLM 同步' : 'NotebookLM Sync',
    notebookHelp: zh
      ? '貼上筆記本連結或 ID。按下「追溯系譜」時會自動同步。'
      : 'Paste notebook link/ID. It will auto-sync when you click Trace Genealogy.',
    notebookLabel: zh ? 'Notebook 連結 / ID' : 'Notebook Link / ID',
    notebookPlaceholder: zh ? '貼上 NotebookLM URL 或 notebook ID...' : 'Paste NotebookLM URL or notebook ID...',
    syncNow: zh ? '立即同步（可選）' : 'Sync Now (Optional)',
    syncing: zh ? '同步中...' : 'Syncing...',
    syncedPrefix: zh ? '已同步' : 'Synced',
    syncedSuffix: zh ? '個來源' : 'sources',
    methodology: zh ? '方法論設定' : 'Methodology Profile',
    traceHorizon: zh ? '追溯範圍' : 'Trace Horizon',
    analysisDepth: zh ? '分析深度' : 'Analysis Depth',
    hermeneutics: zh ? '詮釋學框架' : 'Hermeneutics',
    required: zh ? '必要' : 'required',
    canonical: zh ? '正典假設' : 'Canonical Assumption',
    languagePhilosophy: zh ? '語言哲學立場' : 'Language Philosophy',
    tracing: zh ? '追溯中...' : 'Tracing...',
    traceGenealogy: zh ? '追溯系譜' : 'Trace Genealogy',
    languageToggle: zh ? '介面語言' : 'Interface Language',
    english: 'English',
    traditionalChinese: '繁體中文',
  };

  const traceHorizonLabel = (option: TraceHorizon): string => {
    if (!zh) return option;
    return option === 'Core-70CE' ? '核心範圍（至 70 CE）' : '擴展範圍（含古代近東）';
  };
  const depthLabel = (option: AnalysisDepth): string => {
    if (!zh) return option;
    return option === 'Standard' ? '標準' : '完整';
  };
  const frameworkLabel = (framework: HermeneuticFramework): string => {
    if (!zh) return framework;
    if (framework === 'Historical-Critical') return '歷史批判';
    if (framework === 'Literary') return '文學批判';
    return '讀者反應';
  };
  const canonicalLabel = (option: CanonicalAssumption): string => {
    if (!zh) return option;
    if (option === 'Traditional') return '傳統正典';
    if (option === 'Expanded Canon') return '擴展正典';
    if (option === 'Plural Canons') return '多元正典';
    return '非正典預設';
  };
  const langPhilosophyLabel = (option: LanguagePhilosophy): string => {
    if (!zh) return option;
    if (option === 'Reference') return '指稱論';
    if (option === 'Use') return '使用論';
    if (option === 'Differance') return '差異／延異';
    return '事件論';
  };

  const toggleFramework = (framework: HermeneuticFramework) => {
    if (REQUIRED_HERMENEUTICS.includes(framework)) {
      return;
    }

    const hasFramework = methodology.hermeneuticFrameworks.includes(framework);
    const next = hasFramework
      ? methodology.hermeneuticFrameworks.filter((item) => item !== framework)
      : [...methodology.hermeneuticFrameworks, framework];

    onMethodologyChange({
      ...methodology,
      hermeneuticFrameworks: Array.from(new Set([...REQUIRED_HERMENEUTICS, ...next])),
    });
  };

  return (
    <aside className="w-full border-b border-amber-200/80 bg-parchment/95 p-5 xl:h-screen xl:w-80 xl:border-b-0 xl:border-r xl:overflow-y-auto">
      <div className="mb-4 flex items-center gap-2 text-ink">
        <BookOpenCheck className="h-5 w-5 text-deepSea" />
        <h1 className="text-lg font-semibold tracking-tight">TheosGenealogia</h1>
      </div>
      {onChangeAccessKey ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-white/80 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{copy.llmAccess}</p>
          <p className="text-xs text-slate-700">
            {providerLabel ?? (zh ? 'Gemini 連線金鑰已驗證' : 'Gemini runtime key verified')}
          </p>
          <button
            onClick={onChangeAccessKey}
            className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-amber-100"
          >
            {copy.changeApiKey}
          </button>
        </div>
      ) : null}

      <div className="mb-3 rounded-xl border border-amber-200 bg-white/80 p-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {copy.languageToggle}
        </label>
        <div className="inline-flex rounded-lg border border-amber-200 bg-white p-1">
          <button
            onClick={() => onLanguageChange('en')}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              language === 'en' ? 'bg-deepSea text-white' : 'text-slate-700'
            }`}
          >
            {copy.english}
          </button>
          <button
            onClick={() => onLanguageChange('zh-Hant')}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              language === 'zh-Hant' ? 'bg-deepSea text-white' : 'text-slate-700'
            }`}
          >
            {copy.traditionalChinese}
          </button>
        </div>
      </div>

      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-olive">
        {copy.prompt}
      </label>
      <textarea
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        rows={8}
        className="mb-3 w-full rounded-2xl border border-amber-200 bg-white p-3 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-bronze"
        placeholder={copy.promptPlaceholder}
      />

      <div className="mb-3 rounded-2xl border border-amber-200 bg-white/80 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-olive">
          {copy.notebookSync}
        </h3>
        <p className="mb-2 text-xs text-slate-600">
          {copy.notebookHelp}
        </p>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {copy.notebookLabel}
        </label>
        <input
          value={notebookRef}
          onChange={(event) => onNotebookRefChange(event.target.value)}
          className="mb-2 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-bronze"
          placeholder={copy.notebookPlaceholder}
        />
        <button
          onClick={onNotebookSync}
          disabled={notebookSyncLoading || notebookRef.trim().length === 0}
          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {notebookSyncLoading ? copy.syncing : copy.syncNow}
        </button>
        {notebookCorpus ? (
          <p className="mt-2 text-xs text-slate-600">
            {copy.syncedPrefix} {notebookCorpus.sourceCount} {copy.syncedSuffix}
            {notebookCorpus.notebookTitle
              ? zh
                ? `（來自「${notebookCorpus.notebookTitle}」）`
                : ` from "${notebookCorpus.notebookTitle}"`
              : ''}
            {zh ? '。' : '.'}
          </p>
        ) : null}
        {notebookSyncError ? <p className="mt-1 text-xs text-red-700">{notebookSyncError}</p> : null}
      </div>

      <div className="mb-3 rounded-2xl border border-amber-200 bg-white/80 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-olive">
          {copy.methodology}
        </h3>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {copy.traceHorizon}
        </label>
        <select
          value={methodology.traceHorizon}
          onChange={(event) =>
            onMethodologyChange({
              ...methodology,
              traceHorizon: event.target.value as TraceHorizon,
            })
          }
          className="mb-3 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-bronze"
        >
          {TRACE_HORIZON_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {zh ? traceHorizonLabel(option) : option}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {copy.analysisDepth}
        </label>
        <select
          value={methodology.analysisDepth}
          onChange={(event) =>
            onMethodologyChange({
              ...methodology,
              analysisDepth: event.target.value as AnalysisDepth,
            })
          }
          className="mb-3 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-bronze"
        >
          {ANALYSIS_DEPTH_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {depthLabel(option)}
            </option>
          ))}
        </select>

        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {copy.hermeneutics}
        </p>
        <div className="mb-3 grid grid-cols-1 gap-1.5">
          {HERMENEUTIC_OPTIONS.map((framework) => (
            <label key={framework} className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={methodology.hermeneuticFrameworks.includes(framework)}
                onChange={() => toggleFramework(framework)}
                disabled={REQUIRED_HERMENEUTICS.includes(framework)}
                className="h-3.5 w-3.5 rounded border-amber-300 text-deepSea focus:ring-deepSea"
              />
              {frameworkLabel(framework)}
              {REQUIRED_HERMENEUTICS.includes(framework) ? (
                <span className="text-[10px] uppercase tracking-wide text-slate-500">{copy.required}</span>
              ) : null}
            </label>
          ))}
        </div>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {copy.canonical}
        </label>
        <select
          value={methodology.canonicalAssumption}
          onChange={(event) =>
            onMethodologyChange({
              ...methodology,
              canonicalAssumption: event.target.value as CanonicalAssumption,
            })
          }
          className="mb-3 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-bronze"
        >
          {CANONICAL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {canonicalLabel(option)}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {copy.languagePhilosophy}
        </label>
        <select
          value={methodology.languagePhilosophy}
          onChange={(event) =>
            onMethodologyChange({
              ...methodology,
              languagePhilosophy: event.target.value as LanguagePhilosophy,
            })
          }
          className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-bronze"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {langPhilosophyLabel(option)}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onTrace}
        disabled={loading || query.trim().length === 0}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-deepSea px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#18304f] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" />
        {loading ? copy.tracing : copy.traceGenealogy}
      </button>

      <ActivityLog language={language} logs={logs} />
    </aside>
  );
}
