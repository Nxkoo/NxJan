import { describe, expect, it } from 'vitest'
import {
  MODELS_DEV_ENDPOINT,
  calcCostFromUsage,
  getModelEntry,
  getModelLimit,
  getModelPricing,
  type ModelsDevCatalog,
} from '../modelsDev'

const sampleCatalog: ModelsDevCatalog = {
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    models: {
      'MiniMax-M2.7': {
        name: 'MiniMax-M2.7',
        cost: { input: 0.18, output: 0.72 },
        limit: { context: 204_800, output: 131_072 },
      },
      'MiniMax-M2.7-highspeed': {
        cost: { input: 0.33, output: 1.32 },
        limit: { context: 204_800 },
      },
      // Open-weights / local-priced entry: zero/zero should be
      // treated as "no pricing" so the UI can render a "Local" label.
      'local-gguf': {
        cost: { input: 0, output: 0 },
        limit: { context: 32_768 },
      },
      'gpt-4o': {
        cost: { input: 2.5, output: 10 },
        limit: { context: 128_000 },
      },
    },
  },
  anthropic: {
    id: 'anthropic',
    models: {
      'claude-sonnet-4-6': {
        cost: { input: 3, output: 15, cache_read: 0.3 },
        limit: { context: 1_000_000 },
      },
    },
  },
  // A namespaced id like the way some provider model ids appear in
  // models.dev (provider/ModelId).
  openai: {
    id: 'openai',
    models: {
      'openai/gpt-4o': {
        cost: { input: 2.5, output: 10 },
        limit: { context: 128_000 },
      },
    },
  },
}

describe('getModelEntry', () => {
  it('returns the matching entry for a provider/modelId pair', () => {
    expect(getModelEntry(sampleCatalog, 'minimax', 'MiniMax-M2.7')?.name).toBe(
      'MiniMax-M2.7'
    )
  })

  it('returns null for an unknown provider', () => {
    expect(getModelEntry(sampleCatalog, 'no-such', 'm')).toBeNull()
  })

  it('returns null for an unknown model id', () => {
    expect(getModelEntry(sampleCatalog, 'minimax', 'no-such')).toBeNull()
  })

  it('falls back to a namespaced id when the bare id is missing', () => {
    // The user's selectedModel.id is "gpt-4o" but the catalog key is
    // "openai/gpt-4o". getModelEntry should still resolve it.
    expect(getModelEntry(sampleCatalog, 'openai', 'gpt-4o')?.limit?.context).toBe(
      128_000
    )
  })

  it('handles a null or undefined catalog gracefully', () => {
    expect(getModelEntry(null, 'minimax', 'MiniMax-M2.7')).toBeNull()
    expect(getModelEntry(undefined, 'minimax', 'MiniMax-M2.7')).toBeNull()
  })
})

describe('getModelLimit', () => {
  it('returns the catalog max context for the active model', () => {
    expect(getModelLimit(sampleCatalog, 'minimax', 'MiniMax-M2.7')).toBe(204_800)
  })

  it('returns null when the entry is missing', () => {
    expect(getModelLimit(sampleCatalog, 'no-such', 'm')).toBeNull()
  })

  it('returns null when the limit block is absent', () => {
    const catalog: ModelsDevCatalog = {
      x: { id: 'x', models: { y: { name: 'y' } } },
    }
    expect(getModelLimit(catalog, 'x', 'y')).toBeNull()
  })
})

describe('getModelPricing', () => {
  it('returns per-million USD pricing when both fields are present', () => {
    expect(getModelPricing(sampleCatalog, 'minimax', 'MiniMax-M2.7')).toEqual({
      input: 0.18,
      output: 0.72,
    })
  })

  it('includes cacheRead/cacheWrite/reasoning when set on the entry', () => {
    expect(
      getModelPricing(sampleCatalog, 'anthropic', 'claude-sonnet-4-6')
    ).toEqual({
      input: 3,
      output: 15,
      cacheRead: 0.3,
    })
  })

  it('returns null for a zero/zero entry (open-weights / self-hosted)', () => {
    expect(
      getModelPricing(sampleCatalog, 'minimax', 'local-gguf')
    ).toBeNull()
  })

  it('returns null when pricing fields are missing', () => {
    const catalog: ModelsDevCatalog = {
      x: { id: 'x', models: { y: { name: 'y' } } },
    }
    expect(getModelPricing(catalog, 'x', 'y')).toBeNull()
  })
})

describe('calcCostFromUsage', () => {
  it('multiplies per-million pricing by token counts', () => {
    // 1M input @ $0.18 + 100k output @ $0.72 = $0.18 + $0.072 = $0.252
    expect(calcCostFromUsage({ input: 0.18, output: 0.72 }, 1_000_000, 100_000)).toBeCloseTo(0.252)
  })

  it('returns 0 for zero tokens', () => {
    expect(calcCostFromUsage({ input: 0.18, output: 0.72 }, 0, 0)).toBe(0)
  })

  it('clamps negative inputs to 0', () => {
    expect(calcCostFromUsage({ input: 0.18, output: 0.72 }, -1, -1)).toBe(0)
  })
})

describe('endpoint constant', () => {
  it('points at the public models.dev api.json endpoint', () => {
    expect(MODELS_DEV_ENDPOINT).toBe('https://models.dev/api.json')
  })
})
