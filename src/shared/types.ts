/** Số pane tối đa nhìn thấy cùng lúc trong một tab — chặn ở renderer. */
export const MAX_PANES_PER_TAB = 8
/** Trần cứng tổng số PTY sống cùng lúc trên toàn app — chặn ở main process. */
export const MAX_PTY = 16

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
  /** Lệnh gõ vào PTY ngay sau khi spawn. Rỗng/thiếu = shell trần. */
  initialCommand?: string
}

export interface PtyDataEvent {
  paneId: string
  data: string
}

export interface PtyExitEvent {
  paneId: string
  exitCode: number
}

/* ---------- Cây layout ---------- */

export type SplitDirection = 'row' | 'column'

export type PaneNode =
  | { kind: 'leaf'; paneId: string }
  | {
      kind: 'split'
      id: string
      direction: SplitDirection
      children: PaneNode[]
      /** Phần trăm, cùng độ dài với children, luôn cộng đủ 100. */
      sizes: number[]
    }

export interface LayoutPreset {
  id: string
  name: string
  layout: PaneNode
  /** cwd theo paneId; thiếu = kế thừa gốc workspace. */
  cwds: Record<string, string>
  builtin: boolean
}

/* ---------- Agent ---------- */

export interface AgentProfile {
  id: string
  label: string
  shell: ShellId
  /** Lệnh gõ vào PTY ngay sau khi spawn. Rỗng = shell trần. */
  command: string
  builtin: boolean
}

/* ---------- File system ---------- */

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

/* ---------- Git / workspace ---------- */

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

export interface RecentWorkspace {
  path: string
  name: string
  lastOpenedAt: number
}

/** Cấu hình đã đặt tên: thư mục + layout + agent mặc định. */
export interface SavedWorkspace {
  id: string
  name: string
  path: string
  presetId: string | null
  agentId: string | null
}

/* ---------- Persistence ---------- */

export const STATE_VERSION = 2

export interface PersistedPane {
  /** Giữ nguyên id để khớp với leaf trong cây layout khi khôi phục. */
  paneId: string
  shell: ShellId
  cwd: string
  agentId: string | null
}

export interface PersistedTab {
  name: string
  layout: PaneNode | null
  panes: PersistedPane[]
}

export interface PersistedState {
  version: number
  workspaceRoot: string | null
  recentWorkspaces: RecentWorkspace[]
  savedWorkspaces: SavedWorkspace[]
  tabs: PersistedTab[]
  activeTabIndex: number
  layoutPresets: LayoutPreset[]
  agents: AgentProfile[]
  sidebarVisible: boolean
  sidebarWidth: number
  sharedWorktree: boolean
}

export const DEFAULT_STATE: PersistedState = {
  version: STATE_VERSION,
  workspaceRoot: null,
  recentWorkspaces: [],
  savedWorkspaces: [],
  tabs: [],
  activeTabIndex: 0,
  layoutPresets: [],
  agents: [],
  sidebarVisible: true,
  sidebarWidth: 20,
  sharedWorktree: true
}

/** Shape của state.json trước version 2 — chỉ dùng cho migrate. */
export interface LegacyPersistedState {
  workspaceRoot?: string | null
  layout?: string
  panes?: { shell: ShellId; cwd: string }[]
  sidebarVisible?: boolean
  sidebarWidth?: number
  sharedWorktree?: boolean
}
