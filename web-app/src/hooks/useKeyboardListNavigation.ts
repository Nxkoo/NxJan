import { useCallback, useEffect } from 'react'
import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from 'react'

type UseKeyboardListNavigationProps = {
  isOpen: boolean
  itemCount: number
  highlightedIndex: number
  setHighlightedIndex: Dispatch<SetStateAction<number>>
  onOpen?: () => void
  onClose: () => void
  onSelect: (index: number) => void
  listRef?: RefObject<HTMLElement | null>
  itemSelector?: string
}

export function useKeyboardListNavigation({
  isOpen,
  itemCount,
  highlightedIndex,
  setHighlightedIndex,
  onOpen,
  onClose,
  onSelect,
  listRef,
  itemSelector = '[data-keyboard-option]',
}: UseKeyboardListNavigationProps) {
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listRef?.current) return
    requestAnimationFrame(() => {
      const items = listRef.current?.querySelectorAll(itemSelector)
      const item = items?.[highlightedIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    })
  }, [highlightedIndex, isOpen, itemSelector, listRef])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault()
        onOpen?.()
        setHighlightedIndex(0)
        return
      }

      if (!isOpen) return

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        setHighlightedIndex(-1)
        return
      }

      if (itemCount === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightedIndex((current) =>
          current < itemCount - 1 ? current + 1 : 0
        )
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightedIndex((current) =>
          current > 0 ? current - 1 : itemCount - 1
        )
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const index = highlightedIndex >= 0 ? highlightedIndex : 0
        if (index < itemCount) {
          onSelect(index)
        }
      }
    },
    [
      highlightedIndex,
      isOpen,
      itemCount,
      onClose,
      onOpen,
      onSelect,
      setHighlightedIndex,
    ]
  )

  return { handleKeyDown }
}
