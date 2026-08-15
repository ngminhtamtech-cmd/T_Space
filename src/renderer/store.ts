import { create } from 'zustand'
import { collectLeaves, removeLeaf, resizeSplit, splitLeaf } from '@shared/layout'
import { BUILTIN_AGENTS, BUILTIN_PRESETS } from '@shared/presets'
import type { Board } from '@shared/board'
import {
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  MAX_PANES_PER_TAB,
  SIDEBAR_MAX_PCT,
  SIDEBAR_MIN_PCT,
  STATE_VERSION,
  type AgentProfile,
  type AppSettings,
  type GitStatusInfo,
  type LayoutPreset,
  type PaneNode,
  type PersistedState,
  type PersistedTab,
  type RecentWorkspace,
  type SavedWorkspace,
  type ShellId,
  type ShellProfile,
  type SplitDirection,
  type WorkspaceInfo
} from '@shared/types'
import { newId } from './utils/id'

export interface Pane {
  /** Id cục bộ của renderer; cũng chính là paneId của leaf trong cây layout. */
  id: string
  /** Id PTY ở main process; null sau khi tiến trình thoát. */
  ptyId: string | null
  shell: ShellId
  cwd: string
  agentId: string | null
  /** Định danh trên task board (a1, a2…), cũng là $env:TSPACE_AGENT_SLOT của PTY. */
  slot: string
  exited: boolean
}

export interface Tab {
  id: string
  name: string
  /** null khi tab chưa có pane nào. */
  layout: PaneNode | null
  panes: Pane[]
  activePaneId: string | null
  /**
   * Pane đang phóng to chiếm cả lưới. Chỉ là trạng thái hiển thị nên không lưu vào
   * state.json — mở lại app luôn về lưới đầy đủ.
   */
  maximizedPaneId: string | null
}

export interface OpenFile {
  path: string
  content: string
  dirty: boolean
}

export type View = 'launcher' | 'workspace'

/**
 * `createTab` — mở từ màn làm việc, nút chính tạo tab ngay.
 * `pickPreset` — mở từ card "Custom…" ở Launcher, nút chính lưu preset rồi chọn nó.
 */
export type LayoutEditorMode = 'createTab' | 'pickPreset'

/** Modal toàn màn hình khác LayoutEditor; chỉ một cái mở tại một thời điểm. */
export type ModalKind = 'settings' | 'worktree'

interface AppState {
  view: View
  layoutEditor: LayoutEditorMode | null
  modal: ModalKind | null
  workspace: WorkspaceInfo | null
  gitStatus: GitStatusInfo | null
  shells: ShellProfile[]

  tabs: Tab[]
  activeTabId: string | null
  /**
   * Tab đọc từ state.json nhưng chưa dựng lại được (workspace mất, hết PTY…).
   * Giữ lại để lần lưu tiếp theo không xoá mất phiên làm việc cũ.
   */
  pendingTabs: PersistedTab[]

  agents: AgentProfile[]
  layoutPresets: LayoutPreset[]
  recentWorkspaces: RecentWorkspace[]
  savedWorkspaces: SavedWorkspace[]

  sidebarVisible: boolean
  sidebarWidth: number
  sharedWorktree: boolean
  settings: AppSettings
  /** Bảng task đọc từ `.tspace/board.json` của workspace hiện tại; null nếu chưa có. */
  board: Board | null
  openFile: OpenFile | null
  toast: string | null
  hydrated: boolean

  setView: (view: View) => void
  setLayoutEditor: (mode: LayoutEditorMode | null) => void
  setModal: (modal: ModalKind | null) => void
  setWorkspace: (info: WorkspaceInfo | null) => void
  setGitStatus: (status: GitStatusInfo | null) => void
  setShells: (shells: ShellProfile[]) => void

  addTab: (tab: Tab) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  renameTab: (tabId: string, name: string) => void

