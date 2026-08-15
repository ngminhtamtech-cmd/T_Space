export const MAX_PANES = 6

export type ShellId = 'powershell' | 'cmd' | 'gitbash'

export interface ShellProfile {
  id: ShellId
  label: string
  path: string
  args: string[]
}

export interface SpawnOptions {
  shell: ShellId
  cwd: string
  cols: number
  rows: number
}

export interface PtyDataEvent {
  paneId: string
  data: string
}

export interface PtyExitEvent {
  paneId: string
  exitCode: number
}

export type LayoutId = 'single' | 'twoCols' | 'twoRows' | 'threeCols' | 'grid4' | 'grid6'

export interface LayoutInfo {
  id: LayoutId
  label: string
  paneCount: number
}

export const LAYOUTS: LayoutInfo[] = [
  { id: 'single', label: '1 pane', paneCount: 1 },
  { id: 'twoCols', label: '2 cột', paneCount: 2 },
  { id: 'twoRows', label: '2 hàng', paneCount: 2 },
  { id: 'threeCols', label: '3 cột', paneCount: 3 },
  { id: 'grid4', label: '2 × 2', paneCount: 4 },
  { id: 'grid6', label: '3 × 2', paneCount: 6 }
]

export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
}

export type FileReadResult =
  | { kind: 'text'; content: string; path: string }
  | { kind: 'binary'; path: string; size: number }
  | { kind: 'tooLarge'; path: string; size: number }

export interface FsChangeEvent {
  /** Thư mục chứa mục bị thay đổi — renderer chỉ refresh đúng nhánh này. */
  dir: string
}

export interface WorktreeInfo {
  path: string
  branch: string | null
  head: string
  isMain: boolean
  isCurrent: boolean
}

export interface GitStatusInfo {
  branch: string | null
  changed: number
  ahead: number
  behind: number
}

export interface WorkspaceInfo {
  /** Thư mục người dùng đã mở. */
  root: string
  /** Gốc repo git nếu root nằm trong một repo, ngược lại null. */
  gitRoot: string | null
}

export interface PersistedPane {
  shell: ShellId
  cwd: string
}

export interface PersistedState {
  workspaceRoot: string | null
  layout: LayoutId
  panes: PersistedPane[]
  sidebarVisible: boolean
  sidebarWidth: number
  sharedWorktree: boolean
}

export const DEFAULT_STATE: PersistedState = {
  workspaceRoot: null,
  layout: 'single',
  panes: [],
  sidebarVisible: true,
  sidebarWidth: 20,
  sharedWorktree: true
}
