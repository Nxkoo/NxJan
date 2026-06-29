/**
 * Client for https://models.dev — the open-source catalog of AI model
 * specifications, pricing, and capabilities maintained by the OpenCode
 * team (SST/anomalyco). Used as the dynamic source of truth for
 * `max_context` and per-token pricing across remote providers, so the
 * NxJan token counter can show real numbers without hardcoding model
 * tables.
 *
 * Schema is the same one models.dev exposes at `/api.json` (provider
 * id → provider entry → models map → model entry). Only the fields
 * NxJan cares about are typed; everything else is preserved on the
 * entry to stay forward-compatible.
 */

export interface ModelsDevCost {
  input?: number
  output?: number
  reasoning?: number
  cache_read?: number
  cache_write?: number
  input_audio?: number
  output_audio?: number
}

export interface ModelsDevLimit {
  context?: number
  input?: number
  output?: number
}

export interface ModelsDevModalities {
  input?: string[]
  output?: string[]
}

export interface ModelsDevModelEntry {
  name?: string
  attachment?: boolean
  reasoning?: boolean
  tool_call?: boolean
  structured_output?: boolean
  temperature?: boolean
  knowledge?: string
  release_date?: string
  last_updated?: string
  open_weights?: boolean
  status?: 'alpha' | 'beta' | 'deprecated'
  cost?: ModelsDevCost
  limit?: ModelsDevLimit
  modalities?: ModelsDevModalities
  base_model?: string
  [key: string]: unknown
}

export interface ModelsDevProviderEntry {
  id?: string
  name?: string
  models?: Record<string, ModelsDevModelEntry>
  [key: string]: unknown
}

export type ModelsDevCatalog = Record<string, ModelsDevProviderEntry>

export const MODELS_DEV_ENDPOINT = 'https://models.dev/api.json'
export const MODELS_DEV_TIMEOUT_MS = 10_000

export async function fetchCatalog(signal?: AbortSignal): Promise<ModelsDevCatalog> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), MODELS_DEV_TIMEOUT_MS)
  const onAbort = () => ctl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(MODELS_DEV_ENDPOINT, { signal: ctl.signal })
    if (!res.ok) {
      throw new Error(`models.dev returned ${res.status} ${res.statusText}`)
    }
    const data = (await res.json()) as unknown
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid models.dev catalog payload')
    }
    return data as ModelsDevCatalog
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export function getModelEntry(
  catalog: ModelsDevCatalog | null | undefined,
  providerId: string | null | undefined,
  modelId: string | null | undefined
): ModelsDevModelEntry | null {
  if (!catalog || !providerId || !modelId) return null
  const provider = catalog[providerId]
  if (!provider || !provider.models) return null
  const direct = provider.models[modelId]
  if (direct) return direct
  // Some providers serve models under a namespaced id like
  // "deepseek/deepseek-r1" while the user's selectedModel.id is the
  // bare "deepseek-r1". models.dev stores the provider prefix in the
  // key, so attempt a namespaced match as a fallback.
  for (const key of Object.keys(provider.models)) {
    if (key === modelId || key.endsWith(`/${modelId}`)) {
      return provider.models[key] ?? null
    }
  }
  return null
}

export function getModelLimit(
  catalog: ModelsDevCatalog | null | undefined,
  providerId: string | null | undefined,
  modelId: string | null | undefined
): number | null {
  const entry = getModelEntry(catalog, providerId, modelId)
  const ctx = entry?.limit?.context
  if (typeof ctx !== 'number' || !Number.isFinite(ctx) || ctx <= 0) return null
  return ctx
}

export interface ModelsDevPricing {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
  reasoning?: number
}

/**
 * Returns per-million-token USD pricing, or null if no entry or both
 * input/output are zero/unknown. A zero/zero entry (e.g. open-weights
 * self-hosted) is intentionally treated as "no pricing" so the UI can
 * render the "Local" label instead of $0.00.
 */
export function getModelPricing(
  catalog: ModelsDevCatalog | null | undefined,
  providerId: string | null | undefined,
  modelId: string | null | undefined
): ModelsDevPricing | null {
  const entry = getModelEntry(catalog, providerId, modelId)
  const input = entry?.cost?.input
  const output = entry?.cost?.output
  if (typeof input !== 'number' || typeof output !== 'number') return null
  if (input === 0 && output === 0) return null
  const pricing: ModelsDevPricing = { input, output }
  if (typeof entry?.cost?.cache_read === 'number') pricing.cacheRead = entry.cost.cache_read
  if (typeof entry?.cost?.cache_write === 'number') pricing.cacheWrite = entry.cost.cache_write
  if (typeof entry?.cost?.reasoning === 'number') pricing.reasoning = entry.cost.reasoning
  return pricing
}

export function calcCostFromUsage(
  pricing: ModelsDevPricing,
  inputTokens: number,
  outputTokens: number
): number {
  const input = (pricing.input * Math.max(0, inputTokens)) / 1_000_000
  const output = (pricing.output * Math.max(0, outputTokens)) / 1_000_000
  return input + output
}
