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
import { askConfirm } from '@renderer/components/Prompt/promptStore'

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

export interface CreateTabOptions {
  /** cwd theo paneId của preset; thiếu thì dùng fallbackCwd. */
  cwds?: Record<string, string>
  /** Agent chung cho cả tab. */
  agentId?: string
  /** Agent riêng theo từng paneId của preset — thắng agentId khi có. */
  agentIds?: Record<string, string>
  fallbackCwd?: string
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
      const slot = nextSlot(tab.panes.map((p) => p.slot))
      const pane = await spawnPane(cwd, agent, newPaneId(), slot)
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
    async (tabId: string, paneId: string): Promise<void> => {
      const state = useStore.getState()
      const tab = state.tabs.find((t) => t.id === tabId)
      const pane = tab?.panes.find((p) => p.id === paneId)
      if (!pane) return

      // Pane đã thoát thì không còn gì để mất, đừng hỏi thừa.
      if (state.settings.behavior.confirmClosePane && !pane.exited) {
        const agent = state.agents.find((a) => a.id === pane.agentId)
        const what = agent?.command ? agent.label : 'terminal'
        if (!(await askConfirm(`Đóng pane ${pane.slot} (${what})?`, 'Đóng'))) return
      }

      if (pane.ptyId) void window.tspace.pty.kill(pane.ptyId)
      // Pane đã đóng hẳn thì transcript của nó là rác — pane khôi phục lại mới cần giữ.
      void window.tspace.transcript.clear(paneId)
      removePane(tabId, paneId)
    },
    [removePane]
  )

  const closeActivePane = useCallback((): void => {
    const tab = getActiveTab()
    if (tab?.activePaneId) void closePane(tab.id, tab.activePaneId)
  }, [closePane])

  /**
   * Dựng một tab hoàn chỉnh từ cây layout (preset dựng sẵn hoặc Layout Editor).
   * Spawn tuần tự: giới hạn PTY đọc số session hiện tại, chạy song song sẽ đọc sai.
   */
  const createTabFromLayout = useCallback(
    async (
      name: string,
      layout: PaneNode,
      options: CreateTabOptions = {}
    ): Promise<string | null> => {
      const state = useStore.getState()
      const fallback = options.fallbackCwd ?? state.workspace?.root
      if (!fallback) {
        setToast('Mở một thư mục workspace trước khi tạo tab.')
        return null
      }

      // Đổi paneId sang id thật, đồng thời nhớ cwd và agent gắn với từng leaf của preset.
      const cwdByNewId: Record<string, string> = {}
      const agentByNewId: Record<string, string | undefined> = {}
      const instantiated = cloneLayout(layout, (oldId) => {
        const id = newPaneId()
        cwdByNewId[id] = options.cwds?.[oldId] ?? fallback
        agentByNewId[id] = options.agentIds?.[oldId] ?? options.agentId
        return id
      })

      const tab = newTab(name)
      addTab(tab)

      const wanted = collectLeaves(instantiated)
      const spawned: Pane[] = []
      for (const paneId of wanted) {
        const agent = resolveAgent(state.agents, agentByNewId[paneId])
        const slot = nextSlot(spawned.map((p) => p.slot))
        const pane = await spawnPane(cwdByNewId[paneId] ?? fallback, agent, paneId, slot)
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
        // Slot đã lưu thì giữ nguyên — task trên board đang trỏ tới đúng tên đó.
        const slot = item.slot ?? nextSlot(panes.map((p) => p.slot))
        const pane = await spawnPane(item.cwd, { ...agent, shell: item.shell }, item.paneId, slot)
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
  paneId = newPaneId(),
  slot = 'a1'
): Promise<Pane | null> {
  try {
    const ptyId = await window.tspace.pty.spawn({
      paneId,
      shell: agent.shell,
      cwd,
      cols: INITIAL_COLS,
      rows: INITIAL_ROWS,
      initialCommand: agent.command || undefined,
      submitInitialCommand: useStore.getState().settings.behavior.autoRunAgentCommand,
      env: { ...agent.env, ...boardEnv(cwd, slot) }
    })
    return { id: paneId, ptyId, shell: agent.shell, cwd, agentId: agent.id, slot, exited: false }
  } catch (err) {
    useStore.getState().setToast(toMessage(err))
    return null
  }
}

/**
 * Biến môi trường để agent tự tìm được task board dùng chung mà không cần ai nhắc.
 * `.tspace/AGENTS.md` mô tả đúng ba biến này.
 */
function boardEnv(cwd: string, slot: string): Record<string, string> {
  const sep = cwd.includes('/') && !cwd.includes('\\') ? '/' : '\\'
  const root = cwd.replace(/[\\/]+$/, '')
  return {
    TSPACE_AGENT_SLOT: slot,
    TSPACE_WORKTREE: root,
    TSPACE_BOARD: `${root}${sep}.tspace${sep}board.json`
  }
}

/** Slot nhỏ nhất chưa ai dùng trong tab — đóng pane giữa chừng không tạo lỗ hổng tên. */
function nextSlot(taken: Iterable<string>): string {
  const used = new Set(taken)
  for (let i = 1; ; i += 1) {
    const slot = `a${i}`
    if (!used.has(slot)) return slot
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
