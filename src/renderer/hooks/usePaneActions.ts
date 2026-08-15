import { useCallback } from 'react'
import { cloneLayout, collectLeaves, reconcile, removeLeaf } from '@shared/layout'
import { DEFAULT_AGENT_ID } from '@shared/presets'
import {
  MAX_PANES_PER_TAB,
  type AgentProfile,
  type PaneNode,
  type PersistedPane,
  type SplitDirection
} from '@shared/types'
import { getActiveTab, newPaneId, newTab, useStore, type Pane, type Tab } from '@renderer/store'

/** Kích thước tạm lúc spawn; ResizeObserver của pane sẽ resize lại ngay sau khi mount. */
const INITIAL_COLS = 80
const INITIAL_ROWS = 24

export interface NewPaneOptions {
  tabId?: string
  cwd?: string
  agentId?: string
  /** Chia pane này thay vì nối vào cuối. */
  splitFrom?: { paneId: string; direction: SplitDirection }
}

export function usePaneActions() {
  const addPane = useStore((s) => s.addPane)
  const removePane = useStore((s) => s.removePane)
  const addTab = useStore((s) => s.addTab)
  const setToast = useStore((s) => s.setToast)

  /**
   * Spawn PTY xong mới đưa pane vào store. Nếu để component tự spawn sau khi mount,
   * việc thêm pane liên tiếp có thể remount component giữa chừng và giết PTY đang tạo.
   */
  const newPane = useCallback(
    async (options: NewPaneOptions = {}): Promise<string | null> => {
      const state = useStore.getState()
      const tab = options.tabId
        ? state.tabs.find((t) => t.id === options.tabId)
        : getActiveTab()

      if (!tab) {
        setToast('Chưa có tab nào. Tạo tab mới trước.')
        return null
      }

      if (tab.panes.length >= MAX_PANES_PER_TAB) {
        setToast(`Tab đã đạt ${MAX_PANES_PER_TAB} pane. Đóng bớt hoặc mở tab mới.`)
        return null
      }

      const cwd = resolveCwd(options.cwd, tab)
      if (!cwd) {
        setToast('Mở một thư mục workspace trước khi tạo terminal.')
        return null
      }

      const agent = resolveAgent(state.agents, options.agentId ?? currentAgentId(tab))
      const pane = await spawnPane(cwd, agent)
      if (!pane) {
        return null
      }

      addPane(tab.id, pane, options.splitFrom)
      return pane.id
    },
    [addPane, setToast]
  )

  /** Chia pane đang focus — cơ chế Split Editor: chỉ pane active bị chia. */
  const splitActivePane = useCallback(
    async (direction: SplitDirection): Promise<void> => {
      const tab = getActiveTab()
      const paneId = tab?.activePaneId
      if (!tab || !paneId) return
      const source = tab.panes.find((p) => p.id === paneId)
      await newPane({
        tabId: tab.id,
        // Pane mới kế thừa cwd và agent của pane bị chia.
        cwd: source?.cwd,
        agentId: source?.agentId ?? undefined,
        splitFrom: { paneId, direction }
      })
    },
    [newPane]
  )

  const closePane = useCallback(
    (tabId: string, paneId: string): void => {
      const tab = useStore.getState().tabs.find((t) => t.id === tabId)
      const pane = tab?.panes.find((p) => p.id === paneId)
      if (!pane) return
      if (pane.ptyId) void window.tspace.pty.kill(pane.ptyId)
      removePane(tabId, paneId)
    },
    [removePane]
  )

  const closeActivePane = useCallback((): void => {
    const tab = getActiveTab()
    if (tab?.activePaneId) closePane(tab.id, tab.activePaneId)
  }, [closePane])

  /**
   * Dựng một tab hoàn chỉnh từ cây layout (preset dựng sẵn hoặc Layout Editor).
   * Spawn tuần tự: giới hạn PTY đọc số session hiện tại, chạy song song sẽ đọc sai.
   */
  const createTabFromLayout = useCallback(
    async (
      name: string,
      layout: PaneNode,
      options: { cwds?: Record<string, string>; agentId?: string; fallbackCwd?: string } = {}
    ): Promise<string | null> => {
      const state = useStore.getState()
      const fallback = options.fallbackCwd ?? state.workspace?.root
      if (!fallback) {
        setToast('Mở một thư mục workspace trước khi tạo tab.')
        return null
      }

      const agent = resolveAgent(state.agents, options.agentId)

      // Đổi paneId sang id thật, đồng thời nhớ cwd gắn với từng leaf của preset.
      const cwdByNewId: Record<string, string> = {}
      const instantiated = cloneLayout(layout, (oldId) => {
        const id = newPaneId()
        cwdByNewId[id] = options.cwds?.[oldId] ?? fallback
        return id
      })

      const tab = newTab(name)
      addTab(tab)

      const wanted = collectLeaves(instantiated)
      const spawned: Pane[] = []
      for (const paneId of wanted) {
        const pane = await spawnPane(cwdByNewId[paneId] ?? fallback, agent, paneId)
        if (pane) spawned.push(pane)
      }

      if (spawned.length === 0) {
        useStore.getState().closeTab(tab.id)
        return null
      }

      // Ghép cây một lần: pane nào spawn hỏng thì leaf của nó bị loại khỏi layout.
      useStore.setState((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tab.id
            ? {
                ...t,
                layout: pruneTo(instantiated, spawned.map((p) => p.id)),
                panes: spawned,
                activePaneId: spawned[0]!.id
              }
            : t
        )
      }))

      return tab.id
    },
    [addTab, setToast]
  )

  /**
   * Spawn lại pane cho một tab đã khôi phục từ state.json. Giữ nguyên paneId để
   * khớp với leaf trong cây layout đã lưu; leaf nào spawn hỏng sẽ bị cắt khỏi cây.
   */
  const restoreTabPanes = useCallback(
    async (tabId: string, persisted: PersistedPane[]): Promise<number> => {
      const agents = useStore.getState().agents
      const panes: Pane[] = []

      // Tuần tự: giới hạn PTY ở main đọc số session hiện tại, song song sẽ đọc sai.
      for (const item of persisted.slice(0, MAX_PANES_PER_TAB)) {
        const agent = resolveAgent(agents, item.agentId ?? undefined)
        const pane = await spawnPane(item.cwd, { ...agent, shell: item.shell }, item.paneId)
        if (pane) panes.push(pane)
      }

      useStore.setState((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                panes,
                layout: reconcile(
                  t.layout,
                  panes.map((p) => p.id)
                ),
                activePaneId: panes[0]?.id ?? null
              }
            : t
        )
      }))

      return panes.length
    },
    []
  )

  return {
    newPane,
    splitActivePane,
    closePane,
    closeActivePane,
    createTabFromLayout,
    restoreTabPanes
  }
}

