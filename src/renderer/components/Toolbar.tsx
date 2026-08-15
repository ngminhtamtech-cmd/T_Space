import { LAYOUTS, MAX_PANES, type ShellId } from '@shared/types'
import { useStore } from '@renderer/store'
import { usePaneActions } from '@renderer/hooks/usePaneActions'
import { useWorkspaceActions } from '@renderer/hooks/useWorkspaceActions'

export function Toolbar(): React.JSX.Element {
  const panes = useStore((s) => s.panes)
  const layout = useStore((s) => s.layout)
  const shells = useStore((s) => s.shells)
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  const setLayout = useStore((s) => s.setLayout)
  const toggleSidebar = useStore((s) => s.toggleSidebar)

  const { newPane } = usePaneActions()
  const { pickWorkspace } = useWorkspaceActions()

  return (
    <div className="toolbar">
      <button className="toolbar__btn" onClick={toggleSidebar} title="Ẩn/hiện sidebar (Ctrl+B)">
        {sidebarVisible ? '◧' : '▢'}
      </button>

      <button className="toolbar__btn" onClick={pickWorkspace} title="Mở thư mục workspace">
        📂 Mở thư mục
      </button>

      <div className="toolbar__sep" />

      <button
        className="toolbar__btn"
        onClick={() => void newPane()}
        disabled={panes.length >= MAX_PANES}
        title="Terminal mới (Ctrl+Shift+`)"
      >
        + Terminal
      </button>

      {shells.length > 1 && (
        <select
          className="toolbar__select"
          value=""
          onChange={(e) => {
            if (e.target.value) void newPane(undefined, e.target.value as ShellId)
            e.target.value = ''
          }}
          disabled={panes.length >= MAX_PANES}
          title="Mở terminal với shell khác"
        >
          <option value="">shell khác…</option>
          {shells.map((shell) => (
            <option key={shell.id} value={shell.id}>
              {shell.label}
            </option>
          ))}
        </select>
      )}

      <div className="toolbar__sep" />

      <div className="toolbar__layouts">
        {LAYOUTS.map((info) => (
          <button
            key={info.id}
            className={`toolbar__layout ${layout === info.id ? 'toolbar__layout--active' : ''}`}
            onClick={() => setLayout(info.id)}
            disabled={info.paneCount < panes.length}
            title={
              info.paneCount < panes.length
                ? `Không đủ ô cho ${panes.length} pane`
                : `Layout ${info.label}`
            }
          >
            {info.label}
          </button>
        ))}
      </div>
    </div>
  )
}
