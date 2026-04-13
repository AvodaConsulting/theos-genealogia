import { GoogleGenAI } from '@google/genai';

import { safeParseJson } from './cleanJson';
import { with429Retry } from './retry';

type Provider = 'openai' | 'gemini';
export type GeminiKeySource = 'session' | 'localStorage' | 'env' | 'missing';

type RetryCallback = (attempt: number, waitMs: number, error: unknown) => void;

interface ConfigureGeminiRuntimeInput {
  apiKey: string;
  model?: string;
  persist?: boolean;
}

interface GeminiRuntimeSnapshot {
  apiKey: string;
  model: string;
  hasKey: boolean;
  keySource: GeminiKeySource;
}

const configuredProvider = (import.meta.env.VITE_LLM_PROVIDER ?? 'gemini').toLowerCase();

const openAiModel = import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-5';
const openAiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

const FALLBACK_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
];

const GEMINI_KEY_STORAGE_KEY = 'theosgenealogia.gemini.apiKey';
const GEMINI_MODEL_STORAGE_KEY = 'theosgenealogia.gemini.model';

const envGeminiModel = normalizeGeminiModelName(import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-2.5-flash');
const envGeminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

let geminiClient: GoogleGenAI | null = null;
let geminiClientApiKey = '';

let runtimeGeminiApiKey = '';
let runtimeGeminiModel = envGeminiModel;
let runtimeGeminiKeySource: GeminiKeySource = 'missing';
let runtimeLoaded = false;

function normalizeGeminiModelName(model: string): string {
  const normalized = model.trim();
  if (!normalized) {
    return 'gemini-2.5-flash';
  }

  const aliases: Record<string, string> = {
    'gemini-3.0-flash-preview': 'gemini-3-flash-preview',
    'gemini-3.0-pro-preview': 'gemini-3-pro-preview',
  };

  return aliases[normalized] ?? normalized;
}

function hasUsableKey(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return !(
    normalized.includes('your_') ||
    normalized.includes('replace_me') ||
    normalized.endsWith('_here')
  );
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function clearGeminiClient(): void {
  geminiClient = null;
  geminiClientApiKey = '';
}

function initializeRuntimeGemini(): void {
  if (runtimeLoaded) {
    return;
  }
  runtimeLoaded = true;

  if (canUseLocalStorage()) {
    const storedKey = window.localStorage.getItem(GEMINI_KEY_STORAGE_KEY) ?? '';
    const storedModel = normalizeGeminiModelName(
      window.localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) ?? envGeminiModel,
    );

    if (hasUsableKey(storedKey)) {
      runtimeGeminiApiKey = storedKey.trim();
      runtimeGeminiModel = storedModel;
      runtimeGeminiKeySource = 'localStorage';
      return;
    }
  }

  if (hasUsableKey(envGeminiApiKey)) {
    runtimeGeminiApiKey = envGeminiApiKey!.trim();
    runtimeGeminiModel = envGeminiModel;
    runtimeGeminiKeySource = 'env';
    return;
  }

  runtimeGeminiApiKey = '';
  runtimeGeminiModel = envGeminiModel;
  runtimeGeminiKeySource = 'missing';
}

function resolveGeminiRuntime(): GeminiRuntimeSnapshot {
  initializeRuntimeGemini();
  return {
    apiKey: runtimeGeminiApiKey,
    model: runtimeGeminiModel,
    hasKey: hasUsableKey(runtimeGeminiApiKey),
    keySource: runtimeGeminiKeySource,
  };
}

export function getGeminiRuntimeSnapshot(): GeminiRuntimeSnapshot {
  return resolveGeminiRuntime();
}

export function configureGeminiRuntime(input: ConfigureGeminiRuntimeInput): GeminiRuntimeSnapshot {
  const apiKey = input.apiKey.trim();
  if (!hasUsableKey(apiKey)) {
    throw new Error('Gemini API key is missing or invalid.');
  }

  initializeRuntimeGemini();
  runtimeGeminiApiKey = apiKey;
  runtimeGeminiModel = normalizeGeminiModelName(input.model ?? runtimeGeminiModel ?? envGeminiModel);
  runtimeGeminiKeySource = input.persist ? 'localStorage' : 'session';
  clearGeminiClient();

  if (canUseLocalStorage()) {
    if (input.persist) {
      window.localStorage.setItem(GEMINI_KEY_STORAGE_KEY, runtimeGeminiApiKey);
      window.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, runtimeGeminiModel);
    } else {
      window.localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
      window.localStorage.removeItem(GEMINI_MODEL_STORAGE_KEY);
    }
  }

  return resolveGeminiRuntime();
}

