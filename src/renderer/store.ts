import { create } from 'zustand'
import {
  DEFAULT_STATE,
  LAYOUTS,
  MAX_PANES,
  type GitStatusInfo,
  type LayoutId,
  type PersistedState,
  type ShellId,
  type ShellProfile,
  type WorkspaceInfo
} from '@shared/types'

export interface Pane {
  /** Id cục bộ của renderer, ổn định suốt vòng đời pane. */
  id: string
  /** Id PTY ở main process; null sau khi tiến trình thoát. */
  ptyId: string | null
  shell: ShellId
  cwd: string
  exited: boolean
}

export interface OpenFile {
  path: string
  content: string
  dirty: boolean
}

interface AppState {
  workspace: WorkspaceInfo | null
  gitStatus: GitStatusInfo | null
  shells: ShellProfile[]
  panes: Pane[]
  activePaneId: string | null
  layout: LayoutId
  sidebarVisible: boolean
  sidebarWidth: number
  sharedWorktree: boolean
  openFile: OpenFile | null
  toast: string | null
  hydrated: boolean

  setWorkspace: (info: WorkspaceInfo | null) => void
  setGitStatus: (status: GitStatusInfo | null) => void
  setShells: (shells: ShellProfile[]) => void
  addPane: (pane: Pane) => void
  updatePane: (id: string, patch: Partial<Pane>) => void
  removePane: (id: string) => void
  setActivePane: (id: string | null) => void
  setLayout: (layout: LayoutId) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setSharedWorktree: (shared: boolean) => void
  setOpenFile: (file: OpenFile | null) => void
  updateOpenFile: (content: string) => void
  markFileSaved: () => void
  setToast: (message: string | null) => void
  hydrate: (state: PersistedState) => void
  toPersisted: () => PersistedState
}

export const useStore = create<AppState>((set, get) => ({
  workspace: null,
  gitStatus: null,
  shells: [],
  panes: [],
  activePaneId: null,
  layout: DEFAULT_STATE.layout,
  sidebarVisible: DEFAULT_STATE.sidebarVisible,
  sidebarWidth: DEFAULT_STATE.sidebarWidth,
  sharedWorktree: DEFAULT_STATE.sharedWorktree,
  openFile: null,
  toast: null,
  hydrated: false,

  setWorkspace: (workspace) => set({ workspace }),
  setGitStatus: (gitStatus) => set({ gitStatus }),
  setShells: (shells) => set({ shells }),

  addPane: (pane) =>
    set((s) => {
      if (s.panes.length >= MAX_PANES) return s
      const panes = [...s.panes, pane]
      return { panes, activePaneId: pane.id, layout: layoutFor(panes.length, s.layout) }
    }),

  updatePane: (id, patch) =>
    set((s) => ({ panes: s.panes.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

  removePane: (id) =>
    set((s) => {
      const panes = s.panes.filter((p) => p.id !== id)
      const activePaneId =
        s.activePaneId === id ? (panes[panes.length - 1]?.id ?? null) : s.activePaneId
      return { panes, activePaneId, layout: layoutFor(panes.length, s.layout) }
    }),

  setActivePane: (activePaneId) => set({ activePaneId }),
  setLayout: (layout) => set({ layout }),
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
      layout: state.layout,
      sidebarVisible: state.sidebarVisible,
      sidebarWidth: state.sidebarWidth,
      sharedWorktree: state.sharedWorktree,
      hydrated: true
    }),

  toPersisted: () => {
    const s = get()
    return {
      workspaceRoot: s.workspace?.root ?? null,
      layout: s.layout,
      panes: s.panes.map((p) => ({ shell: p.shell, cwd: p.cwd })),
      sidebarVisible: s.sidebarVisible,
      sidebarWidth: s.sidebarWidth,
      sharedWorktree: s.sharedWorktree
    }
  }
}))

/**
 * Layout hiện tại chỉ đổi khi không còn đủ ô cho số pane thực tế — giữ nguyên
 * lựa chọn thủ công của người dùng nếu vẫn vừa.
 */
function layoutFor(paneCount: number, current: LayoutId): LayoutId {
  const currentInfo = LAYOUTS.find((l) => l.id === current)
  if (currentInfo && currentInfo.paneCount >= paneCount) return current
  const fit = LAYOUTS.find((l) => l.paneCount >= paneCount)
  return fit?.id ?? 'grid6'
}
