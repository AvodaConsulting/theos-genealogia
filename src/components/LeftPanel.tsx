import { BookOpenCheck, Sparkles } from 'lucide-react';

import type {
  ActivityLogEntry,
  CanonicalAssumption,
  HermeneuticFramework,
  LanguagePhilosophy,
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

const LANGUAGE_OPTIONS: LanguagePhilosophy[] = ['Reference', 'Use', 'Differance', 'Event'];

interface LeftPanelProps {
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">LLM Access</p>
          <p className="text-xs text-slate-700">{providerLabel ?? 'Gemini runtime key verified'}</p>
          <button
            onClick={onChangeAccessKey}
            className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-amber-100"
          >
            Change API Key
          </button>
        </div>
      ) : null}

      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-olive">
        Research Prompt
      </label>
      <textarea
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        rows={8}
        className="mb-3 w-full rounded-2xl border border-amber-200 bg-white p-3 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-bronze"
        placeholder="The concept of Logos in John 1..."
      />

      <div className="mb-3 rounded-2xl border border-amber-200 bg-white/80 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-olive">
          NotebookLM Sync
        </h3>
        <p className="mb-2 text-xs text-slate-600">
          Paste notebook link/ID. It will auto-sync when you click Trace Genealogy.
        </p>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Notebook Link / ID
        </label>
        <input
          value={notebookRef}
          onChange={(event) => onNotebookRefChange(event.target.value)}
          className="mb-2 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-bronze"
          placeholder="Paste NotebookLM URL or notebook ID..."
        />
        <button
          onClick={onNotebookSync}
          disabled={notebookSyncLoading || notebookRef.trim().length === 0}
          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {notebookSyncLoading ? 'Syncing...' : 'Sync Now (Optional)'}
        </button>
        {notebookCorpus ? (
          <p className="mt-2 text-xs text-slate-600">
            Synced {notebookCorpus.sourceCount} sources
            {notebookCorpus.notebookTitle ? ` from "${notebookCorpus.notebookTitle}"` : ''}.
          </p>
        ) : null}
        {notebookSyncError ? <p className="mt-1 text-xs text-red-700">{notebookSyncError}</p> : null}
      </div>

      <div className="mb-3 rounded-2xl border border-amber-200 bg-white/80 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-olive">
          Methodology Profile
        </h3>

        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Hermeneutics
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
              {framework}
              {REQUIRED_HERMENEUTICS.includes(framework) ? (
                <span className="text-[10px] uppercase tracking-wide text-slate-500">required</span>
              ) : null}
            </label>
          ))}
        </div>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Canonical Assumption
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
              {option}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Language Philosophy
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
              {option}
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
        {loading ? 'Tracing...' : 'Trace Genealogy'}
      </button>

      <ActivityLog logs={logs} />
    </aside>
  );
}
