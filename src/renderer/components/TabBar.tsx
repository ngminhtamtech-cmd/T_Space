import { MAX_PANES_PER_TAB } from '@shared/types'
import { useActiveTab, useStore } from '@renderer/store'
import { usePaneActions } from '@renderer/hooks/usePaneActions'
import { useTabActions } from '@renderer/hooks/useTabActions'
import {
  CloseIcon,
  HomeIcon,
  PlusIcon,
  SidebarIcon,
  SplitDownIcon,
  SplitRightIcon
} from './icons'

export function TabBar(): React.JSX.Element {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const setView = useStore((s) => s.setView)

  const tab = useActiveTab()
  const { splitActivePane } = usePaneActions()
  const { openBlankTab, openLayoutEditor, closeTabWithPanes } = useTabActions()

  const full = (tab?.panes.length ?? 0) >= MAX_PANES_PER_TAB
  const canSplit = Boolean(tab?.activePaneId) && !full
  const splitTitle = full ? `Tab đã đạt ${MAX_PANES_PER_TAB} pane` : undefined

  return (
    <div className="tabbar">
      <button
        className={`icon-btn ${sidebarVisible ? 'icon-btn--on' : ''}`}
        onClick={toggleSidebar}
        title="Ẩn/hiện sidebar (Ctrl+B)"
      >
        <SidebarIcon />
      </button>

      <div className="tabbar__sep" />

      <div className="tabbar__tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${t.id === activeTabId ? 'tab--on' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="tab__name">{t.name}</span>
            <span className="tab__count">{t.panes.length}</span>
            <span
              className="tab__close"
              role="button"
              tabIndex={-1}
              title="Đóng tab"
              onClick={(e) => {
                e.stopPropagation()
                void closeTabWithPanes(t.id)
              }}
            >
              <CloseIcon size={10} />
            </span>
          </button>
        ))}

        <button className="icon-btn" onClick={() => void openBlankTab()} title="Tab mới (Ctrl+T)">
          <PlusIcon />
        </button>
      </div>

      <div className="tabbar__actions">
        <button
          className="icon-btn"
          onClick={() => void splitActivePane('row')}
          disabled={!canSplit}
          title={splitTitle ?? 'Split Right (Ctrl+\\)'}
        >
          <SplitRightIcon />
        </button>
        <button
          className="icon-btn"
          onClick={() => void splitActivePane('column')}
          disabled={!canSplit}
          title={splitTitle ?? 'Split Down (Ctrl+Shift+\\)'}
        >
          <SplitDownIcon />
        </button>

        <div className="tabbar__sep" />

        <button className="icon-btn" onClick={openLayoutEditor} title="Layout editor">
          <span aria-hidden="true">⌗</span>
        </button>
        <button
          className="icon-btn"
          onClick={() => setView('launcher')}
          title="Về màn hình chọn workspace"
        >
          <HomeIcon />
        </button>
      </div>
    </div>
  )
}
