import { useRef, useState } from 'react'
import type { DividerRect } from '@shared/layout'

interface Props {
  divider: DividerRect
  containerRef: React.RefObject<HTMLDivElement | null>
  onResize: (splitId: string, index: number, deltaPct: number) => void
}

/** Divider của preview: cùng cơ chế kéo với PaneDivider nhưng ghi vào state cục bộ. */
export function PreviewDivider({ divider, containerRef, onResize }: Props): React.JSX.Element {
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

    const parentPx = ((horizontal ? box.width : box.height) * divider.spanPct) / 100
    if (parentPx <= 0) return

    const current = horizontal ? e.clientX : e.clientY
    onResize(divider.splitId, divider.index, ((current - lastRef.current) / parentPx) * 100)
    lastRef.current = current
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
