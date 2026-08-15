import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { rowLayout } from '@shared/layout'
import {
  DEFAULT_STATE,
  STATE_VERSION,
  type LegacyPersistedState,
  type PersistedPane,
  type PersistedState
} from '@shared/types'

function statePath(): string {
  return join(app.getPath('userData'), 'state.json')
}

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await readFile(statePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedState> & LegacyPersistedState
    return migrate({ ...DEFAULT_STATE, ...parsed })
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await writeFile(statePath(), JSON.stringify(state, null, 2), 'utf8')
  } catch {
    // Không chặn app chỉ vì không ghi được state.
  }
}

/**
 * v1 lưu một danh sách pane phẳng + tên layout preset. v2 lưu nhiều tab, mỗi tab
 * một cây layout. Dựng lại thành đúng một tab xếp hàng ngang.
 */
function migrate(state: PersistedState & LegacyPersistedState): PersistedState {
  if (state.version === STATE_VERSION) return stripLegacy(state)

  const legacyPanes = Array.isArray(state.panes) ? state.panes : []
  const panes: PersistedPane[] = legacyPanes.map((pane, i) => ({
    paneId: `p${i + 1}`,
    shell: pane.shell,
    cwd: pane.cwd,
    agentId: null
  }))

  return stripLegacy({
    ...state,
    version: STATE_VERSION,
    tabs:
      panes.length > 0
        ? [{ name: 'main', layout: rowLayout(panes.map((p) => p.paneId)), panes }]
        : [],
    activeTabIndex: 0,
    recentWorkspaces: state.workspaceRoot
      ? [
          {
            path: state.workspaceRoot,
            name: basename(state.workspaceRoot),
            lastOpenedAt: Date.now()
          }
        ]
      : [],
    savedWorkspaces: [],
    layoutPresets: [],
    agents: []
  })
}

function stripLegacy(state: PersistedState & LegacyPersistedState): PersistedState {
  const { layout: _layout, panes: _panes, ...rest } = state
  return rest
}

function basename(dir: string): string {
  return dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || dir
}
