import { collectLeaves } from '@shared/layout'
import { useStore, type Pane } from '@renderer/store'
import { shortenPath } from '@renderer/utils/path'
import { CloseIcon } from '@renderer/components/icons'

interface Props {
  pane: Pane
  tabId: string
  onClose: () => void
}

export function PaneHeader({ pane, tabId, onClose }: Props): React.JSX.Element {
  const shells = useStore((s) => s.shells)
  const agents = useStore((s) => s.agents)
  const layout = useStore((s) => s.tabs.find((t) => t.id === tabId)?.layout ?? null)

  // Số hiệu pane theo thứ tự hiển thị (trái→phải, trên→dưới) để khớp với Ctrl+1..8.
  const index = collectLeaves(layout).indexOf(pane.id)
  const agent = agents.find((a) => a.id === pane.agentId)
  const label =
    agent && agent.command
      ? agent.label
      : (shells.find((s) => s.id === pane.shell)?.label ?? pane.shell)

  return (
    <div className="pane__header">
      <span className="pane__index">{index + 1}</span>
      <span className="pane__shell">{label}</span>
      <span className="pane__cwd" title={pane.cwd}>
        {shortenPath(pane.cwd)}
      </span>
      {pane.exited && <span className="pane__badge">đã thoát</span>}
      <button className="pane__close" onClick={onClose} title="Đóng pane (Ctrl+Shift+W)">
        <CloseIcon size={11} />
      </button>
    </div>
  )
}