  /** Thêm pane vào tab. `splitFrom` xác định chia pane nào; thiếu thì nối vào cuối. */
  addPane: (
    tabId: string,
    pane: Pane,
    splitFrom?: { paneId: string; direction: SplitDirection }
  ) => void
  updatePane: (paneId: string, patch: Partial<Pane>) => void
  removePane: (tabId: string, paneId: string) => void
  setActivePane: (paneId: string) => void
  resizeDivider: (tabId: string, splitId: string, index: number, deltaPct: number) => void
  /** Phóng to pane chiếm cả lưới, gọi lại với chính pane đó để thu nhỏ. */
  toggleMaximizePane: (tabId: string, paneId: string | null) => void

  setAgents: (agents: AgentProfile[]) => void
  setLayoutPresets: (presets: LayoutPreset[]) => void
  addRecentWorkspace: (path: string) => void
  removeRecentWorkspace: (path: string) => void
  setSavedWorkspaces: (list: SavedWorkspace[]) => void

  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setSharedWorktree: (shared: boolean) => void
  /** Ghi đè từng nhóm settings; nhóm không truyền thì giữ nguyên. */
  setSettings: (patch: PartialSettings) => void
  setBoard: (board: Board | null) => void
  setOpenFile: (file: OpenFile | null) => void
  updateOpenFile: (content: string) => void
  markFileSaved: () => void
  setToast: (message: string | null) => void

  /** Nạp phần state không phụ thuộc PTY. Tab được dựng sau, khi pane spawn xong. */
  hydrate: (state: PersistedState) => void
  /** Bật cơ chế tự lưu. Chỉ gọi khi khôi phục đã kết thúc (kể cả khi thất bại). */
  finishHydration: () => void
  toPersisted: () => PersistedState
}

export interface PartialSettings {
  terminal?: Partial<AppSettings['terminal']>
  ui?: Partial<AppSettings['ui']>
  behavior?: Partial<AppSettings['behavior']>
}

