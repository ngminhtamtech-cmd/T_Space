import { useState } from 'react'
import { DEFAULT_AGENT_ID, DEFAULT_PRESET_ID } from '@shared/presets'
import type { SavedWorkspace } from '@shared/types'
import { useStore } from '@renderer/store'
import { newId } from '@renderer/utils/id'
import { usePaneActions } from '@renderer/hooks/usePaneActions'
import { useWorkspaceActions } from '@renderer/hooks/useWorkspaceActions'
import { askText } from '@renderer/components/Prompt/promptStore'
import { FolderIcon, GearIcon, LayersIcon } from '@renderer/components/icons'
import { ConfigPanel } from './ConfigPanel'
import { WorkspaceList } from './WorkspaceList'

export function Launcher(): React.JSX.Element {
  const recents = useStore((s) => s.recentWorkspaces)
  const presets = useStore((s) => s.layoutPresets)
  const agents = useStore((s) => s.agents)
  const savedWorkspaces = useStore((s) => s.savedWorkspaces)
  const setSavedWorkspaces = useStore((s) => s.setSavedWorkspaces)
  const setAgents = useStore((s) => s.setAgents)
  const setLayoutEditor = useStore((s) => s.setLayoutEditor)
  const setView = useStore((s) => s.setView)
  const setToast = useStore((s) => s.setToast)

  // Hydrate từ state.json là bất đồng bộ, chạy sau lần render đầu — nên chọn mặc
  // định phải tính lại mỗi lần render chứ không khởi tạo một lần trong useState.
  const [picked, setPicked] = useState<string | null>(null)
  const selectedPath = picked ?? recents[0]?.path ?? null

  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID)
  const [agentId, setAgentId] = useState(DEFAULT_AGENT_ID)
  const [opening, setOpening] = useState(false)

  const { openWorkspace } = useWorkspaceActions()
  const { createTabFromLayout } = usePaneActions()

  const preset = presets.find((p) => p.id === presetId) ?? presets[0]!

  const open = async (): Promise<void> => {
    if (!selectedPath || opening) return
    setOpening(true)
    try {
      if (!(await openWorkspace(selectedPath))) return

      const tabId = await createTabFromLayout(preset.name, preset.layout, {
        cwds: preset.cwds,
        agentId,
        fallbackCwd: selectedPath
      })
      if (tabId) setView('workspace')
    } finally {
      setOpening(false)
    }
  }

  const applySaved = (saved: SavedWorkspace): void => {
    setPicked(saved.path)
    if (saved.presetId && presets.some((p) => p.id === saved.presetId)) setPresetId(saved.presetId)
    if (saved.agentId && agents.some((a) => a.id === saved.agentId)) setAgentId(saved.agentId)
  }

  const saveCurrent = async (): Promise<void> => {
    if (!selectedPath) return
    const name = await askText('Tên workspace', basename(selectedPath))
    if (!name) return
    setSavedWorkspaces([
      ...savedWorkspaces,
      { id: newId('ws-'), name, path: selectedPath, presetId, agentId }
    ])
  }

  const addCustomAgent = async (): Promise<void> => {
    const label = await askText('Tên agent (vd: Claude Code)')
    if (!label) return
    const command = await askText(`Lệnh chạy khi mở pane cho "${label}"`)
    if (command === null) return

    const agent = {
      id: newId('agent-'),
      label,
      shell: 'powershell' as const,
      command: command.trim(),
      builtin: false
    }
    setAgents([...agents, agent])
    setAgentId(agent.id)
  }

  const openCustomLayout = (): void => {
    if (!selectedPath) {
      setToast('Chọn thư mục trước khi thiết kế layout.')
      return
    }
    setLayoutEditor('pickPreset')
  }

  return (
    <>
      <div className="launcher">
        <nav className="rail" aria-label="Khu vực">
          <button className="rail__btn rail__btn--on" title="Workspaces">
            <FolderIcon />
          </button>
          <button className="rail__btn" title="Layout preset" onClick={openCustomLayout}>
            <LayersIcon />
          </button>
          <span className="rail__spacer" />
          <button
            className="rail__btn"
            title="Cấu hình"
            onClick={() => useStore.getState().setModal('settings')}
          >
            <GearIcon />
          </button>
        </nav>

        <WorkspaceList
          selectedPath={selectedPath}
          onSelect={setPicked}
          onApplySaved={applySaved}
          onSaveCurrent={() => void saveCurrent()}
        />

        <ConfigPanel
          presetId={presetId}
          agentId={agentId}
          onPickPreset={setPresetId}
          onPickAgent={setAgentId}
          onCustomLayout={openCustomLayout}
          onCustomAgent={() => void addCustomAgent()}
        />
      </div>

      <div className="launcher-foot">
        <span>
          {selectedPath ? (
            <>
              Sẽ mở <strong>{basename(selectedPath)}</strong> · {preset.name} ·{' '}
              {agents.find((a) => a.id === agentId)?.label ?? 'Shell'}
            </>
          ) : (
            'Chọn một thư mục để bắt đầu'
          )}
        </span>

        <span className="launcher-foot__spacer" />

        <span className="launcher-foot__keys">
          <span>
            <kbd>Ctrl</kbd>+<kbd>\</kbd> split
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>T</kbd> tab
          </span>
        </span>

        <button
          className="btn btn--primary"
          onClick={() => void open()}
          disabled={!selectedPath || opening}
        >
          {opening ? 'Đang mở…' : 'Open'}
        </button>
      </div>
    </>
  )
}

function basename(dir: string): string {
  return dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || dir
}
