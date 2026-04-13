import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import type { ActivityLogEntry } from '../types';
import { cn } from '../lib/cn';
import type { AppLanguage } from '../types';
import { phaseLabel } from '../lib/i18n';

interface ActivityLogProps {
  language: AppLanguage;
  logs: ActivityLogEntry[];
}

function statusIcon(status: ActivityLogEntry['status']) {
  if (status === 'success') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }

  if (status === 'error') {
    return <XCircle className="h-4 w-4 text-red-600" />;
  }

  if (status === 'running') {
    return <Loader2 className="h-4 w-4 animate-spin text-bronze" />;
  }

  return <Loader2 className="h-4 w-4 text-slate-400" />;
}

export function ActivityLog({ language, logs }: ActivityLogProps) {
  const zh = language === 'zh-Hant';
  return (
    <div className="rounded-2xl border border-amber-200 bg-white/80 p-3 shadow-scholar">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-olive">
        {zh ? '活動記錄' : 'Activity Log'}
      </h3>
      <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">
            {zh ? '流程狀態會即時顯示在此。' : 'Pipeline status events will appear here in real time.'}
          </p>
        ) : null}
        {logs.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              'rounded-xl border p-2',
              entry.status === 'error'
                ? 'border-red-200 bg-red-50'
                : 'border-amber-100 bg-amber-50/60',
            )}
          >
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              {statusIcon(entry.status)}
              <span>{phaseLabel(entry.phase, language)}</span>
              <span className="ml-auto">{entry.timestamp}</span>
            </div>
            <p className="text-sm text-slate-700">{entry.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
