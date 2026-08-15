import { useEffect, useMemo, useState } from 'react'
import { collectLeaves } from '@shared/layout'
import { DEFAULT_PRESET_ID } from '@shared/presets'
import { useStore } from '@renderer/store'
import { usePaneActions } from '@renderer/hooks/usePaneActions'
import { useWorkspaceActions } from '@renderer/hooks/useWorkspaceActions'
import { MiniPreview } from '@renderer/views/Launcher/MiniPreview'

type Step = 'form' | 'commit' | 'worktree' | 'board' | 'panes'

const STEP_LABEL: Record<Exclude<Step, 'form'>, string> = {
  commit: 'Đang commit thay đổi…',
  worktree: 'Đang tạo worktree…',
  board: 'Đang dựng task board…',
  panes: 'Đang mở pane cho agent…'
}

/**
 * Commit nhanh rồi tách một worktree mới và mở ngay một tab đầy agent trỏ vào đó.
 *
 * Đây là luồng chính của app: nhiều agent cùng làm trên một worktree, tự giao việc
 * cho nhau qua `.tspace/board.json` và chấm chéo lẫn nhau.
 */
export function WorktreeModal(): React.JSX.Element {
  const workspace = useStore((s) => s.workspace)
  const gitStatus = useStore((s) => s.gitStatus)
  const presets = useStore((s) => s.layoutPresets)
  const agents = useStore((s) => s.agents)
  const defaultAgentId = useStore((s) => s.settings.behavior.defaultAgentId)
  const setModal = useStore((s) => s.setModal)
  const setView = useStore((s) => s.setView)
  const setToast = useStore((s) => s.setToast)
  const { createTabFromLayout } = usePaneActions()
  const { refreshGit } = useWorkspaceActions()

  const gitRoot = workspace?.gitRoot ?? null

  const [message, setMessage] = useState(() => `wip: ${stamp()}`)
  const [skipClean, setSkipClean] = useState(true)
  const [branch, setBranch] = useState('feat/')
  const [base, setBase] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [path, setPath] = useState('')
  const [pathTouched, setPathTouched] = useState(false)
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID)
  const [paneAgents, setPaneAgents] = useState<Record<string, string>>({})
  const [withBoard, setWithBoard] = useState(true)
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)

  const preset = presets.find((p) => p.id === presetId) ?? presets[0]!
  const leaves = useMemo(() => collectLeaves(preset.layout), [preset.layout])

  useEffect(() => {
    if (!gitRoot) return
    void window.tspace.git.listBranches(gitRoot).then((info) => {
      setBranches(info.all)
      setBase((current) => current || info.current || info.all[0] || '')
    })
  }, [gitRoot])

  // Gợi ý đường dẫn theo tên branch cho tới khi người dùng tự sửa.
  useEffect(() => {
    if (!gitRoot || pathTouched) return
    const clean = branch.trim()
    if (!clean || clean.endsWith('/')) return setPath('')
    void window.tspace.git.suggestWorktreePath(gitRoot, clean).then(setPath)
  }, [gitRoot, branch, pathTouched])

  const agentFor = (paneId: string): string => paneAgents[paneId] ?? defaultAgentId
  const busy = step !== 'form'
  const ready = Boolean(gitRoot) && branch.trim().length > 0 && !branch.trim().endsWith('/') && path.trim().length > 0

  const run = async (): Promise<void> => {
    if (!gitRoot || !ready) return
    setError(null)

    try {
      const dirty = (gitStatus?.changed ?? 0) > 0
      if (dirty || !skipClean) {
        setStep('commit')
        const result = await window.tspace.git.commitAll(gitRoot, message.trim() || `wip: ${stamp()}`)
        if (result.committed) setToast(`Đã commit ${result.files} file.`)
      }

      setStep('worktree')
      const created = await window.tspace.git.createWorktree(gitRoot, {
        path: path.trim(),
        branch: branch.trim(),
        base: base || undefined
      })

      if (withBoard) {
        setStep('board')
        await window.tspace.board.ensure(created.path)
      }

      setStep('panes')
      const cwds: Record<string, string> = {}
      const agentIds: Record<string, string> = {}
      for (const paneId of leaves) {
        cwds[paneId] = created.path
        agentIds[paneId] = agentFor(paneId)
      }

      const tabId = await createTabFromLayout(created.branch ?? branch.trim(), preset.layout, {
        cwds,
        agentIds,
        fallbackCwd: created.path
      })

      void refreshGit()
      if (!tabId) {
        // Worktree đã tạo xong rồi, đừng để người dùng tưởng là hỏng hết.
        setError('Đã tạo worktree nhưng không mở được pane nào. Kiểm tra giới hạn terminal.')
        setStep('form')
        return
      }

      setView('workspace')
      setModal(null)
    } catch (err) {
      setError(toMessage(err))
      setStep('form')
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && setModal(null)}>
      <div
        className="worktree-modal"
        role="dialog"
        aria-label="Commit và tạo worktree"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="worktree__head">
          <h2>Commit nhanh & tách worktree</h2>
          <p className="worktree__sub">
            {gitRoot ? (
              <>
                <b>⎇ {gitStatus?.branch ?? 'detached'}</b>
                {' · '}
                {gitStatus?.changed ?? 0} file thay đổi
              </>
            ) : (
              'Workspace hiện tại không phải repo git.'
            )}
          </p>
        </header>

        <div className="worktree__body">
          <section className="worktree__section">
            <h3>1. Commit thay đổi đang có</h3>
            <input
              className="input"
              value={message}
              disabled={busy}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nội dung commit"
            />
            <label className="settings__check">
              <input
                type="checkbox"
                checked={skipClean}
                disabled={busy}
                onChange={(e) => setSkipClean(e.target.checked)}
              />
              <span>Bỏ qua nếu không có gì thay đổi</span>
            </label>
          </section>

          <section className="worktree__section">
            <h3>2. Worktree mới</h3>
            <div className="worktree__grid">
              <label className="settings__field">
                <span className="settings__label">Branch mới</span>
                <input
                  className="input"
                  value={branch}
                  disabled={busy}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="feat/ten-tinh-nang"
                />
              </label>
              <label className="settings__field">
                <span className="settings__label">Tách từ</span>
                <select
                  className="select"
                  value={base}
                  disabled={busy}
                  onChange={(e) => setBase(e.target.value)}
                >
                  {branches.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="settings__field">
              <span className="settings__label">Thư mục worktree</span>
              <div className="worktree__path">
                <input
                  className="input"
                  value={path}
                  disabled={busy}
                  onChange={(e) => {
                    setPathTouched(true)
                    setPath(e.target.value)
                  }}
                />
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    void window.tspace.workspace
                      .pickFolder('Chọn thư mục cha cho worktree')
                      .then((picked) => {
                        if (!picked) return
                        setPathTouched(true)
                        setPath(`${picked}\\${branch.trim().replace(/[\\/]+/g, '-')}`)
                      })
                  }}
                >
                  Duyệt…
                </button>
              </div>
              <span className="settings__hint">Thư mục phải chưa tồn tại.</span>
            </label>
          </section>

          <section className="worktree__section">
            <h3>3. Agent làm việc trên worktree đó</h3>
            <div className="worktree__presets">
              {presets.map((item) => (
                <button
                  key={item.id}
                  className={`card card--sm ${item.id === presetId ? 'card--on' : ''}`}
                  disabled={busy}
                  onClick={() => setPresetId(item.id)}
                >
                  <MiniPreview layout={item.layout} />
                  <span className="card__name">{item.name}</span>
                </button>
              ))}
            </div>

            <div className="worktree__agents">
              {leaves.map((paneId, i) => (
                <label key={paneId} className="worktree__agent">
                  <span className="worktree__slot">a{i + 1}</span>
                  <select
                    className="select"
                    value={agentFor(paneId)}
                    disabled={busy}
                    onChange={(e) =>
                      setPaneAgents((current) => ({ ...current, [paneId]: e.target.value }))
                    }
                  >
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <label className="settings__check">
              <input
                type="checkbox"
                checked={withBoard}
                disabled={busy}
                onChange={(e) => setWithBoard(e.target.checked)}
              />
              <span>
                Tạo task board dùng chung
                <span className="settings__hint">
                  Dựng <code>.tspace/</code> với board.json, AGENTS.md và board.ps1 để các agent tự
                  giao việc và chấm chéo nhau.
                </span>
              </span>
            </label>
          </section>
        </div>

        {error && <p className="worktree__error">{error}</p>}

        <footer className="worktree__foot">
          <span className="worktree__status">{step !== 'form' ? STEP_LABEL[step] : ''}</span>
          <button className="btn" disabled={busy} onClick={() => setModal(null)}>
            Huỷ
          </button>
          <button className="btn btn--primary" disabled={!ready || busy} onClick={() => void run()}>
            Commit & tạo worktree
          </button>
        </footer>
      </div>
    </div>
  )
}

function stamp(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function toMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '')
}
