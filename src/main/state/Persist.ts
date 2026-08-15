import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { rowLayout } from '@shared/layout'
import {
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  STATE_VERSION,
  type AppSettings,
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
  // Ghi tmp rồi rename: crash giữa chừng chỉ hỏng file tmp, state.json cũ vẫn nguyên.
  const target = statePath()
  const tmp = `${target}.tmp`
  try {
    await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
    await rename(tmp, target)
  } catch {
    // Không chặn app chỉ vì không ghi được state.
  }
}

/**
 * v1 lưu một danh sách pane phẳng + tên layout preset. v2 lưu nhiều tab, mỗi tab
 * một cây layout. v3 thêm khối `settings`.
 *
 * Spread `{ ...DEFAULT_STATE, ...parsed }` ở loadState chỉ vá được khoá cấp một, nên
 * `settings` luôn phải merge sâu — state cũ có thể thiếu cả nhóm con.
 */
function migrate(state: PersistedState & LegacyPersistedState): PersistedState {
  const withSettings = { ...state, settings: mergeSettings(state.settings) }

  if (withSettings.version === STATE_VERSION) return stripLegacy(withSettings)

  // v2 đã đúng cấu trúc tab, chỉ thiếu settings.
  if (withSettings.version === 2) {
    return stripLegacy({ ...withSettings, version: STATE_VERSION })
  }

  const legacyPanes = Array.isArray(withSettings.panes) ? withSettings.panes : []
  const panes: PersistedPane[] = legacyPanes.map((pane, i) => ({
    paneId: `p${i + 1}`,
    shell: pane.shell,
    cwd: pane.cwd,
    agentId: null
  }))

  return stripLegacy({
    ...withSettings,
    version: STATE_VERSION,
    tabs:
      panes.length > 0
        ? [{ name: 'main', layout: rowLayout(panes.map((p) => p.paneId)), panes }]
        : [],
    activeTabIndex: 0,
    recentWorkspaces: withSettings.workspaceRoot
      ? [
          {
            path: withSettings.workspaceRoot,
            name: basename(withSettings.workspaceRoot),
            lastOpenedAt: Date.now()
          }
        ]
      : [],
    savedWorkspaces: [],
    layoutPresets: [],
    agents: []
  })
}

function mergeSettings(partial: Partial<AppSettings> | undefined): AppSettings {
  return {
    terminal: { ...DEFAULT_SETTINGS.terminal, ...partial?.terminal },
    ui: { ...DEFAULT_SETTINGS.ui, ...partial?.ui },
    behavior: { ...DEFAULT_SETTINGS.behavior, ...partial?.behavior }
  }
}

function stripLegacy(state: PersistedState & LegacyPersistedState): PersistedState {
  const { layout: _layout, panes: _panes, ...rest } = state
  return rest
}

function basename(dir: string): string {
  return dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || dir
}