export const useStore = create<AppState>((set, get) => ({
  view: 'launcher',
  layoutEditor: null,
  modal: null,
  workspace: null,
  gitStatus: null,
  shells: [],

  tabs: [],
  activeTabId: null,
  pendingTabs: [],

  agents: BUILTIN_AGENTS,
  layoutPresets: BUILTIN_PRESETS,
  recentWorkspaces: [],
  savedWorkspaces: [],

  sidebarVisible: DEFAULT_STATE.sidebarVisible,
  sidebarWidth: DEFAULT_STATE.sidebarWidth,
  sharedWorktree: DEFAULT_STATE.sharedWorktree,
  settings: DEFAULT_SETTINGS,
  board: null,
  openFile: null,
  toast: null,
  hydrated: false,

  setView: (view) => set({ view }),
  setLayoutEditor: (layoutEditor) => set({ layoutEditor }),
  setModal: (modal) => set({ modal }),
  setWorkspace: (workspace) => set({ workspace }),
  setGitStatus: (gitStatus) => set({ gitStatus }),
  setShells: (shells) => set({ shells }),

  // Có tab thật rồi thì bản sao lưu tạm không còn ý nghĩa.
  addTab: (tab) => set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id, pendingTabs: [] })),

  closeTab: (tabId) =>
    set((s) => {
      const index = s.tabs.findIndex((t) => t.id === tabId)
      if (index === -1) return s
      const tabs = s.tabs.filter((t) => t.id !== tabId)
      const activeTabId =
        s.activeTabId === tabId ? (tabs[index] ?? tabs[index - 1])?.id ?? null : s.activeTabId
      return { tabs, activeTabId }
    }),

  setActiveTab: (activeTabId) => set({ activeTabId }),

  renameTab: (tabId, name) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, name } : t)) })),

  addPane: (tabId, pane, splitFrom) =>
    set((s) => ({
      tabs: s.tabs.map((tab) => {
        if (tab.id !== tabId) return tab
        if (tab.panes.length >= MAX_PANES_PER_TAB) return tab

        const layout = insertLeaf(tab.layout, pane.id, splitFrom)
        return {
          ...tab,
          layout,
          panes: [...tab.panes, pane],
          // Focus nhảy sang pane mới để gõ được ngay.
          activePaneId: pane.id
        }
      })
    })),

  updatePane: (paneId, patch) =>
    set((s) => ({
      tabs: s.tabs.map((tab) =>
        tab.panes.some((p) => p.id === paneId)
          ? { ...tab, panes: tab.panes.map((p) => (p.id === paneId ? { ...p, ...patch } : p)) }
          : tab
      )
    })),

  removePane: (tabId, paneId) =>
    set((s) => ({
      tabs: s.tabs.map((tab) => {
        if (tab.id !== tabId) return tab
        const panes = tab.panes.filter((p) => p.id !== paneId)
        const layout = tab.layout ? removeLeaf(tab.layout, paneId) : null
        const activePaneId =
          tab.activePaneId === paneId
            ? (collectLeaves(layout).at(-1) ?? null)
            : tab.activePaneId
        // Đóng đúng pane đang phóng to thì phải trả lưới về bình thường, nếu không
        // toàn bộ tab sẽ trắng vì trỏ tới một pane không còn tồn tại.
        const maximizedPaneId = tab.maximizedPaneId === paneId ? null : tab.maximizedPaneId
        return { ...tab, panes, layout, activePaneId, maximizedPaneId }
      })
    })),

  setActivePane: (paneId) =>
    set((s) => ({
      tabs: s.tabs.map((tab) =>
        tab.panes.some((p) => p.id === paneId) ? { ...tab, activePaneId: paneId } : tab
      )
    })),

  resizeDivider: (tabId, splitId, index, deltaPct) =>
    set((s) => ({
      tabs: s.tabs.map((tab) =>
        tab.id === tabId && tab.layout
          ? { ...tab, layout: resizeSplit(tab.layout, splitId, index, deltaPct) }
          : tab
      )
    })),

  toggleMaximizePane: (tabId, paneId) =>
    set((s) => ({
      tabs: s.tabs.map((tab) => {
        if (tab.id !== tabId) return tab
        const next = tab.maximizedPaneId === paneId ? null : paneId
        // Phóng to cũng là một cách chọn pane — focus theo cho khỏi gõ nhầm chỗ.
        return { ...tab, maximizedPaneId: next, activePaneId: next ?? tab.activePaneId }
      })
    })),

  setAgents: (agents) => set({ agents }),
  setLayoutPresets: (layoutPresets) => set({ layoutPresets }),

  addRecentWorkspace: (path) =>
    set((s) => ({
      recentWorkspaces: [
        { path, name: basename(path), lastOpenedAt: Date.now() },
        ...s.recentWorkspaces.filter((w) => !samePath(w.path, path))
      ].slice(0, 20)
    })),

  removeRecentWorkspace: (path) =>
    set((s) => ({ recentWorkspaces: s.recentWorkspaces.filter((w) => !samePath(w.path, path)) })),

  setSavedWorkspaces: (savedWorkspaces) => set({ savedWorkspaces }),

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),

  // react-resizable-panels bắn onResize thêm một lần lúc Panel sidebar bị gỡ khỏi
  // Group, với phần trăm không còn ý nghĩa. Nhận giá trị đó là ghi đè mất bề rộng
  // người dùng đã kéo — chặn thẳng mọi giá trị ngoài biên hợp lệ của Panel.
  setSidebarWidth: (sidebarWidth) =>
    set((s) =>
      sidebarWidth >= SIDEBAR_MIN_PCT && sidebarWidth <= SIDEBAR_MAX_PCT ? { sidebarWidth } : s
    ),

  setSharedWorktree: (sharedWorktree) => set({ sharedWorktree }),

  setSettings: (patch) =>
    set((s) => ({
      settings: {
        terminal: { ...s.settings.terminal, ...patch.terminal },
        ui: { ...s.settings.ui, ...patch.ui },
        behavior: { ...s.settings.behavior, ...patch.behavior }
      }
    })),

  setBoard: (board) => set({ board }),

  setOpenFile: (openFile) => set({ openFile }),
  updateOpenFile: (content) =>
    set((s) => (s.openFile ? { openFile: { ...s.openFile, content, dirty: true } } : s)),
  markFileSaved: () =>
    set((s) => (s.openFile ? { openFile: { ...s.openFile, dirty: false } } : s)),

  setToast: (toast) => set({ toast }),

  hydrate: (state) =>
    set({
      pendingTabs: state.tabs,
      agents: mergeById(BUILTIN_AGENTS, state.agents),
      layoutPresets: mergeById(BUILTIN_PRESETS, state.layoutPresets),
      recentWorkspaces: state.recentWorkspaces,
      savedWorkspaces: state.savedWorkspaces,
      sidebarVisible: state.sidebarVisible,
      sidebarWidth: state.sidebarWidth,
      sharedWorktree: state.sharedWorktree,
      settings: state.settings
    }),

  finishHydration: () => set({ hydrated: true }),

  toPersisted: () => {
    const s = get()
    return {
      version: STATE_VERSION,
      workspaceRoot: s.workspace?.root ?? null,
      recentWorkspaces: s.recentWorkspaces,
      savedWorkspaces: s.savedWorkspaces,
      tabs:
        s.tabs.length > 0
          ? s.tabs.map((tab) => ({
              name: tab.name,
              layout: tab.layout,
              panes: tab.panes.map((p) => ({
                paneId: p.id,
                shell: p.shell,
                cwd: p.cwd,
                agentId: p.agentId,
                slot: p.slot
              }))
            }))
          : s.pendingTabs,
      activeTabIndex: Math.max(
        0,
        s.tabs.findIndex((t) => t.id === s.activeTabId)
      ),
      layoutPresets: changedFrom(BUILTIN_PRESETS, s.layoutPresets),
      agents: changedFrom(BUILTIN_AGENTS, s.agents),
      sidebarVisible: s.sidebarVisible,
      sidebarWidth: s.sidebarWidth,
      sharedWorktree: s.sharedWorktree,
      settings: s.settings
    }
  }
}))

