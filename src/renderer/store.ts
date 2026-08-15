import { create } from 'zustand'
import { collectLeaves, removeLeaf, resizeSplit, splitLeaf } from '@shared/layout'
import { BUILTIN_AGENTS, BUILTIN_PRESETS } from '@shared/presets'
import {
  DEFAULT_STATE,
  MAX_PANES_PER_TAB,
  STATE_VERSION,
  type AgentProfile,
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
  exited: boolean
}

export interface Tab {
  id: string
  name: string
  /** null khi tab chưa có pane nào. */
  layout: PaneNode | null
  panes: Pane[]
  activePaneId: string | null
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

interface AppState {
  view: View
  layoutEditor: LayoutEditorMode | null
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
  openFile: OpenFile | null
  toast: string | null
  hydrated: boolean

  setView: (view: View) => void
  setLayoutEditor: (mode: LayoutEditorMode | null) => void
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

  setAgents: (agents: AgentProfile[]) => void
  setLayoutPresets: (presets: LayoutPreset[]) => void
  addRecentWorkspace: (path: string) => void
  removeRecentWorkspace: (path: string) => void
  setSavedWorkspaces: (list: SavedWorkspace[]) => void

  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setSharedWorktree: (shared: boolean) => void
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

export const useStore = create<AppState>((set, get) => ({
  view: 'launcher',
  layoutEditor: null,
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
  openFile: null,
  toast: null,
  hydrated: false,

  setView: (view) => set({ view }),
  setLayoutEditor: (layoutEditor) => set({ layoutEditor }),
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
        return { ...tab, panes, layout, activePaneId }
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
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setSharedWorktree: (sharedWorktree) => set({ sharedWorktree }),

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
      sharedWorktree: state.sharedWorktree
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
                agentId: p.agentId
              }))
            }))
          : s.pendingTabs,
      activeTabIndex: Math.max(
        0,
        s.tabs.findIndex((t) => t.id === s.activeTabId)
      ),
      layoutPresets: s.layoutPresets.filter((p) => !p.builtin),
      agents: s.agents.filter((a) => !a.builtin),
      sidebarVisible: s.sidebarVisible,
      sidebarWidth: s.sidebarWidth,
      sharedWorktree: s.sharedWorktree
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
  return { id: newId('tab-'), name, layout: null, panes: [], activePaneId: null }
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

/** Bản dựng sẵn luôn thắng để sửa lỗi/đổi tên áp được cho state đã lưu. */
function mergeById<T extends { id: string }>(builtin: T[], custom: T[]): T[] {
  const ids = new Set(builtin.map((item) => item.id))
  return [...builtin, ...custom.filter((item) => !ids.has(item.id))]
}

function samePath(a: string, b: string): boolean {
  return a.replace(/[\\/]+$/, '').toLowerCase() === b.replace(/[\\/]+$/, '').toLowerCase()
}

function basename(dir: string): string {
  return dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || dir
}
