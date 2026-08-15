import { useMemo } from 'react'
import { computeGeometry } from '@shared/layout'
import type { PaneNode } from '@shared/types'

/** Hình xem trước layout, dùng chung engine hình học với lưới pane thật. */
export function MiniPreview({ layout }: { layout: PaneNode }): React.JSX.Element {
  const rects = useMemo(() => [...computeGeometry(layout).panes.values()], [layout])

  return (
    <div className="mini-preview">
      {rects.map((rect, i) => (
        <div
          key={i}
          className="mini-preview__cell"
          style={{
            left: `${rect.left}%`,
            top: `${rect.top}%`,
            width: `${rect.width}%`,
            height: `${rect.height}%`
          }}
        />
      ))}
    </div>
  )
}