export function clearGeminiRuntime(options?: { clearPersisted?: boolean }): void {
  initializeRuntimeGemini();
  runtimeGeminiApiKey = '';
  runtimeGeminiModel = envGeminiModel;
  runtimeGeminiKeySource = 'missing';
  clearGeminiClient();

  if ((options?.clearPersisted ?? true) && canUseLocalStorage()) {
    window.localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
    window.localStorage.removeItem(GEMINI_MODEL_STORAGE_KEY);
  }
}

function createHttpError(status: number, message: string): Error & { status: number; code: number } {
  const error = new Error(message) as Error & { status: number; code: number };
  error.status = status;
  error.code = status;
  return error;
}

function isFetchFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const text = error.message.toLowerCase();
  return text.includes('failed to fetch') || text.includes('networkerror');
}

function normalizeProviderError(error: unknown): Error {
  if (error instanceof Error) {
    if (isFetchFailure(error)) {
      return new Error(
        'Network request failed while contacting the LLM provider. Confirm internet access, API key validity, and provider endpoint availability.',
      );
    }

    return error;
  }

  return new Error('Unknown LLM error.');
}

function isGeminiModelNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const text = error.message.toLowerCase();
  return text.includes('is not found for api version') || text.includes('404') || text.includes('not_found');
}

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!hasUsableKey(apiKey)) {
    throw new Error('Gemini API key is missing or invalid.');
  }

  if (!geminiClient || geminiClientApiKey !== apiKey) {
    geminiClient = new GoogleGenAI({ apiKey });
    geminiClientApiKey = apiKey;
  }

  return geminiClient;
}

function buildGeminiModelCandidates(preferredModel: string): string[] {
  return Array.from(
    new Set([
      normalizeGeminiModelName(preferredModel),
      ...FALLBACK_GEMINI_MODELS.map((model) => normalizeGeminiModelName(model)),
    ]),
  );
}

function extractGeminiText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Gemini response was empty.');
  }

  const maybePayload = payload as {
    text?: string;
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  if (typeof maybePayload.text === 'string' && maybePayload.text.trim().length > 0) {
    return maybePayload.text;
  }

  const candidateText = maybePayload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!candidateText) {
    throw new Error('Gemini response did not include text content.');
  }

  return candidateText;
}

async function generateWithGeminiCandidate<T>(
  prompt: string,
  apiKey: string,
  preferredModel: string,
): Promise<{ parsed: T; modelUsed: string }> {
  if (!hasUsableKey(apiKey)) {
    throw new Error(
      'Gemini API key is not configured. Enter your own Gemini key in the app access gate before starting research.',
    );
  }

  const candidates = buildGeminiModelCandidates(preferredModel);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const response = await getGeminiClient(apiKey).models.generateContent({
        model: candidate,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      return {
        parsed: safeParseJson<T>(extractGeminiText(response)),
        modelUsed: candidate,
      };
    } catch (error) {
      lastError = error;
      if (isGeminiModelNotFoundError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `No compatible Gemini model was found. Tried: ${candidates.join(', ')}. Last error: ${
      lastError instanceof Error ? lastError.message : 'unknown'
    }`,
  );
}

async function generateTextWithGeminiCandidate(
  prompt: string,
  apiKey: string,
  preferredModel: string,
): Promise<{ text: string; modelUsed: string }> {
  if (!hasUsableKey(apiKey)) {
    throw new Error(
      'Gemini API key is not configured. Enter your own Gemini key in the app access gate before starting research.',
    );
  }

  const candidates = buildGeminiModelCandidates(preferredModel);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const response = await getGeminiClient(apiKey).models.generateContent({
        model: candidate,
        contents: prompt,
        config: {
          temperature: 0.2,
        },
      });

      return {
        text: extractGeminiText(response),
        modelUsed: candidate,
      };
    } catch (error) {
      lastError = error;
      if (isGeminiModelNotFoundError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `No compatible Gemini model was found. Tried: ${candidates.join(', ')}. Last error: ${
      lastError instanceof Error ? lastError.message : 'unknown'
    }`,
  );
}

export async function verifyGeminiRuntimeCredentials(
  apiKey: string,
  preferredModel?: string,
): Promise<{ model: string; providerLabel: string }> {
  const normalizedKey = apiKey.trim();
  if (!hasUsableKey(normalizedKey)) {
    throw new Error('Please provide a valid Gemini API key.');
  }

  const probeModel = normalizeGeminiModelName(preferredModel ?? envGeminiModel);
  const probePrompt = [
    'Return strict JSON only.',
    '{"ok":true,"purpose":"theosgenealogia-access-check"}',
  ].join('\n');

  try {
    const probe = await generateWithGeminiCandidate<{ ok?: boolean }>(probePrompt, normalizedKey, probeModel);
    if (!probe.parsed || probe.parsed.ok !== true) {
      throw new Error('Gemini verification payload was malformed.');
    }
    clearGeminiClient();
    return {
      model: probe.modelUsed,
      providerLabel: `Gemini (${probe.modelUsed})`,
    };
  } catch (error) {
    throw normalizeProviderError(error);
  }
}

function extractOpenAiText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('OpenAI response was empty.');
  }

  const maybePayload = payload as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const first = maybePayload.choices?.[0]?.message?.content;
  if (typeof first === 'string' && first.trim().length > 0) {
    return first;
  }

  if (Array.isArray(first)) {
    const text = first
      .filter((item) => item.type === 'text' || typeof item.text === 'string')
      .map((item) => item.text ?? '')
      .join('')
      .trim();

    if (text.length > 0) {
      return text;
    }
  }

  throw new Error('OpenAI response did not include textual content.');
}

