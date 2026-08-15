import { useRef, useState } from 'react'
import type { DividerRect } from '@shared/layout'
import { useStore } from '@renderer/store'

interface Props {
  tabId: string
  divider: DividerRect
  /** Phần tử chứa lưới pane — dùng để quy đổi px sang %. */
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function PaneDivider({ tabId, divider, containerRef }: Props): React.JSX.Element {
  const resizeDivider = useStore((s) => s.resizeDivider)
  const [dragging, setDragging] = useState(false)
  const lastRef = useRef(0)

  const horizontal = divider.direction === 'row'

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    lastRef.current = horizontal ? e.clientX : e.clientY
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return
    const box = containerRef.current?.getBoundingClientRect()
    if (!box) return

    const containerPx = horizontal ? box.width : box.height
    // spanPct là phần trăm container mà split cha chiếm dọc trục chia; delta phải
    // quy về phần trăm *của split cha* thì resizeSplit mới cộng đúng.
    const parentPx = (containerPx * divider.spanPct) / 100
    if (parentPx <= 0) return

    const current = horizontal ? e.clientX : e.clientY
    const deltaPct = ((current - lastRef.current) / parentPx) * 100
    lastRef.current = current

    resizeDivider(tabId, divider.splitId, divider.index, deltaPct)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  return (
    <div
      className={`pane-divider pane-divider--${divider.direction} ${
        dragging ? 'pane-divider--dragging' : ''
      }`}
      style={{
        left: `${divider.left}%`,
        top: `${divider.top}%`,
        ...(horizontal ? { height: `${divider.height}%` } : { width: `${divider.width}%` })
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
    />
  )
}
