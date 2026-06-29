/**
 * Synthesis via the Groq API (free tier, OpenAI-compatible, very fast).
 *
 * Groq runs the LLM only — it does not search the web. The live coverage comes
 * from Tavily (see search.ts); Groq turns those results into the structured
 * triangulation (three lenses + consensus, spin, stripped truth) using JSON
 * mode. Get a free key at https://console.groq.com and set GROQ_API_KEY.
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_ATTEMPTS = 4;

export class GroqError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'GroqError';
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503;
}

/**
 * Sends a system + user prompt to Groq in JSON mode and returns the raw JSON
 * string from the completion. Retries transient failures with backoff.
 */
export async function groqJsonCompletion(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqError(
      'GROQ_API_KEY is not set. Create a free key at https://console.groq.com ' +
        'and add it to your environment (.env.local locally, or Vercel settings).'
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });
    } catch (error) {
      lastError = new GroqError('Failed to reach the Groq API', undefined, error);
      if (attempt === MAX_ATTEMPTS) throw lastError;
      await delay(attempt);
      continue;
    }

    if (response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content || !content.trim()) {
        throw new GroqError('Groq returned an empty completion');
      }
      return content;
    }

    const body = await response.text().catch(() => '');
    lastError = new GroqError(
      `Groq request failed (${response.status}): ${body.slice(0, 200)}`,
      response.status
    );
    if (!isRetryable(response.status) || attempt === MAX_ATTEMPTS) throw lastError;
    console.warn(
      `[Groq] Transient ${response.status}; retry ${attempt}/${MAX_ATTEMPTS - 1}`
    );
    await delay(attempt);
  }

  throw lastError;
}

/** Exponential backoff with jitter, capped at 8s. */
function delay(attempt: number): Promise<void> {
  const ms = Math.min(700 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 300);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
