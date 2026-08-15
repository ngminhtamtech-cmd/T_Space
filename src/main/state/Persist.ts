import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { DEFAULT_STATE, type PersistedState } from '@shared/types'

function statePath(): string {
  return join(app.getPath('userData'), 'state.json')
}

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await readFile(statePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return { ...DEFAULT_STATE, ...parsed }
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
