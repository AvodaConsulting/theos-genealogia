import { KeyRound, Loader2, ShieldCheck, Trash2 } from 'lucide-react';

interface GeminiAccessGateProps {
  apiKey: string;
  model: string;
  rememberKey: boolean;
  loading: boolean;
  error?: string | null;
  hasSavedKey: boolean;
  onApiKeyChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onRememberKeyChange: (value: boolean) => void;
  onVerify: () => void;
  onForgetSavedKey: () => void;
}

export function GeminiAccessGate({
  apiKey,
  model,
  rememberKey,
  loading,
  error,
  hasSavedKey,
  onApiKeyChange,
  onModelChange,
  onRememberKeyChange,
  onVerify,
  onForgetSavedKey,
}: GeminiAccessGateProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fff5dc_0%,_#f1e8d5_45%,_#e6dcc9_100%)] px-5 py-8 text-ink">
      <div className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white/90 p-6 shadow-scholar">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-deepSea" />
          <h1 className="text-xl font-semibold tracking-tight">TheosGenealogia Access</h1>
        </div>

        <p className="mb-4 text-sm text-slate-700">
          Enter your own Gemini API key to start. The key is used client-side only and is never sent to any
          TheosGenealogia server.
        </p>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Gemini API Key
        </label>
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          placeholder="AIza..."
          className="mb-3 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-bronze"
        />

        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Preferred Gemini Model
        </label>
        <input
          value={model}
          onChange={(event) => onModelChange(event.target.value)}
          placeholder="gemini-2.5-flash"
          className="mb-3 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-bronze"
        />

        <label className="mb-4 inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={rememberKey}
            onChange={(event) => onRememberKeyChange(event.target.checked)}
            className="h-4 w-4 rounded border-amber-300 text-deepSea focus:ring-deepSea"
          />
          Remember this key in this browser (localStorage)
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onVerify}
            disabled={loading || apiKey.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-deepSea px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18304f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {loading ? 'Verifying...' : 'Verify Key & Start'}
          </button>

          {hasSavedKey ? (
            <button
              onClick={onForgetSavedKey}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Forget Saved Key
            </button>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
