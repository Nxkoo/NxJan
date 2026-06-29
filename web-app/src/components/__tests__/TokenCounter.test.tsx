import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TokenCounter } from '../TokenCounter'
import { useTokensCount } from '@/hooks/useTokensCount'
vi.mock('@/hooks/useTokensCount', () => ({
  useTokensCount: vi.fn(),
}))

// i18n in tests: useTranslation returns a humanized form of the key
// so existing assertions on "Context window" / "Used" / "Remaining"
// still match without spinning up a real provider. Pluralizes the
// {{value}} interpolation that TokenCounter passes through.
vi.mock('@/i18n/react-i18next-compat', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const last = key.includes(':') ? key.split(':').pop()! : key
      const humanized = last
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (c) => c.toUpperCase())
        .trim()
      if (!params) return humanized
      return humanized.replace(
        /\{\{(\w+)\}\}/g,
        (_, k) => String(params[k] ?? '')
      )
    },
    i18n: { language: 'en' },
    ready: true,
  }),
}))

// Mock tooltip components to render inline (Radix Portal + closed state prevents content from appearing in jsdom)
vi.mock('@/components/ui/tooltip', async () => {
  const React = await import('react')
  return {
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: React.forwardRef(({ children, asChild, ...props }: any, ref: any) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement, { ...props, ref })
      }
      return <span {...props} ref={ref}>{children}</span>
    }),
    TooltipContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tooltip-content">{children}</div>
    ),
  }
})

const mockUseTokensCount = vi.mocked(useTokensCount)

function mockTokens(overrides: Partial<ReturnType<typeof useTokensCount>> = {}) {
  const defaults = {
    tokenCount: 0,
    maxTokens: 1000,
    calculateTokens: vi.fn(),
    ...overrides,
  }
  mockUseTokensCount.mockReturnValue(defaults)
  return defaults
}

