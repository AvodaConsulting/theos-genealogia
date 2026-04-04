function stripCodeFence(input: string): string {
  const fencedMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return input.trim().replace(/^json\s*/i, '').trim();
}

function extractLikelyJson(input: string): string {
  const firstBrace = input.indexOf('{');
  const firstBracket = input.indexOf('[');

  const candidates = [firstBrace, firstBracket].filter((index) => index >= 0);
  if (candidates.length === 0) {
    return input;
  }

  const start = Math.min(...candidates);
  const lastBrace = input.lastIndexOf('}');
  const lastBracket = input.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);

  if (end <= start) {
    return input.slice(start);
  }

  return input.slice(start, end + 1);
}

function closeDanglingString(input: string): string {
  let quoteCount = 0;
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === '"' && input[i - 1] !== '\\') {
      quoteCount += 1;
    }
  }

  return quoteCount % 2 === 0 ? input : `${input}"`;
}

function balanceDelimiters(input: string): string {
  const stack: string[] = [];
  let inString = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const previous = input[i - 1];

    if (char === '"' && previous !== '\\') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }

    if (char === '}' || char === ']') {
      const expected = char === '}' ? '{' : '[';
      if (stack[stack.length - 1] === expected) {
        stack.pop();
      }
    }
  }

  let output = input;
  while (stack.length > 0) {
    const opener = stack.pop();
    output += opener === '{' ? '}' : ']';
  }

  return output;
}

function removeTrailingCommas(input: string): string {
  return input.replace(/,\s*([}\]])/g, '$1');
}

export function cleanJson(raw: string): string {
  let normalized = stripCodeFence(raw).replace(/^\uFEFF/, '').trim();
  normalized = extractLikelyJson(normalized);
  normalized = closeDanglingString(normalized);
  normalized = balanceDelimiters(normalized);
  normalized = removeTrailingCommas(normalized);
  return normalized;
}

export function safeParseJson<T>(raw: string): T {
  const direct = raw.trim();

  try {
    return JSON.parse(direct) as T;
  } catch {
    const repaired = cleanJson(raw);
    return JSON.parse(repaired) as T;
  }
}