/* ---------- Nội bộ ---------- */

async function spawnPane(
  cwd: string,
  agent: AgentProfile,
  paneId = newPaneId()
): Promise<Pane | null> {
  try {
    const ptyId = await window.tspace.pty.spawn({
      shell: agent.shell,
      cwd,
      cols: INITIAL_COLS,
      rows: INITIAL_ROWS,
      initialCommand: agent.command || undefined
    })
    return { id: paneId, ptyId, shell: agent.shell, cwd, agentId: agent.id, exited: false }
  } catch (err) {
    useStore.getState().setToast(toMessage(err))
    return null
  }
}

function resolveCwd(explicit: string | undefined, tab: Tab): string | undefined {
  const state = useStore.getState()
  const root = state.workspace?.root
  if (explicit) return explicit
  // Ở chế độ shared worktree, pane mới luôn bám gốc workspace thay vì cwd của pane trước.
  return (state.sharedWorktree ? root : tab.panes.at(-1)?.cwd) ?? root
}

function currentAgentId(tab: Tab): string | undefined {
  return tab.panes.find((p) => p.id === tab.activePaneId)?.agentId ?? undefined
}

function resolveAgent(agents: AgentProfile[], agentId: string | undefined): AgentProfile {
  return (
    agents.find((a) => a.id === agentId) ??
    agents.find((a) => a.id === DEFAULT_AGENT_ID) ??
    agents[0]! // BUILTIN_AGENTS luôn có ít nhất một mục
  )
}

/** Bỏ khỏi cây những leaf không spawn được. */
function pruneTo(layout: PaneNode, keep: string[]): PaneNode | null {
  let next: PaneNode | null = layout
  for (const id of collectLeaves(layout)) {
    if (!keep.includes(id) && next) next = removeLeaf(next, id)
  }
  return next
}

function toMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  // Lỗi ném từ ipcMain.handle bị bọc thêm tiền tố "Error invoking remote method ...".
  return raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '')
}
