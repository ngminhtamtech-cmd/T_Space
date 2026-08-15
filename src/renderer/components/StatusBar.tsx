import { useEffect, useState } from 'react'
import { MAX_PANES, type WorktreeInfo } from '@shared/types'
import { useStore } from '@renderer/store'
import { useWorkspaceActions } from '@renderer/hooks/useWorkspaceActions'

export function StatusBar(): React.JSX.Element {
  const workspace = useStore((s) => s.workspace)
  const gitStatus = useStore((s) => s.gitStatus)
  const panes = useStore((s) => s.panes)
  const sharedWorktree = useStore((s) => s.sharedWorktree)
  const setSharedWorktree = useStore((s) => s.setSharedWorktree)

  const { openWorkspace } = useWorkspaceActions()
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([])

  useEffect(() => {
    if (!workspace?.gitRoot) return setWorktrees([])
    let cancelled = false
    window.tspace.git
      .listWorktrees(workspace.gitRoot, workspace.root)
      .then((list) => {
        if (!cancelled) setWorktrees(list)
      })
      .catch(() => {
        if (!cancelled) setWorktrees([])
      })
    return () => {
      cancelled = true
    }
  }, [workspace?.gitRoot, workspace?.root])

  return (
    <div className="statusbar">
      {workspace ? (
        <>
          <span className="statusbar__item statusbar__item--path" title={workspace.root}>
            {workspace.root}
          </span>

          {gitStatus ? (
            <span className="statusbar__item" title="Branch hiện tại">
              ⎇ {gitStatus.branch ?? 'detached'}
              {gitStatus.changed > 0 && (
                <span className="statusbar__dirty" title={`${gitStatus.changed} file thay đổi`}>
                  ●{gitStatus.changed}
                </span>
              )}
              {gitStatus.ahead > 0 && <span className="statusbar__sync">↑{gitStatus.ahead}</span>}
              {gitStatus.behind > 0 && <span className="statusbar__sync">↓{gitStatus.behind}</span>}
            </span>
          ) : (
            <span className="statusbar__item statusbar__item--muted">không phải repo git</span>
          )}

          {worktrees.length > 1 && (
            <select
              className="statusbar__select"
              value={worktrees.find((w) => w.isCurrent)?.path ?? ''}
              onChange={(e) => void openWorkspace(e.target.value)}
              title="Đổi sang worktree khác (pane đang chạy vẫn giữ nguyên)"
            >
              {!worktrees.some((w) => w.isCurrent) && <option value="">(ngoài worktree)</option>}
              {worktrees.map((w) => (
                <option key={w.path} value={w.path}>
                  {w.branch ?? w.head.slice(0, 7)}
                  {w.isMain ? ' (main)' : ''}
                </option>
              ))}
            </select>
          )}

          <label
            className="statusbar__toggle"
            title="Bật: pane mới luôn mở tại gốc workspace. Tắt: pane mới kế thừa cwd của pane trước."
          >
            <input
              type="checkbox"
              checked={sharedWorktree}
              onChange={(e) => setSharedWorktree(e.target.checked)}
            />
            shared worktree
          </label>
        </>
      ) : (
        <span className="statusbar__item statusbar__item--muted">Chưa mở workspace</span>
      )}

      <span className="statusbar__spacer" />
      <span className="statusbar__item" title="Số pane đang mở">
        {panes.length}/{MAX_PANES} pane
      </span>
    </div>
  )
}
