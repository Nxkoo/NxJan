/* eslint-disable react-refresh/only-export-components */
import { useControllableState } from '@radix-ui/react-use-controllable-state'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { ToolUIPart } from 'ai'
import { ChevronDownIcon, WrenchIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import {
  createContext,
  isValidElement,
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CodeBlock } from './code-block'
import { useToolApproval } from '@/hooks/useToolApproval'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { Button } from '@/components/ui/button'
import { ShieldAlertIcon } from 'lucide-react'
import { Citations } from '@/components/Citations'
import { parseCitationsFromToolOutput } from '@/lib/citation-parser'
import { formatToolCallDisplay } from '@/lib/codebase-tool-format'

type ToolContextValue = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  state: ToolUIPart['state']
  toolCallId?: string
  messageId?: string
}

const ToolContext = createContext<ToolContextValue | null>(null)

export const useTool = () => {
  const context = useContext(ToolContext)
  if (!context) {
    throw new Error('Tool components must be used within Tool')
  }
  return context
}

export type ToolProps = ComponentProps<typeof Collapsible> & {
  className?: string
  state: ToolUIPart['state']
  toolCallId?: string
  messageId?: string
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export const Tool = memo(
  ({
    className,
    state,
    toolCallId,
    messageId,
    open,
    defaultOpen = false,
    onOpenChange,
    children,
    ...props
  }: ToolProps) => {
    const isPending = useToolApproval((s) =>
      toolCallId ? Boolean(s.pending[toolCallId]) : false
    )
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen || isPending,
      onChange: onOpenChange,
    })

    const wasPendingRef = useRef(isPending)
    useEffect(() => {
      if (isPending && !wasPendingRef.current) {
        setIsOpen(true)
      } else if (!isPending && wasPendingRef.current) {
        setIsOpen(false)
      }
      wasPendingRef.current = isPending
    }, [isPending, setIsOpen])

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen)
    }

    return (
      <ToolContext.Provider
        value={{ isOpen, setIsOpen, state, toolCallId, messageId }}
      >
        <Collapsible
          className={cn('not-prose', className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ToolContext.Provider>
    )
  }
)

export type ToolHeaderProps = {
  title?: string
  state: ToolUIPart['state']
  type: ToolUIPart['type']
  className?: string
  summary?: ReactNode
  statusText?: string
}

const getStatusText = (
  status: ToolUIPart['state'],
  toolName: string,
  awaitingApproval: boolean
) => {
  const isRunning = status === 'input-streaming' || status === 'input-available'
  const hasError = status === 'output-error' || status === 'output-denied'

  if (awaitingApproval) {
    return `Awaiting approval: ${toolName.replaceAll('_', ' ')}`
  }
  if (isRunning) {
    return `Running ${toolName.replaceAll('_', ' ')}...`
  }
  if (hasError) {
    return `${toolName.replaceAll('_', ' ')} failed`
  }
  return `Used ${toolName.replaceAll('_', ' ')}`
}

