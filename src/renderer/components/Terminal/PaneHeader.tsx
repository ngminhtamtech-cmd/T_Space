import { useState } from 'react'
import { collectLeaves } from '@shared/layout'
import { useStore, type Pane } from '@renderer/store'
import { shortenPath } from '@renderer/utils/path'
import { useAgentBus } from '@renderer/hooks/useAgentBus'
import { CloseIcon, CollapseIcon, ExpandIcon, SendIcon } from '@renderer/components/icons'

interface Props {
  pane: Pane
  tabId: string
  maximized: boolean
  onClose: () => void
  onToggleMaximize: () => void
}

export function PaneHeader({
  pane,
  tabId,
  maximized,
  onClose,
  onToggleMaximize
}: Props): React.JSX.Element {
  const shells = useStore((s) => s.shells)
  const agents = useStore((s) => s.agents)
  const tab = useStore((s) => s.tabs.find((t) => t.id === tabId) ?? null)
  const [sending, setSending] = useState(false)

  // Số hiệu pane theo thứ tự hiển thị (trái→phải, trên→dưới) để khớp với Ctrl+1..8.
  const index = collectLeaves(tab?.layout ?? null).indexOf(pane.id)
  const agent = agents.find((a) => a.id === pane.agentId)
  const label =
    agent && agent.command
      ? agent.label
      : (shells.find((s) => s.id === pane.shell)?.label ?? pane.shell)

  const targets = (tab?.panes ?? []).filter((p) => p.id !== pane.id && !p.exited && p.ptyId)

  return (
    <div
      className="pane__header"
      onDoubleClick={onToggleMaximize}
      title="Double-click để phóng to / thu nhỏ pane"
    >
      <span className="pane__index">{index + 1}</span>
      <span className="pane__slot" title="Định danh của pane trên task board">
        {pane.slot}
      </span>
      <span className="pane__shell">{label}</span>
      <span className="pane__cwd" title={pane.cwd}>
        {shortenPath(pane.cwd)}
      </span>
      {pane.exited && <span className="pane__badge">đã thoát</span>}

      {targets.length > 0 && (
        <button
          className={`pane__btn ${sending ? 'pane__btn--on' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setSending((v) => !v)
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          title="Gửi text sang pane khác"
        >
          <SendIcon />
        </button>
      )}

      <button
        className="pane__btn"
        onClick={(e) => {
          e.stopPropagation()
          onToggleMaximize()
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        title={maximized ? 'Thu nhỏ (Esc)' : 'Phóng to pane (Ctrl+Shift+Z)'}
      >
        {maximized ? <CollapseIcon /> : <ExpandIcon />}
      </button>

      <button
        className="pane__close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        title="Đóng pane (Ctrl+Shift+W)"
      >
        <CloseIcon size={11} />
      </button>

      {sending && <SendPopover from={pane} targets={targets} onDone={() => setSending(false)} />}
    </div>
  )
}

function SendPopover({
  from,
  targets,
  onDone
}: {
  from: Pane
  targets: Pane[]
  onDone: () => void
}): React.JSX.Element {
  const { sendToPane, broadcast } = useAgentBus()
  const [target, setTarget] = useState(targets[0]!.id)
  const [text, setText] = useState('')

  const send = (all: boolean): void => {
    const body = text.trim()
    if (!body) return
    // Ghi rõ ai gửi: agent nhận cần biết để trả lời đúng slot.
    const message = `[từ ${from.slot}] ${body}`
    if (all) broadcast(message, from.id)
    else sendToPane(target, message)
    setText('')
    onDone()
  }

  return (
    <div
      className="send-pop"
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
        {targets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.slot} · {shortenPath(p.cwd)}
          </option>
        ))}
      </select>
      <input
        className="input"
        autoFocus
        placeholder="Nội dung gửi sang pane đó…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') send(false)
          if (e.key === 'Escape') onDone()
        }}
      />
      <div className="send-pop__actions">
        <button className="btn" onClick={onDone}>
          Huỷ
        </button>
        <button className="btn" onClick={() => send(true)} title="Gửi cho mọi pane còn lại">
          Tất cả
        </button>
        <button className="btn btn--primary" onClick={() => send(false)}>
          Gửi
        </button>
      </div>
    </div>
  )
}
