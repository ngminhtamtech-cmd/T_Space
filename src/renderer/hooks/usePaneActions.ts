import { useCallback } from 'react'
import { MAX_PANES, type ShellId } from '@shared/types'
import { useStore } from '@renderer/store'

/** Kích thước tạm lúc spawn; ResizeObserver của pane sẽ resize lại ngay sau khi mount. */
const INITIAL_COLS = 80
const INITIAL_ROWS = 24

let counter = 0

export function usePaneActions() {
  const addPane = useStore((s) => s.addPane)
  const removePane = useStore((s) => s.removePane)
  const setToast = useStore((s) => s.setToast)

  /**
   * Spawn PTY xong mới đưa pane vào store. Nếu để component tự spawn sau khi mount,
   * việc thêm pane liên tiếp có thể remount component giữa chừng và giết PTY đang tạo.
   */
  const newPane = useCallback(
    async (cwd?: string, shell?: ShellId): Promise<void> => {
      const state = useStore.getState()
      if (state.panes.length >= MAX_PANES) {
        setToast(`Đã đạt giới hạn ${MAX_PANES} terminal. Đóng bớt một pane trước.`)
        return
      }

      const workspaceRoot = state.workspace?.root
      // Ở chế độ shared worktree, pane mới luôn bám gốc workspace thay vì cwd của pane trước.
      const resolvedCwd =
        cwd ?? (state.sharedWorktree ? workspaceRoot : state.panes.at(-1)?.cwd) ?? workspaceRoot

      if (!resolvedCwd) {
        setToast('Mở một thư mục workspace trước khi tạo terminal.')
        return
      }

      const resolvedShell = shell ?? state.shells[0]?.id ?? 'powershell'

      try {
        const ptyId = await window.tspace.pty.spawn({
          shell: resolvedShell,
          cwd: resolvedCwd,
          cols: INITIAL_COLS,
          rows: INITIAL_ROWS
        })
        addPane({
          id: `pane-${++counter}`,
          ptyId,
          shell: resolvedShell,
          cwd: resolvedCwd,
          exited: false
        })
      } catch (err) {
        setToast(toMessage(err))
      }
    },
    [addPane, setToast]
  )

  const closePane = useCallback(
    (paneId: string): void => {
      const pane = useStore.getState().panes.find((p) => p.id === paneId)
      if (!pane) return
      if (pane.ptyId) void window.tspace.pty.kill(pane.ptyId)
      removePane(paneId)
    },
    [removePane]
  )

  const closeActivePane = useCallback((): void => {
    const activeId = useStore.getState().activePaneId
    if (activeId) closePane(activeId)
  }, [closePane])

  return { newPane, closePane, closeActivePane }
}

function toMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  // Lỗi ném từ ipcMain.handle bị bọc thêm tiền tố "Error invoking remote method ...".
  return raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '')
}
