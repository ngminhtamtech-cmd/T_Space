import { useCallback, useEffect } from 'react'
import type { Board, BoardTask, TaskStatus } from '@shared/board'
import { getActiveTab, useStore } from '@renderer/store'

/**
 * Đồng bộ task board của workspace hiện tại.
 *
 * Board bị nhiều tiến trình ghi (T_Space + mỗi agent qua `.tspace/board.ps1`), nên
 * mọi thay đổi từ UI đều phải **đọc lại file rồi mới ghi** — bản trong store có thể
 * đã cũ vài trăm mili giây.
 */
/**
 * Nạp board và lắng nghe watcher. Gọi **một lần** ở App — sidebar có thể đang bị ẩn
 * mà board vẫn cần cập nhật (TabBar hiển thị số task, agent vẫn đang ghi file).
 */
export function useBoardSync(): void {
  const root = useStore((s) => s.workspace?.root ?? null)
  const setBoard = useStore((s) => s.setBoard)

  useEffect(() => {
    if (!root) return setBoard(null)
    let cancelled = false

    void window.tspace.board
      .read(root)
      .then((next) => {
        if (!cancelled) setBoard(next)
      })
      .catch(() => {
        if (!cancelled) setBoard(null)
      })

    // Watcher ở main báo về mỗi khi một agent ghi board.
    const off = window.tspace.board.onChanged((next) => {
      if (!cancelled) setBoard(next)
    })

    return () => {
      cancelled = true
      off()
    }
  }, [root, setBoard])
}

export function useBoard() {
  const board = useStore((s) => s.board)
  const setBoard = useStore((s) => s.setBoard)
  const setToast = useStore((s) => s.setToast)
  const root = useStore((s) => s.workspace?.root ?? null)

  const ensureBoard = useCallback(async (): Promise<boolean> => {
    if (!root) return false
    try {
      setBoard(await window.tspace.board.ensure(root))
      return true
    } catch (err) {
      setToast(toMessage(err))
      return false
    }
  }, [root, setBoard, setToast])

  /** Đọc lại từ đĩa, áp thay đổi, ghi xuống. Trả false nếu chưa có board. */
  const mutate = useCallback(
    async (change: (board: Board) => Board): Promise<boolean> => {
      if (!root) return false
      try {
        const current = await window.tspace.board.read(root)
        if (!current) {
          setToast('Workspace này chưa có task board. Bấm “Tạo board” trước.')
          return false
        }
        const next = change(current)
        await window.tspace.board.write(root, next)
        setBoard(next)
        return true
      } catch (err) {
        setToast(toMessage(err))
        return false
      }
    },
    [root, setBoard, setToast]
  )

  const addTask = useCallback(
    (title: string, detail = ''): Promise<boolean> =>
      mutate((current) => {
        const now = Date.now()
        const task: BoardTask = {
          id: nextTaskId(current),
          title,
          detail,
          status: 'todo',
          assignee: null,
          reviewer: null,
          createdBy: 'user',
          createdAt: now,
          updatedAt: now,
          notes: []
        }
        return { ...current, tasks: [...current.tasks, task] }
      }),
    [mutate]
  )

  const patchTask = useCallback(
    (taskId: string, patch: Partial<BoardTask>): Promise<boolean> =>
      mutate((current) => ({
        ...current,
        tasks: current.tasks.map((t) =>
          t.id === taskId ? { ...t, ...patch, updatedAt: Date.now() } : t
        )
      })),
    [mutate]
  )

  const removeTask = useCallback(
    (taskId: string): Promise<boolean> =>
      mutate((current) => ({ ...current, tasks: current.tasks.filter((t) => t.id !== taskId) })),
    [mutate]
  )

  /** Ghi lại danh sách agent theo các pane đang sống của tab hiện tại. */
  const syncAgents = useCallback((): Promise<boolean> => {
    const tab = getActiveTab()
    if (!tab) return Promise.resolve(false)
    const agents = useStore.getState().agents
    return mutate((current) => ({
      ...current,
      agents: tab.panes.map((pane) => ({
        slot: pane.slot,
        label: agents.find((a) => a.id === pane.agentId)?.label ?? pane.shell,
        paneId: pane.exited ? null : pane.id,
        role: current.agents.find((a) => a.slot === pane.slot)?.role ?? ''
      }))
    }))
  }, [mutate])

  return { board, ensureBoard, addTask, patchTask, removeTask, syncAgents, hasWorkspace: !!root }
}

export function tasksByStatus(board: Board | null, status: TaskStatus): BoardTask[] {
  return (board?.tasks ?? []).filter((t) => t.status === status)
}

function nextTaskId(board: Board): string {
  const max = board.tasks.reduce((acc, task) => {
    const match = /^t(\d+)$/.exec(task.id)
    return match ? Math.max(acc, Number(match[1])) : acc
  }, 0)
  return `t${max + 1}`
}

function toMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '')
}