export const ToolHeader = memo(
  ({ className, title, state, type, summary, statusText }: ToolHeaderProps) => {
    const { isOpen, toolCallId } = useTool()
    const awaitingApproval = useToolApproval((s) =>
      toolCallId ? Boolean(s.pending[toolCallId]) : false
    )
    const toolName = title ?? type.split('-').slice(1).join('-')

    return (
      <CollapsibleTrigger
        className={cn(
          'cursor-pointer flex w-full min-w-0 items-start gap-2 rounded-2xl px-3 py-2 text-sm transition-colors',
          !isOpen && 'hover:bg-surface-3',
          className
        )}
      >
        {awaitingApproval ? (
          <ShieldAlertIcon className="size-4 shrink-0 text-amber-500" />
        ) : (
          <WrenchIcon className="size-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 text-left">
          <span
            className={cn(
              'block truncate font-medium text-foreground',
              awaitingApproval && 'text-amber-600 dark:text-amber-400'
            )}
          >
            {statusText ?? getStatusText(state, toolName, awaitingApproval)}
          </span>
          {summary && (
            <span className="mt-1 block min-w-0 overflow-hidden normal-case text-muted-foreground">
              {summary}
            </span>
          )}
        </span>
        <ChevronDownIcon
          className={cn(
            'mt-0.5 size-4 shrink-0 transition-transform',
            isOpen ? 'rotate-180' : 'rotate-0'
          )}
        />
      </CollapsibleTrigger>
    )
  }
)

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>

export const ToolContent = memo(
  ({ className, children, ...props }: ToolContentProps) => (
      <CollapsibleContent
        className={cn(
        'overflow-hidden text-sm relative data-[state=open]:mt-2',
        'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
        className
      )}
      {...props}
    >
      <div className="ml-4 min-w-0 space-y-3 border-l border-dashed border-border-soft pl-4">
        {children}
      </div>
    </CollapsibleContent>
  )
)

export type ToolInputProps = ComponentProps<'div'> & {
  input: ToolUIPart['input']
}

export const ToolInput = memo(
  ({ className, input, ...props }: ToolInputProps) => {
    const { isOpen } = useTool()
    const formattedDisplay = useMemo(
      () => formatToolCallDisplay('tool', input, undefined),
      [input]
    )
    const formatted = useMemo(() => {
      let value: unknown = input
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value)
        } catch {
          return value as string
        }
      }
      try {
        return JSON.stringify(value, null, 2)
      } catch {
        return String(value)
      }
    }, [input])

    return (
      <div className={cn('space-y-2', className)} {...props}>
        <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Parameters
        </h4>
        {formattedDisplay.params.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border-soft bg-surface-3">
            {formattedDisplay.params.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[7rem_1fr] border-b border-border-soft last:border-b-0"
              >
                <div className="bg-surface-2 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                  {row.key}
                </div>
                <div className="min-w-0 break-words px-2 py-1.5 font-mono text-[11px] text-foreground">
                  {row.value || '-'}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {isOpen && (
          <details className="rounded-xl border border-border-soft bg-surface-3 p-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Raw parameters
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-2 text-[11px] text-foreground">
              {formatted}
            </pre>
          </details>
        )}
      </div>
    )
  }
)

export const ToolApprovalActions = memo(() => {
  const { t } = useTranslation()
  const { toolCallId } = useTool()
  const pending = useToolApproval((s) =>
    toolCallId ? s.pending[toolCallId] : undefined
  )
  const resolveApproval = useToolApproval((s) => s.resolveApproval)

  if (!pending || !toolCallId) return null

  return (
    <div className="mt-4 space-y-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-medium">
        <ShieldAlertIcon className="size-4" />
        <span>{t('tools:toolApproval.needsApproval')}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="destructive"
          onClick={() => resolveApproval(toolCallId, 'deny')}
        >
          {t('tools:toolApproval.deny')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => resolveApproval(toolCallId, 'allow-once')}
        >
          {t('tools:toolApproval.allowOnce')}
        </Button>
        <Button
          size="sm"
          autoFocus
          onClick={() => resolveApproval(toolCallId, 'allow-always')}
        >
          {t('tools:toolApproval.alwaysAllow')}
        </Button>
      </div>
    </div>
  )
})

type ToolImageProps = {
  data: string
  index: number
  resolver: (input: string) => Promise<string>
}

const ToolImage = memo(({ data, index }: ToolImageProps) => {
  // Prepare the URL - convert base64 to data URL if needed
  const [preparedUrl, setPreparedUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (data.startsWith('data:image') || data.startsWith('http')) {
      // Already a data URL or HTTP URL
      setPreparedUrl(data)
    } else {
      // Assume it's base64 encoded
      setPreparedUrl(`data:image/png;base64,${data}`)
    }
  }, [data])

  const isLoading = !preparedUrl

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <div className="flex size-24 items-center justify-center rounded-md bg-muted">
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (!preparedUrl) {
    return null
  }

  return (
    <div key={index} className="inline-block">
      <img
        src={preparedUrl}
        alt="Tool output"
        className="max-w-full max-h-96 w-auto h-auto object-contain rounded-md border"
      />
    </div>
  )
})

export type ToolOutputProps = ComponentProps<'div'> & {
  output: ToolUIPart['output']
  errorText: ToolUIPart['errorText']
  resolver: (input: string) => Promise<string>
  // Running count of citations from earlier tool calls in this turn, so each
  // card's numbering/anchors continue the global sequence the markers use.
  citationOffset?: number
}

