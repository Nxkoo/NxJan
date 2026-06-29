import { useEffect, useMemo, useRef, useState } from 'react'
import { ThreadMessage } from '@janhq/core'
import { ExtensionManager } from '@/lib/extension'
import { parseContextOverflow } from '@/utils/error'
import { useModelProvider } from './useModelProvider'
import { useModelsDev } from './useModelsDev'
import {
  calcCostFromUsage,
  getModelLimit,
  getModelPricing,
  type ModelsDevPricing,
} from '@/lib/modelsDev'

export interface ModelProps {
  nCtx: number
  totalSlots?: number
  modelAlias?: string
  isSleeping?: boolean
}

/**
 * Source of the max-context denominator. Used to decide whether to
 * label the counter "Local" (engine-reported) or just show the raw
 * catalog value.
 */
export type MaxTokensSource = 'engine' | 'catalog' | 'overflow' | 'unknown'

/**
 * Source of the dollar cost. OpenRouter returns `usage.cost` in the
 * streaming body so it wins over the catalog estimate when present.
 */
export type CostSource = 'catalog' | 'openrouter' | 'local' | 'unknown'

export interface TokenCountData {
  tokenCount: number
  inputTokens?: number
  outputTokens?: number
  maxTokens?: number
  maxTokensSource?: MaxTokensSource
  percentage?: number
  isNearLimit: boolean
  loading: boolean
  modelProps?: ModelProps
  modelDisplayName?: string
  fitEnabled: boolean
  configuredCtxLen?: number
  modalities?: { vision: boolean; audio: boolean }
  error?: string
  isOverflow?: boolean
  /** Accumulated USD cost for the current thread, when available. */
  cost?: number
  costSource?: CostSource
  /** True if a pricing entry is available for the active model. */
  pricingAvailable: boolean
  /** True if max context is available (engine, catalog, or overflow). */
  maxAvailable: boolean
}

interface UsageMeta {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost?: number
}

interface LlamacppExtensionLike {
  getModelProps?: (modelId: string) => Promise<ModelProps | undefined>
}

// The token-usage popup normally reflects the last *successful* turn. When a
// request overflows, that turn is never recorded, so the popup would keep
// showing a comfortable percentage next to an "out of context" error. Parse
// the failing request's counts out of the stamped contextError so the popup
// reflects the request that actually overflowed.
const getActiveContextOverflow = (messages: ThreadMessage[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const ctx = (messages[i].metadata as { contextError?: unknown } | undefined)
      ?.contextError
    if (typeof ctx === 'string' && ctx.length > 0) return parseContextOverflow(ctx)
    return null
  }
  return null
}

const getLatestServerUsage = (messages: ThreadMessage[]): UsageMeta => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const usage = (messages[i].metadata as { usage?: UsageMeta } | undefined)
      ?.usage
    if (usage && typeof usage.totalTokens === 'number' && usage.totalTokens > 0)
      return usage
  }
  return {}
}

const getLlamacppExtension = (): LlamacppExtensionLike | undefined => {
  const mgr = ExtensionManager.getInstance()
  const candidates = [
    mgr.getByName('@janhq/llamacpp-extension'),
    mgr.getByName('llamacpp-extension'),
  ]
  for (const c of candidates) {
    if (c && typeof (c as LlamacppExtensionLike).getModelProps === 'function')
      return c as LlamacppExtensionLike
  }
  return mgr.listExtensions().find(
    (ext) =>
      typeof (ext as LlamacppExtensionLike).getModelProps === 'function'
  ) as LlamacppExtensionLike | undefined
}

const readSettingNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

const isLocalProvider = (id: string | null | undefined): boolean =>
  id === 'llamacpp' || id === 'mlx'

interface SessionCost {
  cost: number
  source: CostSource
}

const accumulateSessionCost = (
  messages: ThreadMessage[],
  pricing: ModelsDevPricing | null
): SessionCost | null => {
  let total = 0
  let fromOpenRouter = false
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    const usage = (m.metadata as { usage?: UsageMeta } | undefined)?.usage
    if (!usage) continue
    if (typeof usage.cost === 'number' && usage.cost > 0) {
      total += usage.cost
      fromOpenRouter = true
      continue
    }
    if (pricing && typeof usage.inputTokens === 'number' && typeof usage.outputTokens === 'number') {
      total += calcCostFromUsage(
        pricing,
        usage.inputTokens,
        usage.outputTokens
      )
    }
  }
  if (total <= 0 && !fromOpenRouter) return null
  return { cost: total, source: fromOpenRouter ? 'openrouter' : 'catalog' }
}

