import { useStore } from '@renderer/store'
import { PaneGrid } from './PaneGrid'

/**
 * Mọi tab được mount cùng lúc, tab không active chỉ bị `display: none`.
 * Nếu unmount tab nền thì xterm bị dispose và listener `pty.onData` bị gỡ — output
 * của lệnh đang chạy ở tab đó sẽ mất trắng khi quay lại.
 */
export function PaneStack(): React.JSX.Element {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)

  if (tabs.length === 0) {
    return (
      <div className="pane-grid pane-grid--empty">
        <div className="empty-hint">
          <p>Chưa có tab nào.</p>
          <p>
            <kbd>Ctrl</kbd> + <kbd>T</kbd> để mở tab mới
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pane-stack">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="pane-stack__item"
          style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
        >
          <PaneGrid tabId={tab.id} />
        </div>
      ))}
    </div>
  )
}
