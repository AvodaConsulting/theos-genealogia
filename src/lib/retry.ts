const RETRY_DELAYS_MS = [5000, 10000, 20000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const maybeError = error as {
    status?: number;
    code?: number;
    message?: string;
  };

  if (maybeError.status === 429 || maybeError.code === 429) {
    return true;
  }

  if (typeof maybeError.message === 'string') {
    const message = maybeError.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('quota') ||
      message.includes('rate limit')
    );
  }

  return false;
}

export async function with429Retry<T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, waitMs: number, error: unknown) => void,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRateLimitError(error) || attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }

      const waitMs = RETRY_DELAYS_MS[attempt];
      onRetry?.(attempt + 1, waitMs, error);
      await sleep(waitMs);
    }
  }

  throw lastError;
}