export const useTokensCount = (messages: ThreadMessage[] = []) => {
  const { selectedModel, selectedProvider, getProviderByName } =
    useModelProvider()
  const catalog = useModelsDev((s) => s.catalog)
  const ensureCatalog = useModelsDev((s) => s.ensureLoaded)
  const [modelProps, setModelProps] = useState<ModelProps | undefined>(
    undefined
  )
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  // Always kick off a catalog fetch in the background on first
  // mount so the next render has the data. Cheap and idempotent.
  useEffect(() => {
    void ensureCatalog()
  }, [ensureCatalog])

  const modelId =
    selectedProvider && isLocalProvider(selectedProvider) ? selectedModel?.id : selectedModel?.id

  useEffect(() => {
    if (!modelId) {
      setModelProps(undefined)
      setLoading(false)
      return
    }
    if (!isLocalProvider(selectedProvider)) {
      // Remote providers report nCtx through the catalog, not the
      // local engine. Skip the extension probe.
      setModelProps(undefined)
      setLoading(false)
      return
    }
    const ext = getLlamacppExtension()
    if (!ext?.getModelProps) {
      setModelProps(undefined)
      return
    }
    const id = ++reqId.current
    setLoading(true)
    ext
      .getModelProps(modelId)
      .then((props) => {
        if (id !== reqId.current) return
        setModelProps(props)
      })
      .catch(() => {
        if (id !== reqId.current) return
        setModelProps(undefined)
      })
      .finally(() => {
        if (id !== reqId.current) return
        setLoading(false)
      })
  }, [modelId, selectedProvider, messages.length])

  const tokenData: TokenCountData = useMemo(() => {
    if (!modelId) {
      return {
        tokenCount: 0,
        loading: false,
        isNearLimit: false,
        fitEnabled: false,
        pricingAvailable: false,
        maxAvailable: false,
      }
    }
    const overflow = getActiveContextOverflow(messages)
    const usage = getLatestServerUsage(messages)
    const tokenCount = overflow?.requestTokens ?? usage.totalTokens ?? 0

    // Resolve max context in priority order:
    //   1. overflow.contextTokens — what the engine said the request blew past
    //   2. modelProps.nCtx — llamacpp/MLX engine-reported (only for local)
    //   3. models.dev catalog — works for any provider, including remote
    let maxTokens: number | undefined
    let maxTokensSource: MaxTokensSource = 'unknown'
    if (overflow?.contextTokens) {
      maxTokens = overflow.contextTokens
      maxTokensSource = 'overflow'
    } else if (modelProps?.nCtx) {
      maxTokens = modelProps.nCtx
      maxTokensSource = 'engine'
    } else {
      const catalogLimit = getModelLimit(catalog, selectedProvider, modelId)
      if (catalogLimit != null) {
        maxTokens = catalogLimit
        maxTokensSource = 'catalog'
      }
    }

    const percentage =
      maxTokens && maxTokens > 0 ? (tokenCount / maxTokens) * 100 : undefined
    const isNearLimit =
      overflow != null || (percentage ? percentage > 85 : false)

    // fit/configured ctx_len are llamacpp-specific affordances; the
    // chip in expanded mode still uses them.
    const llamacppProvider = isLocalProvider(selectedProvider)
      ? getProviderByName('llamacpp')
      : undefined
    const fitEnabled =
      llamacppProvider?.settings?.find((s) => s.key === 'fit')?.controller_props
        ?.value === true
    const configuredCtxLen = llamacppProvider
      ? readSettingNumber(
          selectedModel?.settings?.ctx_len?.controller_props?.value
        )
      : undefined
    const modelDisplayName =
      modelProps?.modelAlias || selectedModel?.name || modelId
    const caps = selectedModel?.capabilities ?? []
    const modalities = llamacppProvider
      ? {
          vision: caps.includes('vision'),
          audio: caps.includes('audio'),
        }
      : undefined

    // Cost resolution: only for remote (catalog) providers — local
    // engines never bill. OpenRouter overrides with the per-turn
    // `usage.cost` returned in the streaming body when present.
    let cost: number | undefined
    let costSource: CostSource = 'unknown'
    let pricingAvailable = false
    if (!llamacppProvider) {
      const pricing = getModelPricing(catalog, selectedProvider, modelId)
      if (pricing) {
        const session = accumulateSessionCost(messages, pricing)
        if (session) {
          cost = session.cost
          costSource = session.source
        }
        pricingAvailable = true
      } else if (isLocalProvider(selectedProvider)) {
        costSource = 'local'
      }
    } else if (isLocalProvider(selectedProvider)) {
      costSource = 'local'
    }

    const inputTokens = overflow ? overflow.requestTokens : usage.inputTokens
    const outputTokens = overflow ? 0 : usage.outputTokens

    return {
      tokenCount,
      inputTokens,
      outputTokens,
      maxTokens,
      maxTokensSource,
      percentage,
      isNearLimit,
      loading,
      modelProps,
      modelDisplayName,
      fitEnabled,
      configuredCtxLen,
      modalities,
      isOverflow: overflow != null,
      cost,
      costSource,
      pricingAvailable,
      maxAvailable: typeof maxTokens === 'number' && maxTokens > 0,
    }
  }, [
    messages,
    modelId,
    selectedProvider,
    modelProps,
    loading,
    getProviderByName,
    selectedModel?.name,
    selectedModel?.capabilities,
    selectedModel?.settings?.ctx_len?.controller_props?.value,
    catalog,
  ])

  return {
    ...tokenData,
    calculateTokens: async () => undefined,
  }
}
