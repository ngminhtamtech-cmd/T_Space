import { useMemo, useRef } from 'react'
import { computeGeometry } from '@shared/layout'
import { useStore } from '@renderer/store'
import { PaneDivider } from './PaneDivider'
import { TerminalPane } from './TerminalPane'

/**
 * Pane được render thành một danh sách **phẳng**, key theo pane id, mỗi ô đặt
 * tuyệt đối theo toạ độ do engine layout tính. Cây split đổi hình thế nào cũng chỉ
 * làm đổi `style` — component không bao giờ đổi vị trí trong cây React nên xterm
 * không bị remount và PTY không bị giết. Đừng thay bằng cấu trúc lồng nhau.
 */
export function PaneGrid({ tabId }: { tabId: string }): React.JSX.Element {
  const tab = useStore((s) => s.tabs.find((t) => t.id === tabId) ?? null)
  const containerRef = useRef<HTMLDivElement>(null)

  const geometry = useMemo(() => computeGeometry(tab?.layout ?? null), [tab?.layout])

  if (!tab || tab.panes.length === 0) {
    return (
      <div className="pane-grid pane-grid--empty">
        <div className="empty-hint">
          <p>Chưa có terminal nào.</p>
          <p>
            <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>`</kbd> để mở pane mới
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pane-grid" ref={containerRef}>
      {tab.panes.map((pane) => {
        const rect = geometry.panes.get(pane.id)
        if (!rect) return null
        return (
          <div
            key={pane.id}
            className="pane-slot"
            style={{
              left: `${rect.left}%`,
              top: `${rect.top}%`,
              width: `${rect.width}%`,
              height: `${rect.height}%`
            }}
          >
            <TerminalPane pane={pane} tabId={tab.id} />
          </div>
        )
      })}

      {geometry.dividers.map((divider) => (
        <PaneDivider
          key={`${divider.splitId}-${divider.index}`}
          tabId={tab.id}
          divider={divider}
          containerRef={containerRef}
        />
      ))}
    </div>
  )
}