describe('TokenCounter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTokens()
  })

  it('renders 0.0% when no messages and zero tokens', () => {
    render(<TokenCounter />)
    expect(screen.getAllByText('0.0%').length).toBeGreaterThanOrEqual(1)
  })

  it('renders correct percentage based on token count / max tokens', () => {
    mockTokens({ tokenCount: 500, maxTokens: 1000 })
    render(<TokenCounter />)
    expect(screen.getAllByText('50.0%').length).toBeGreaterThanOrEqual(1)
  })

  it('renders percentage with additionalTokens included', () => {
    mockTokens({ tokenCount: 200, maxTokens: 1000 })
    render(<TokenCounter additionalTokens={300} />)
    expect(screen.getAllByText('50.0%').length).toBeGreaterThanOrEqual(1)
  })

  it('applies destructive styling when over limit (>100%)', () => {
    mockTokens({ tokenCount: 1500, maxTokens: 1000 })
    render(<TokenCounter />)
    const percentElements = screen.getAllByText('150.0%')
    expect(percentElements.length).toBeGreaterThanOrEqual(1)
    const span = percentElements[0]
    expect(span.className).toContain('text-destructive')
  })

  it('applies primary styling when under limit', () => {
    mockTokens({ tokenCount: 500, maxTokens: 1000 })
    render(<TokenCounter />)
    const percentElements = screen.getAllByText('50.0%')
    const span = percentElements[0]
    expect(span.className).toContain('text-foreground')
    expect(span.className).not.toContain('text-destructive')
    expect(span.className).not.toContain('text-amber-500')
  })

  it('calls calculateTokens when clicked', async () => {
    const user = userEvent.setup()
    const mocks = mockTokens({ tokenCount: 500, maxTokens: 1000 })
    const { container } = render(<TokenCounter />)
    const clickable = container.querySelector('.cursor-pointer')!
    await user.click(clickable)
    expect(mocks.calculateTokens).toHaveBeenCalledTimes(1)
  })

  it('renders the SVG progress ring', () => {
    mockTokens({ tokenCount: 500, maxTokens: 1000 })
    const { container } = render(<TokenCounter />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(2)
  })

  it('renders nothing when maxTokens is unavailable', () => {
    mockTokens({ tokenCount: 0, maxTokens: undefined })
    const { container } = render(<TokenCounter />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when maxTokens is 0', () => {
    mockTokens({ tokenCount: 0, maxTokens: 0 })
    const { container } = render(<TokenCounter />)
    expect(container.firstChild).toBeNull()
  })

  describe('formatNumber helper (via rendered output)', () => {
    it('formats thousands as K', () => {
      mockTokens({ tokenCount: 1000, maxTokens: 2000 })
      const { container } = render(<TokenCounter />)
      expect(container.textContent).toContain('1.0K')
    })

    it('formats millions as M', () => {
      mockTokens({ tokenCount: 1000000, maxTokens: 2000000 })
      const { container } = render(<TokenCounter />)
      expect(container.textContent).toContain('1.0M')
    })

    it('shows raw number below 1000', () => {
      mockTokens({ tokenCount: 500, maxTokens: 1000 })
      const { container } = render(<TokenCounter />)
      expect(container.textContent).toContain('500')
    })
  })

  it('shows token breakdown with Used and Remaining labels', () => {
    mockTokens({ tokenCount: 500, maxTokens: 1000 })
    render(<TokenCounter />)
    const tooltipContent = screen.getByTestId('tooltip-content')
    expect(tooltipContent.textContent).toContain('Used')
    expect(tooltipContent.textContent).toContain('Remaining')
  })

  it('shows Context window header', () => {
    mockTokens({ tokenCount: 500, maxTokens: 1000 })
    render(<TokenCounter />)
    expect(
      screen.getByTestId('tooltip-content').textContent
    ).toMatch(/context\s*window/i)
  })

  it('shows correct remaining tokens', () => {
    mockTokens({ tokenCount: 300, maxTokens: 1000 })
    const { container } = render(<TokenCounter />)
    const tooltipContent = screen.getByTestId('tooltip-content')
    expect(tooltipContent.textContent).toContain('700')
  })

  it('shows 0 remaining when over limit', () => {
    mockTokens({ tokenCount: 1500, maxTokens: 1000 })
    const { container } = render(<TokenCounter />)
    const tooltipContent = screen.getByTestId('tooltip-content')
    expect(tooltipContent.textContent).toContain('Remaining')
    expect(tooltipContent.textContent).toMatch(/Remaining\s*0/)
  })

  it('shows the overflow note and failing-request numbers when isOverflow', () => {
    mockTokens({ tokenCount: 1200, maxTokens: 1000, isOverflow: true })
    const { container } = render(<TokenCounter />)
    const tooltipContent = screen.getByTestId('tooltip-content')
    expect(tooltipContent.textContent).toMatch(/overflow/i)
    expect(screen.getAllByText('120.0%').length).toBeGreaterThanOrEqual(1)
  })

  it('does not show the overflow note when not overflowing', () => {
    mockTokens({ tokenCount: 500, maxTokens: 1000, isOverflow: false })
    render(<TokenCounter />)
    expect(screen.getByTestId('tooltip-content').textContent).not.toMatch(
      /overflow/i
    )
  })

  it('accepts className prop', () => {
    mockTokens({ tokenCount: 0, maxTokens: 1000 })
    const { container } = render(<TokenCounter className="custom-class" />)
    const wrapper = container.querySelector('.custom-class')
    expect(wrapper).toBeTruthy()
  })

  describe('compact mode (Osaurus-style pill)', () => {
    it('renders "used / max tokens" when max context is available', () => {
      mockTokens({
        tokenCount: 7_100,
        maxTokens: 128_000,
        maxAvailable: true,
        pricingAvailable: false,
      })
      const { container } = render(<TokenCounter compact />)
      // The pill splits "~7.1k" and "128.0K" across multiple spans,
      // so assert via combined text content.
      expect(container.textContent).toMatch(/~7\.1K/)
      expect(container.textContent).toMatch(/128\.0K/)
      expect(container.textContent).toMatch(/tokens/i)
    })

    it('omits the "/ max" segment when no max context is known', () => {
      mockTokens({
        tokenCount: 6_900,
        maxTokens: undefined,
        maxAvailable: false,
        pricingAvailable: false,
      })
      const { container } = render(<TokenCounter compact />)
      expect(container.textContent).toMatch(/~6\.9K/)
      // No slash separator when max is absent
      expect(container.textContent).not.toMatch(/\//)
    })

    it('shows "Local" instead of cost for local providers', () => {
      mockTokens({
        tokenCount: 4_200,
        maxTokens: 32_768,
        costSource: 'local',
        pricingAvailable: false,
        maxAvailable: true,
      })
      const { container } = render(<TokenCounter compact />)
      expect(container.textContent).toMatch(/Local/)
      // No "$" prefix when the source is local
      expect(container.textContent).not.toMatch(/\$\d/)
    })

    it('shows $cost | used/max when the provider has catalog pricing', () => {
      mockTokens({
        tokenCount: 80_000,
        maxTokens: 1_048_576,
        cost: 0.03,
        costSource: 'catalog',
        pricingAvailable: true,
        maxAvailable: true,
      })
      const { container } = render(<TokenCounter compact />)
      expect(container.textContent).toMatch(/\$0\.03/)
      expect(container.textContent).toMatch(/\|/)
      expect(container.textContent).toMatch(/~80\.0K/)
    })

    it('returns null when there are no tokens to display and no cost', () => {
      const { container } = render(
        <TokenCounter
          compact
          messages={
            [] as unknown as Parameters<typeof TokenCounter>[0]['messages']
          }
        />
      )
      expect(container.firstChild).toBeNull()
    })
  })
})