/* ---------- Selector dẫn xuất ---------- */

export function useActiveTab(): Tab | null {
  return useStore((s) => s.tabs.find((t) => t.id === s.activeTabId) ?? null)
}

export function getActiveTab(): Tab | null {
  const s = useStore.getState()
  return s.tabs.find((t) => t.id === s.activeTabId) ?? null
}

export function newTab(name: string): Tab {
  return {
    id: newId('tab-'),
    name,
    layout: null,
    panes: [],
    activePaneId: null,
    maximizedPaneId: null
  }
}

export function newPaneId(): string {
  return newId('p-')
}

/* ---------- Nội bộ ---------- */

function insertLeaf(
  layout: PaneNode | null,
  paneId: string,
  splitFrom?: { paneId: string; direction: SplitDirection }
): PaneNode {
  if (!layout) return { kind: 'leaf', paneId }
  if (splitFrom) return splitLeaf(layout, splitFrom.paneId, splitFrom.direction, paneId)
  // Không chỉ định pane nguồn: nối vào cuối hàng ngang cùng cấp gốc.
  return splitLeaf(layout, collectLeaves(layout).at(-1)!, 'row', paneId)
}

/**
 * Bản người dùng thắng khi trùng id — Settings cho phép sửa cả agent/preset dựng sẵn.
 * Thứ tự giữ theo danh sách builtin để giao diện không nhảy lung tung sau khi sửa.
 */
function mergeById<T extends { id: string }>(builtin: T[], custom: T[]): T[] {
  const overrides = new Map(custom.map((item) => [item.id, item]))
  const builtinIds = new Set(builtin.map((item) => item.id))
  return [
    ...builtin.map((item) => overrides.get(item.id) ?? item),
    ...custom.filter((item) => !builtinIds.has(item.id))
  ]
}

/**
 * Những mục cần ghi xuống đĩa: mục do người dùng tạo, cộng thêm mục builtin đã bị
 * sửa. Lọc theo cờ `builtin` như trước sẽ làm mất mọi tuỳ chỉnh trên agent dựng sẵn.
 */
function changedFrom<T extends { id: string; builtin: boolean }>(builtin: T[], current: T[]): T[] {
  const originals = new Map(builtin.map((item) => [item.id, JSON.stringify(item)]))
  return current.filter((item) => {
    const original = originals.get(item.id)
    return original === undefined || original !== JSON.stringify(item)
  })
}

function samePath(a: string, b: string): boolean {
  return a.replace(/[\\/]+$/, '').toLowerCase() === b.replace(/[\\/]+$/, '').toLowerCase()
}

function basename(dir: string): string {
  return dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || dir
}
