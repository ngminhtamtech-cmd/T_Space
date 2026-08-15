import { useStore, type Pane } from '@renderer/store'
import { shortenPath } from '@renderer/utils/path'

interface Props {
  pane: Pane
  onClose: () => void
}

export function PaneHeader({ pane, onClose }: Props): React.JSX.Element {
  const shells = useStore((s) => s.shells)
  const panes = useStore((s) => s.panes)
  const index = panes.findIndex((p) => p.id === pane.id)
  const shellLabel = shells.find((s) => s.id === pane.shell)?.label ?? pane.shell

  return (
    <div className="pane__header">
      <span className="pane__index">{index + 1}</span>
      <span className="pane__shell">{shellLabel}</span>
      <span className="pane__cwd" title={pane.cwd}>
        {shortenPath(pane.cwd)}
      </span>
      {pane.exited && <span className="pane__badge">đã thoát</span>}
      <button className="pane__close" onClick={onClose} title="Đóng pane (Ctrl+Shift+W)">
        ✕
      </button>
    </div>
  )
}
