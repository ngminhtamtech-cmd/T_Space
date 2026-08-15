/**
 * Task board dùng chung cho nhiều agent làm trên cùng một worktree.
 *
 * File thật nằm ở `<worktreeRoot>/.tspace/board.json`. Cả T_Space lẫn các agent (qua
 * `.tspace/board.ps1`) đều ghi vào đó, nên mọi thao tác ghi phải là đọc-lại-rồi-ghi
 * và ghi kiểu tmp + rename.
 *
 * Module thuần: chỉ `import type`, không import runtime nào — giữ đúng như `layout.ts`
 * để script smoke chạy được bằng node trần.
 */

export type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'blocked'

export const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'review', 'done', 'blocked']

export type Verdict = 'pass' | 'fail' | 'comment'

export interface BoardNote {
  /** Slot của agent viết nhận xét. */
  by: string
  verdict: Verdict
  text: string
  at: number
}

export interface BoardTask {
  id: string
  title: string
  detail: string
  status: TaskStatus
  /** Slot đang làm task. */
  assignee: string | null
  /** Slot được giao chấm chéo. */
  reviewer: string | null
  createdBy: string
  createdAt: number
  updatedAt: number
  notes: BoardNote[]
}

export interface BoardAgent {
  /** Định danh ngắn dùng trong prompt và board.ps1: a1, a2… */
  slot: string
  label: string
  /** Pane đang chạy agent này; null nếu pane đã đóng. */
  paneId: string | null
  role: string
}

export interface Board {
  version: 1
  updatedAt: number
  agents: BoardAgent[]
  tasks: BoardTask[]
}

export const BOARD_VERSION = 1

export const BOARD_DIR = '.tspace'
export const BOARD_FILE = 'board.json'

export function emptyBoard(now: number): Board {
  return { version: BOARD_VERSION, updatedAt: now, agents: [], tasks: [] }
}

/** Nhãn tiếng Việt cho từng cột, dùng chung giữa BoardPanel và board.ps1. */
export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Chờ làm',
  doing: 'Đang làm',
  review: 'Chờ chấm',
  done: 'Xong',
  blocked: 'Kẹt'
}