async function generateWithOpenAi<T>(prompt: string): Promise<T> {
  if (!hasUsableKey(openAiApiKey)) {
    throw new Error(
      'Missing OpenAI API key. Configure VITE_OPENAI_API_KEY for OpenAI mode, or use Gemini runtime key mode.',
    );
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
        ? body.error.message
        : `OpenAI request failed with status ${response.status}.`;

    throw createHttpError(response.status, message);
  }

  return safeParseJson<T>(extractOpenAiText(body));
}

async function generateTextWithOpenAi(prompt: string): Promise<string> {
  if (!hasUsableKey(openAiApiKey)) {
    throw new Error(
      'Missing OpenAI API key. Configure VITE_OPENAI_API_KEY for OpenAI mode, or use Gemini runtime key mode.',
    );
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
        ? body.error.message
        : `OpenAI request failed with status ${response.status}.`;

    throw createHttpError(response.status, message);
  }

  return extractOpenAiText(body);
}

async function generateWithGemini<T>(prompt: string): Promise<T> {
  const runtime = resolveGeminiRuntime();
  if (!runtime.hasKey) {
    throw new Error(
      'Gemini API key is required. Enter and verify your own Gemini API key before using the app.',
    );
  }

  const { parsed, modelUsed } = await generateWithGeminiCandidate<T>(prompt, runtime.apiKey, runtime.model);
  runtimeGeminiModel = modelUsed;
  if (canUseLocalStorage() && runtimeGeminiKeySource === 'localStorage') {
    window.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, modelUsed);
  }
  return parsed;
}

async function generateTextWithGemini(prompt: string): Promise<string> {
  const runtime = resolveGeminiRuntime();
  if (!runtime.hasKey) {
    throw new Error(
      'Gemini API key is required. Enter and verify your own Gemini API key before using the app.',
    );
  }

  const { text, modelUsed } = await generateTextWithGeminiCandidate(prompt, runtime.apiKey, runtime.model);
  runtimeGeminiModel = modelUsed;
  if (canUseLocalStorage() && runtimeGeminiKeySource === 'localStorage') {
    window.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, modelUsed);
  }
  return text;
}

function resolveProvider(): Provider {
  const preferred: Provider = configuredProvider === 'openai' ? 'openai' : 'gemini';
  const hasOpenAi = hasUsableKey(openAiApiKey);
  const hasGemini = resolveGeminiRuntime().hasKey;

  if (preferred === 'openai') {
    if (hasOpenAi) {
      return 'openai';
    }
    if (hasGemini) {
      return 'gemini';
    }
    return 'openai';
  }

  if (hasGemini) {
    return 'gemini';
  }
  if (hasOpenAi) {
    return 'openai';
  }
  return 'gemini';
}

export async function generateJson<T>(prompt: string, onRetry?: RetryCallback): Promise<T> {
  try {
    return await with429Retry(async () => {
      const provider = resolveProvider();
      return provider === 'openai'
        ? generateWithOpenAi<T>(prompt)
        : generateWithGemini<T>(prompt);
    }, onRetry);
  } catch (error) {
    throw normalizeProviderError(error);
  }
}

export async function generateText(prompt: string, onRetry?: RetryCallback): Promise<string> {
  try {
    return await with429Retry(async () => {
      const provider = resolveProvider();
      return provider === 'openai'
        ? generateTextWithOpenAi(prompt)
        : generateTextWithGemini(prompt);
    }, onRetry);
  } catch (error) {
    throw normalizeProviderError(error);
  }
}

export function getProviderLabel(): string {
  const configured: Provider = configuredProvider === 'openai' ? 'openai' : 'gemini';
  const activeProvider = resolveProvider();

  const runtime = resolveGeminiRuntime();
  const geminiLabel = `Gemini (${runtime.model})`;
  const active = activeProvider === 'openai' ? `OpenAI (${openAiModel})` : geminiLabel;

  if (configured !== activeProvider) {
    return `${active} fallback`;
  }

  return active;
}
