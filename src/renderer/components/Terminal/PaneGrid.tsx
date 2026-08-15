import { useMemo, useRef } from 'react'
import { computeGeometry, type Rect } from '@shared/layout'
import { useStore } from '@renderer/store'
import { PaneDivider } from './PaneDivider'
import { TerminalPane } from './TerminalPane'

/** Pane đang phóng to chiếm trọn lưới. */
const FULL: Rect = { left: 0, top: 0, width: 100, height: 100 }

/**
 * Pane được render thành một danh sách **phẳng**, key theo pane id, mỗi ô đặt
 * tuyệt đối theo toạ độ do engine layout tính. Cây split đổi hình thế nào cũng chỉ
 * làm đổi `style` — component không bao giờ đổi vị trí trong cây React nên xterm
 * không bị remount và PTY không bị giết. Đừng thay bằng cấu trúc lồng nhau.
 *
 * Vì lý do đó, phóng to một pane cũng **không** được unmount những pane còn lại:
 * chúng vẫn render đủ, chỉ bị `display: none`. Lệnh đang chạy ở pane nền nhờ vậy
 * không mất output.
 */
export function PaneGrid({ tabId }: { tabId: string }): React.JSX.Element {
  const tab = useStore((s) => s.tabs.find((t) => t.id === tabId) ?? null)
  const containerRef = useRef<HTMLDivElement>(null)

  const geometry = useMemo(() => computeGeometry(tab?.layout ?? null), [tab?.layout])

  // Chỉ coi là đang phóng to khi pane đó thật sự còn trong lưới.
  const maximizedId =
    tab?.maximizedPaneId && geometry.panes.has(tab.maximizedPaneId) ? tab.maximizedPaneId : null

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
        const laid = geometry.panes.get(pane.id)
        if (!laid) return null
        const hidden = maximizedId !== null && maximizedId !== pane.id
        const rect = maximizedId === pane.id ? FULL : laid
        return (
          <div
            key={pane.id}
            className={`pane-slot ${hidden ? 'pane-slot--hidden' : ''}`}
            style={{
              left: `${rect.left}%`,
              top: `${rect.top}%`,
              width: `${rect.width}%`,
              height: `${rect.height}%`
            }}
          >
            <TerminalPane pane={pane} tabId={tab.id} maximized={maximizedId === pane.id} />
          </div>
        )
      })}

      {maximizedId === null &&
        geometry.dividers.map((divider) => (
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
