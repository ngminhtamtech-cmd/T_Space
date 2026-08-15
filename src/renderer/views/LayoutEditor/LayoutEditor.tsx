import { useMemo, useRef, useState } from 'react'
import { collectLeaves, computeGeometry, removeLeaf, resizeSplit, splitLeaf } from '@shared/layout'
import { MAX_PANES_PER_TAB, type PaneNode, type SplitDirection } from '@shared/types'
import { useStore } from '@renderer/store'
import { newId } from '@renderer/utils/id'
import { usePaneActions } from '@renderer/hooks/usePaneActions'
import { shortenPath } from '@renderer/utils/path'
import { PreviewDivider } from './PreviewDivider'

const FIRST_PANE = 'pane-1'

export function LayoutEditor(): React.JSX.Element {
  const mode = useStore((s) => s.layoutEditor)
  const setLayoutEditor = useStore((s) => s.setLayoutEditor)
  const setLayoutPresets = useStore((s) => s.setLayoutPresets)
  const setView = useStore((s) => s.setView)
  const presets = useStore((s) => s.layoutPresets)
  const agents = useStore((s) => s.agents)
  const workspaceRoot = useStore((s) => s.workspace?.root)
  const { createTabFromLayout } = usePaneActions()

  const [root, setRoot] = useState<PaneNode>({ kind: 'leaf', paneId: FIRST_PANE })
  const [selected, setSelected] = useState(FIRST_PANE)
  const [cwds, setCwds] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [agentId, setAgentId] = useState(agents[0]?.id ?? 'shell')
  const [busy, setBusy] = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)
  const geometry = useMemo(() => computeGeometry(root), [root])
  const leaves = useMemo(() => collectLeaves(root), [root])
  const full = leaves.length >= MAX_PANES_PER_TAB

  const split = (direction: SplitDirection): void => {
    if (full) return
    const paneId = newId('pane-')
    setRoot(splitLeaf(root, selected, direction, paneId))
    setSelected(paneId)
  }

  const remove = (): void => {
    if (leaves.length <= 1) return
    const next = removeLeaf(root, selected)
    if (!next) return
    setRoot(next)
    setSelected(collectLeaves(next)[0]!)
    setCwds((prev) => {
      const { [selected]: _dropped, ...rest } = prev
      return rest
    })
  }

  const setCwd = async (): Promise<void> => {
    const picked = await window.tspace.workspace.pickFolder('Chọn thư mục cho pane')
    if (picked) setCwds((prev) => ({ ...prev, [selected]: picked }))
  }

  const close = (): void => setLayoutEditor(null)

  const savePreset = (): string => {
    const id = newId('preset-')
    setLayoutPresets([
      ...presets,
      { id, name: name.trim() || `${leaves.length} pane`, layout: root, cwds, builtin: false }
    ])
    return id
  }

  const confirm = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      if (mode === 'pickPreset') {
        savePreset()
        close()
        return
      }

      // Có đặt tên thì lưu lại thành preset để lần sau dùng lại.
      if (name.trim()) savePreset()

      const tabId = await createTabFromLayout(name.trim() || `${leaves.length} pane`, root, {
        cwds,
        agentId,
        fallbackCwd: workspaceRoot
      })
      if (tabId) {
        setView('workspace')
        close()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="editor-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Layout editor"
      >
        <header className="editor-modal__head">
          <h2 className="editor-modal__title">
            {mode === 'pickPreset' ? 'New layout preset' : 'New tab layout'}
          </h2>

          <div className="editor-modal__actions">
            <button
              className="btn"
              onClick={() => split('row')}
              disabled={full}
              title={full ? `Tối đa ${MAX_PANES_PER_TAB} pane` : undefined}
            >
              Split right
            </button>
            <button
              className="btn"
              onClick={() => split('column')}
              disabled={full}
              title={full ? `Tối đa ${MAX_PANES_PER_TAB} pane` : undefined}
            >
              Split down
            </button>
            <button className="btn" onClick={remove} disabled={leaves.length <= 1}>
              Remove
            </button>
            <button className="btn" onClick={() => void setCwd()}>
              Set CWD
            </button>

            {mode === 'createTab' && (
              <select
                className="select"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                title="Agent chạy trong mọi pane của tab này"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>

        <div className="editor-modal__stage">
          <div className="editor-modal__canvas" ref={canvasRef}>
            {leaves.map((paneId, i) => {
              const rect = geometry.panes.get(paneId)!
              return (
                <div
                  key={paneId}
                  className={`preview-pane ${paneId === selected ? 'preview-pane--on' : ''}`}
                  style={{
                    left: `${rect.left}%`,
                    top: `${rect.top}%`,
                    width: `${rect.width}%`,
                    height: `${rect.height}%`
                  }}
                >
                  <button className="preview-pane__box" onClick={() => setSelected(paneId)}>
                    <span className="preview-pane__cwd" title={cwds[paneId]}>
                      {cwds[paneId] ? shortenPath(cwds[paneId]) : 'inherit'}
                    </span>
                    <span className="preview-pane__name">pane {i + 1}</span>
                  </button>
                </div>
              )
            })}

            {geometry.dividers.map((divider) => (
              <PreviewDivider
                key={`${divider.splitId}-${divider.index}`}
                divider={divider}
                containerRef={canvasRef}
                onResize={(splitId, index, delta) =>
                  setRoot((prev) => resizeSplit(prev, splitId, index, delta))
                }
              />
            ))}
          </div>
        </div>

        <footer className="editor-modal__foot">
          <input
            className="input"
            placeholder={`${leaves.length} pane`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Tên preset"
          />

          <span className="editor-modal__status">
            {leaves.length} panes · drag dividers
          </span>

          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={() => void confirm()} disabled={busy}>
            {mode === 'pickPreset' ? 'Save preset' : busy ? 'Đang tạo…' : 'Create tab'}
          </button>
        </footer>
      </div>
    </div>
  )
}
