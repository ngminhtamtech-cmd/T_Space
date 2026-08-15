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
  /** Id pane phía renderer. Transcript khoá theo id này nên nó sống qua các lần khôi phục. */
  paneId: string
  shell: ShellId
  cwd: string
  cols: number
  rows: number
  /** Lệnh gõ vào PTY ngay sau khi spawn. Rỗng/thiếu = shell trần. */
  initialCommand?: string
  /**
   * Có gõ Enter sau lệnh khởi động không. Mặc định **không**: lệnh chỉ được điền
   * sẵn ra prompt để người dùng tự xem lại rồi bấm Enter.
   */
  submitInitialCommand?: boolean
  /** Biến môi trường thêm vào cho tiến trình con (TSPACE_AGENT_SLOT, TSPACE_BOARD…). */
  env?: Record<string, string>
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
  /** Lệnh điền sẵn ra prompt khi pane mở. Rỗng = shell trần. */
  command: string
  builtin: boolean
  /** Biến môi trường riêng của agent, trộn vào env của PTY. */
  env?: Record<string, string>
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

export interface BranchListInfo {
  current: string | null
  all: string[]
}

export interface CommitResult {
  /** false khi repo sạch — không có gì để commit, không phải lỗi. */
  committed: boolean
  hash: string | null
  files: number
}

export interface CreateWorktreeOptions {
  path: string
  branch: string
  /** Branch gốc để tách; chỉ dùng khi `branch` chưa tồn tại. */
  base?: string
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

/* ---------- Settings ---------- */

export type CursorStyle = 'block' | 'bar' | 'underline'
export type Density = 'compact' | 'comfortable'

export interface TerminalSettings {
  fontFamily: string
  fontSize: number
  scrollback: number
  cursorStyle: CursorStyle
  cursorBlink: boolean
}

export interface UiSettings {
  accent: string
  density: Density
}

export interface BehaviorSettings {
  defaultShell: ShellId
  defaultAgentId: string
  /** Bật: tự Enter lệnh agent. Tắt (mặc định): chỉ điền sẵn, người dùng tự chạy. */
  autoRunAgentCommand: boolean
  confirmClosePane: boolean
  saveTranscripts: boolean
  /** Trần dung lượng transcript mỗi pane; vượt thì cắt bỏ phần đầu, giữ đuôi. */
  transcriptMaxBytes: number
}

export interface AppSettings {
  terminal: TerminalSettings
  ui: UiSettings
  behavior: BehaviorSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  terminal: {
    fontFamily: "'Cascadia Mono', Consolas, 'Courier New', monospace",
    fontSize: 13,
    scrollback: 5000,
    cursorStyle: 'bar',
    cursorBlink: true
  },
  ui: {
    accent: '#3b82f6',
    density: 'comfortable'
  },
  behavior: {
    defaultShell: 'powershell',
    defaultAgentId: 'shell',
    autoRunAgentCommand: false,
    confirmClosePane: true,
    saveTranscripts: true,
    transcriptMaxBytes: 1024 * 1024
  }
}

/* ---------- Persistence ---------- */

export const STATE_VERSION = 3

export interface PersistedPane {
  /** Giữ nguyên id để khớp với leaf trong cây layout khi khôi phục. */
  paneId: string
  shell: ShellId
  cwd: string
  agentId: string | null
  /** Định danh trên task board (a1, a2…). Agent gọi nhau bằng tên này nên phải bền. */
  slot?: string | null
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
  settings: AppSettings
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
  sharedWorktree: true,
  settings: DEFAULT_SETTINGS
}

/** Biên độ hợp lệ của sidebar, khớp minSize/maxSize của Panel trong Workspace.tsx. */
export const SIDEBAR_MIN_PCT = 12
export const SIDEBAR_MAX_PCT = 45

/** Shape của state.json trước version 2 — chỉ dùng cho migrate. */
export interface LegacyPersistedState {
  workspaceRoot?: string | null
  layout?: string
  panes?: { shell: ShellId; cwd: string }[]
  sidebarVisible?: boolean
  sidebarWidth?: number
  sharedWorktree?: boolean
}
