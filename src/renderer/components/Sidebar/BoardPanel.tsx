import { useState } from 'react'
import { STATUS_LABELS, TASK_STATUSES, type BoardTask } from '@shared/board'
import { useActiveTab, useStore, type Pane } from '@renderer/store'
import { useBoard, tasksByStatus } from '@renderer/hooks/useBoard'
import { useAgentBus } from '@renderer/hooks/useAgentBus'
import { askText } from '@renderer/components/Prompt/promptStore'
import { PlusIcon, SendIcon, TrashIcon } from '@renderer/components/icons'

/**
 * Bảng task dùng chung của worktree. Nội dung đến từ `.tspace/board.json` — agent
 * ghi bằng `.tspace/board.ps1`, người dùng ghi từ đây, cả hai thấy cùng một file.
 */
export function BoardPanel(): React.JSX.Element {
  const { board, ensureBoard, addTask, patchTask, removeTask, syncAgents, hasWorkspace } = useBoard()
  const tab = useActiveTab()
  const [busy, setBusy] = useState(false)

  if (!hasWorkspace) {
    return <p className="board__empty">Mở một workspace trước.</p>
  }

  if (!board) {
    return (
      <div className="board__empty">
        <p>Workspace này chưa có task board dùng chung.</p>
        <button
          className="btn btn--primary"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void ensureBoard().finally(() => setBusy(false))
          }}
        >
          Tạo board (.tspace/)
        </button>
      </div>
    )
  }

  const panes = tab?.panes ?? []

  return (
    <div className="board">
      <div className="board__head">
        <button
          className="btn btn--sm"
          onClick={() => {
            void (async () => {
              const title = await askText('Tiêu đề task')
              if (title) await addTask(title)
            })()
          }}
        >
          <PlusIcon /> Task
        </button>
        <button
          className="btn btn--sm"
          title="Ghi danh sách pane hiện tại vào board để agent biết ai là ai"
          onClick={() => void syncAgents()}
        >
          Đồng bộ agent
        </button>
      </div>

      {board.agents.length > 0 && (
        <div className="board__agents">
          {board.agents.map((agent) => (
            <span
              key={agent.slot}
              className={`board__agent ${agent.paneId ? '' : 'board__agent--off'}`}
              title={agent.paneId ? 'Đang chạy' : 'Pane đã đóng'}
            >
              {agent.slot} · {agent.label}
            </span>
          ))}
        </div>
      )}

      <div className="board__cols">
        {TASK_STATUSES.map((status) => {
          const tasks = tasksByStatus(board, status)
          if (tasks.length === 0 && status === 'blocked') return null
          return (
            <section key={status} className="board__col">
              <h3 className="board__col-title">
                {STATUS_LABELS[status]} <span className="board__count">{tasks.length}</span>
              </h3>
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  panes={panes}
                  onPatch={(patch) => void patchTask(task.id, patch)}
                  onRemove={() => void removeTask(task.id)}
                />
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}

interface CardProps {
  task: BoardTask
  panes: Pane[]
  onPatch: (patch: Partial<BoardTask>) => void
  onRemove: () => void
}

function TaskCard({ task, panes, onPatch, onRemove }: CardProps): React.JSX.Element {
  const { sendToPane } = useAgentBus()
  const setToast = useStore((s) => s.setToast)
  const [assigning, setAssigning] = useState(false)
  const live = panes.filter((p) => !p.exited && p.ptyId)

  /** Giao việc = vừa cập nhật board, vừa gõ thẳng lời nhắc vào terminal của agent đó. */
  const assign = (pane: Pane): void => {
    onPatch({ status: 'doing', assignee: pane.slot })
    const others = live.filter((p) => p.id !== pane.id).map((p) => p.slot)
    const reviewer = others[0]
    const reviewHint = reviewer
      ? ` Làm xong chạy: .\\.tspace\\board.ps1 done ${task.id} -Reviewer ${reviewer}`
      : ''
    const ok = sendToPane(
      pane.id,
      `Bạn là ${pane.slot}. Nhận task ${task.id} trên task board: "${task.title}".` +
        ` Bắt đầu bằng: .\\.tspace\\board.ps1 claim ${task.id}${reviewHint}`
    )
    if (ok) setToast(`Đã giao ${task.id} cho ${pane.slot}`)
    setAssigning(false)
  }

  return (
    <article className="task">
      <div className="task__top">
        <span className="task__id">{task.id}</span>
        <span className="task__title">{task.title}</span>
        <button className="task__btn" title="Xoá task" onClick={onRemove}>
          <TrashIcon size={12} />
        </button>
      </div>

      {task.detail && <p className="task__detail">{task.detail}</p>}

      <div className="task__meta">
        {task.assignee && <span className="task__chip">làm: {task.assignee}</span>}
        {task.reviewer && <span className="task__chip task__chip--review">chấm: {task.reviewer}</span>}
        {task.notes.length > 0 && (
          <span className="task__chip" title={task.notes.map((n) => `${n.by}: ${n.text}`).join('\n')}>
            {task.notes.length} nhận xét
          </span>
        )}
        {live.length > 0 && (
          <button
            className="task__btn task__btn--text"
            onClick={() => setAssigning((v) => !v)}
            title="Giao task này cho một pane đang chạy"
          >
            <SendIcon /> Giao cho…
          </button>
        )}
      </div>

      {assigning && (
        <div className="task__assign">
          {live.map((pane) => (
            <button key={pane.id} className="btn btn--sm" onClick={() => assign(pane)}>
              {pane.slot}
            </button>
          ))}
        </div>
      )}

      {task.notes.length > 0 && (
        <ul className="task__notes">
          {task.notes.map((note, i) => (
            <li key={i} className={`task__note task__note--${note.verdict}`}>
              <b>{note.by}</b> {note.text}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
