import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export const getAiClient = getGeminiClient;

export const RECOMMENDED_GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
] as const;

export class GeminiServiceError extends Error {
  public isDemandOrRateLimit: boolean;
  public status?: string;
  public statusCode?: number;

  constructor(message: string, originalError?: any) {
    super(message);
    this.name = 'GeminiServiceError';
    const msg = String(originalError?.message || message);
    const status = String(originalError?.status || '');
    this.status = status;
    this.isDemandOrRateLimit =
      msg.includes('503') ||
      msg.includes('429') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('high demand') ||
      msg.includes('Quota exceeded') ||
      status === 'UNAVAILABLE' ||
      status === 'RESOURCE_EXHAUSTED';
  }
}

export interface GeminiGenerateOptions {
  contents: any;
  config?: any;
  preferredModel?: string;
  abortSignal?: AbortSignal;
}

/**
 * Executes a Gemini model generation call with automatic resilient fallback
 * across modern Flash models if a specific model is busy (503), rate-limited (429), or deprecated (404).
 */
export async function generateWithGemini(
  options: GeminiGenerateOptions,
  clientOverride?: GoogleGenAI
) {
  const client = clientOverride || getGeminiClient();
  if (!client) {
    throw new GeminiServiceError('Gemini API key is not configured');
  }

  if (options.abortSignal?.aborted) {
    throw new Error('Operation was cancelled');
  }

  const candidateModels: string[] = [];
  if (options.preferredModel) {
    candidateModels.push(options.preferredModel);
  }
  for (const m of RECOMMENDED_GEMINI_MODELS) {
    if (!candidateModels.includes(m)) {
      candidateModels.push(m);
    }
  }

  let lastError: any = null;

  for (const model of candidateModels) {
    if (options.abortSignal?.aborted) {
      throw new Error('Operation was cancelled');
    }

    try {
      const generatePromise = client.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout calling Gemini model ${model}`)), 8000)
      );

      const abortPromise = options.abortSignal
        ? new Promise((_, reject) => {
            if (options.abortSignal?.aborted) {
              reject(new Error('Operation was cancelled'));
            } else {
              options.abortSignal?.addEventListener('abort', () => reject(new Error('Operation was cancelled')), { once: true });
            }
          })
        : null;

      const racePromises = abortPromise ? [generatePromise, timeoutPromise, abortPromise] : [generatePromise, timeoutPromise];
      const response = (await Promise.race(racePromises)) as any;
      return response;
    } catch (err: any) {
      if (err.message === 'Operation was cancelled' || options.abortSignal?.aborted) {
        throw err;
      }
      lastError = err;
      // Try next candidate model seamlessly if 404, 503 (high demand), 429 (rate limit), or timeout
      continue;
    }
  }

  throw new GeminiServiceError(
    lastError?.message || 'All candidate Gemini models failed to respond',
    lastError
  );
}