export const ToolOutput = memo(
  ({
    className,
    output,
    errorText,
    resolver,
    citationOffset = 0,
    ...props
  }: ToolOutputProps) => {
    const { messageId, isOpen } = useTool()
    const formattedOutput = useMemo(
      () => formatToolCallDisplay('tool', undefined, output),
      [output]
    )
    const citationPayload = useMemo(
      () => (output ? parseCitationsFromToolOutput(output) : null),
      [output]
    )

    const Output = useMemo(() => {
      if (!(output || errorText)) {
        return null
      }

      if (citationPayload) {
        return (
          <Citations
            payload={citationPayload}
            anchorPrefix={messageId ? `cite-${messageId}` : undefined}
            indexOffset={citationOffset}
          />
        )
      }

      // Handle string output
      if (typeof output === 'string') {
        return (
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border-soft bg-surface-3 p-3 text-[11px] text-foreground">
            {output}
          </pre>
        )
      }

      if (typeof output === 'object' && !isValidElement(output)) {
        // Check if output has content array (new structure: {content: [{text, type}, {data, type: image}]})
        if (
          output &&
          typeof output === 'object' &&
          'content' in output &&
          Array.isArray(output.content)
        ) {
          const content = output.content as Array<{
            type: string
            text?: string
            data?: string
            mimeType?: string
          }>

          const textItems = content.filter((item) => item.type === 'text')
          const imageItems = content.filter((item) => item.type === 'image')

          return (
            <div className="space-y-4">
              {textItems.length > 0 && (
                <div className="space-y-2">
                  {textItems.map((item, index) => (
                    <pre
                      key={index}
                      className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border-soft bg-surface-3 p-3 text-[11px] text-foreground"
                    >
                      {item.text || ''}
                    </pre>
                  ))}
                </div>
              )}
              {imageItems.length > 0 && (
                <div className="space-y-2">
                  {imageItems.map((item, index) => (
                    <ToolImage
                      key={index}
                      data={item.data || ''}
                      index={index}
                      resolver={resolver}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        }

        // Handle old array format for backward compatibility
        if (Array.isArray(output)) {
          const hasImages = output.some(
            (item) => item?.type === 'image' && (item?.data || item?.image)
          )

          if (hasImages) {
            // Filter out images from JSON and render images separately
            const nonImageOutput = output.filter(
              (item) => item?.type !== 'image'
            )

            return (
              <div className="space-y-4">
                {nonImageOutput.length > 0 && (
                  <div className="rounded-md max-h-40 overflow-auto rounded-md border border-border-soft ">
                    <CodeBlock code={JSON.stringify(nonImageOutput, null, 2)} language="json" />
                  </div>
                )}
                {output
                  .filter(
                    (item) =>
                      item?.type === 'image' && (item?.data || item?.image?.url)
                  )
                  .map((item, index) => (
                    <ToolImage
                      key={index}
                      data={item.data ?? item.image?.url}
                      index={index}
                      resolver={resolver}
                    />
                  ))}
              </div>
            )
          }

          return (
            <div className="rounded-xl max-h-56 overflow-auto border border-border-soft bg-surface-3">
              <CodeBlock
                code={JSON.stringify(output, null, 2)}
                language="json"
              />
            </div>
          )
        }

        // Handle regular object
        return (
          <div className="rounded-xl max-h-56 overflow-auto border border-border-soft bg-surface-3">
            <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
          </div>
        )
      }

      return <div>{output as ReactNode}</div>
    }, [output, errorText, resolver, citationPayload, messageId, citationOffset])

    if (!(output || errorText)) {
      return null
    }

    return (
      <div className={cn('space-y-2 mt-4', className)} {...props}>
        <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {errorText ? 'Error' : 'Result'}
        </h4>
        <div className="rounded-md overflow-hidden">
          {errorText && (
            <div className="m-2 p-2 bg-destructive/10 text-destructive rounded-md">
              {errorText}
            </div>
          )}
          {!errorText && !citationPayload && formattedOutput.snippets.length > 0 && (
            <div className="mb-2 space-y-2">
              {formattedOutput.snippets.slice(0, 2).map((snippet, index) => (
                <pre
                  key={`${index}-${snippet.slice(0, 20)}`}
                  className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border-soft bg-surface-3 p-3 font-mono text-[11px] text-foreground"
                >
                  {snippet.length > 600
                    ? `${snippet.slice(0, 600)}…`
                    : snippet}
                </pre>
              ))}
            </div>
          )}
          {Output && (citationPayload || formattedOutput.snippets.length === 0)
            ? Output
            : null}
          {!errorText && isOpen && (
            <details className="rounded-xl border border-border-soft bg-surface-3 p-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Raw JSON result
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-2 text-[11px] text-foreground">
                {formattedOutput.rawOutput}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
)

Tool.displayName = 'Tool'
ToolHeader.displayName = 'ToolHeader'
ToolContent.displayName = 'ToolContent'
ToolInput.displayName = 'ToolInput'
ToolOutput.displayName = 'ToolOutput'
ToolApprovalActions.displayName = 'ToolApprovalActions'
