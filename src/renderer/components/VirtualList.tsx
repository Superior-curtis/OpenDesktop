import { useState, useRef, useCallback, useEffect } from 'react'

interface VirtualListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  estimatedItemHeight?: number
  overscan?: number
  containerClassName?: string
  onScrollEnd?: () => void
  scrollEndThreshold?: number
  keyExtractor?: (item: T, index: number) => string
}

export function VirtualList<T>({
  items,
  renderItem,
  estimatedItemHeight = 80,
  overscan = 5,
  containerClassName = '',
  onScrollEnd,
  scrollEndThreshold = 200,
  keyExtractor,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const heightsRef = useRef<Map<number, number>>(new Map())
  const rafRef = useRef<number | null>(null)
  const cacheKey = items.length > 0 && keyExtractor ? `vh:${keyExtractor(items[0], 0)}` : ''

  useEffect(() => {
    if (!cacheKey) return
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const data = JSON.parse(cached) as [number, number][]
        heightsRef.current = new Map(data)
      }
    } catch { /* ignore */ }
  }, [cacheKey])

  useEffect(() => {
    if (!cacheKey || heightsRef.current.size === 0) return
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(Array.from(heightsRef.current.entries())))
    } catch { /* ignore */ }
  }, [heightsRef.current.size, cacheKey])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    setContainerHeight(el.clientHeight)
    return () => observer.disconnect()
  }, [])

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return
      const st = containerRef.current.scrollTop
      setScrollTop(st)

      if (onScrollEnd && containerRef.current) {
        const { scrollHeight, clientHeight, scrollTop: st2 } = containerRef.current
        if (scrollHeight - st2 - clientHeight < scrollEndThreshold) {
          onScrollEnd()
        }
      }
    })
  }, [onScrollEnd, scrollEndThreshold])

  const getCumulativeHeight = useCallback((index: number): number => {
    let h = 0
    const heights = heightsRef.current
    for (let i = 0; i < index; i++) {
      h += heights.get(i) ?? estimatedItemHeight
    }
    return h
  }, [estimatedItemHeight])

  const totalHeight = items.length > 0
    ? getCumulativeHeight(items.length)
    : 0

  let startIdx = 0
  let acc = 0
  for (let i = 0; i < items.length; i++) {
    const h = heightsRef.current.get(i) ?? estimatedItemHeight
    if (acc + h > Math.max(0, scrollTop - overscan * estimatedItemHeight)) {
      startIdx = Math.max(0, i - overscan)
      break
    }
    acc += h
  }

  let endIdx = items.length
  acc = 0
  for (let i = startIdx; i < items.length; i++) {
    const h = heightsRef.current.get(i) ?? estimatedItemHeight
    if (acc > containerHeight + overscan * estimatedItemHeight) {
      endIdx = i + overscan
      break
    }
    acc += h
  }
  endIdx = Math.min(items.length, endIdx)

  const visibleItems = items.slice(startIdx, endIdx)
  const offsetY = getCumulativeHeight(startIdx)

  const measureRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    if (el) {
      const h = el.getBoundingClientRect().height
      if (h > 0 && heightsRef.current.get(index) !== h) {
        heightsRef.current.set(index, h)
        if (cacheKey) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(Array.from(heightsRef.current.entries()))) } catch { /* ignore */ }
        }
      }
    }
  }, [cacheKey])

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${containerClassName}`}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => {
            const realIndex = startIdx + i
            return (
              <div key={keyExtractor ? keyExtractor(item, realIndex) : realIndex} ref={measureRef(realIndex)}>
                {renderItem(item, realIndex)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
