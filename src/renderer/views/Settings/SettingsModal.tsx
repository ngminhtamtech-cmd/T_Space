import { useState } from 'react'
import { DEFAULT_SETTINGS, type CursorStyle, type Density, type ShellId } from '@shared/types'
import { useStore } from '@renderer/store'
import { askConfirm } from '@renderer/components/Prompt/promptStore'
import { AgentTable } from './AgentTable'

type Section = 'terminal' | 'agent' | 'ui' | 'behavior'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'agent', label: 'Agent' },
  { id: 'ui', label: 'Giao diện' },
  { id: 'behavior', label: 'Hành vi' }
]

const ACCENTS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
const CURSORS: CursorStyle[] = ['bar', 'block', 'underline']

export function SettingsModal(): React.JSX.Element {
  const [section, setSection] = useState<Section>('terminal')
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const setModal = useStore((s) => s.setModal)
  const setToast = useStore((s) => s.setToast)
  const shells = useStore((s) => s.shells)
  const agents = useStore((s) => s.agents)

  const close = (): void => setModal(null)

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="settings-modal"
        role="dialog"
        aria-label="Cấu hình"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <nav className="settings__nav">
          <h2 className="settings__title">Cấu hình</h2>
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              className={`settings__nav-item ${section === item.id ? 'settings__nav-item--on' : ''}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings__body">
          {section === 'terminal' && (
            <>
              <Field label="Font" hint="Tên font mono cài trên máy, cách nhau bằng dấu phẩy.">
                <input
                  className="input"
                  value={settings.terminal.fontFamily}
                  onChange={(e) => setSettings({ terminal: { fontFamily: e.target.value } })}
                />
              </Field>

              <Field label={`Cỡ chữ — ${settings.terminal.fontSize}px`}>
                <input
                  type="range"
                  min={9}
                  max={24}
                  value={settings.terminal.fontSize}
                  onChange={(e) =>
                    setSettings({ terminal: { fontSize: Number(e.target.value) } })
                  }
                />
              </Field>

              <Field label="Scrollback" hint="Số dòng giữ lại trong bộ nhớ mỗi pane.">
                <input
                  className="input"
                  type="number"
                  min={500}
                  max={100000}
                  step={500}
                  value={settings.terminal.scrollback}
                  onChange={(e) =>
                    setSettings({ terminal: { scrollback: clamp(e.target.value, 500, 100000) } })
                  }
                />
              </Field>

              <Field label="Con trỏ">
                <div className="settings__row">
                  <select
                    className="select"
                    value={settings.terminal.cursorStyle}
                    onChange={(e) =>
                      setSettings({ terminal: { cursorStyle: e.target.value as CursorStyle } })
                    }
                  >
                    {CURSORS.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                  <Check
                    label="Nhấp nháy"
                    checked={settings.terminal.cursorBlink}
                    onChange={(cursorBlink) => setSettings({ terminal: { cursorBlink } })}
                  />
                </div>
              </Field>
            </>
          )}

          {section === 'agent' && <AgentTable />}

          {section === 'ui' && (
            <>
              <Field label="Màu nhấn">
                <div className="settings__swatches">
                  {ACCENTS.map((color) => (
                    <button
                      key={color}
                      className={`swatch ${settings.ui.accent === color ? 'swatch--on' : ''}`}
                      style={{ background: color }}
                      title={color}
                      onClick={() => setSettings({ ui: { accent: color } })}
                    />
                  ))}
                  <input
                    type="color"
                    className="swatch swatch--pick"
                    value={settings.ui.accent}
                    onChange={(e) => setSettings({ ui: { accent: e.target.value } })}
                    title="Chọn màu khác"
                  />
                </div>
              </Field>

              <Field label="Mật độ" hint="Compact thu gọn chiều cao các thanh và khoảng đệm.">
                <select
                  className="select"
                  value={settings.ui.density}
                  onChange={(e) => setSettings({ ui: { density: e.target.value as Density } })}
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </Field>

              <p className="settings__note">
                Bảng màu của terminal nằm ở <code>theme/palette.ts</code> và không đổi theo màu
                nhấn — xterm không đọc được biến CSS.
              </p>
            </>
          )}

          {section === 'behavior' && (
            <>
              <Field label="Shell mặc định">
                <select
                  className="select"
                  value={settings.behavior.defaultShell}
                  onChange={(e) =>
                    setSettings({ behavior: { defaultShell: e.target.value as ShellId } })
                  }
                >
                  {shells.map((shell) => (
                    <option key={shell.id} value={shell.id}>
                      {shell.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Agent mặc định cho pane mới">
                <select
                  className="select"
                  value={settings.behavior.defaultAgentId}
                  onChange={(e) => setSettings({ behavior: { defaultAgentId: e.target.value } })}
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Check
                label="Tự chạy lệnh agent khi mở pane"
                hint="Tắt (mặc định): lệnh chỉ được điền sẵn ra prompt, bạn tự bấm Enter."
                checked={settings.behavior.autoRunAgentCommand}
                onChange={(autoRunAgentCommand) =>
                  setSettings({ behavior: { autoRunAgentCommand } })
                }
              />

              <Check
                label="Hỏi trước khi đóng pane đang chạy"
                checked={settings.behavior.confirmClosePane}
                onChange={(confirmClosePane) => setSettings({ behavior: { confirmClosePane } })}
              />

              <Check
                label="Lưu lịch sử terminal theo workspace"
                hint="Mở lại workspace sẽ phát lại nội dung phiên trước của từng pane."
                checked={settings.behavior.saveTranscripts}
                onChange={(saveTranscripts) => setSettings({ behavior: { saveTranscripts } })}
              />

              <Field
                label={`Trần lịch sử mỗi pane — ${Math.round(
                  settings.behavior.transcriptMaxBytes / 1024
                )} KB`}
                hint="Vượt trần thì phần cũ nhất bị cắt, giữ lại phần mới."
              >
                <input
                  type="range"
                  min={128}
                  max={8192}
                  step={128}
                  value={Math.round(settings.behavior.transcriptMaxBytes / 1024)}
                  onChange={(e) =>
                    setSettings({ behavior: { transcriptMaxBytes: Number(e.target.value) * 1024 } })
                  }
                />
              </Field>

              <button
                className="btn btn--danger"
                onClick={() => {
                  void (async () => {
                    if (!(await askConfirm('Xoá toàn bộ lịch sử terminal của workspace này?')))
                      return
                    await window.tspace.transcript.clearWorkspace()
                    setToast('Đã xoá lịch sử terminal của workspace.')
                  })()
                }}
              >
                Xoá lịch sử workspace này
              </button>
            </>
          )}
        </div>

        <div className="settings__foot">
          <button
            className="btn"
            onClick={() => {
              void (async () => {
                if (!(await askConfirm('Đưa mọi cấu hình về mặc định?', 'Đặt lại'))) return
                setSettings(DEFAULT_SETTINGS)
              })()
            }}
          >
            Đặt lại mặc định
          </button>
          <button className="btn btn--primary" onClick={close}>
            Xong
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="settings__field">
      <span className="settings__label">{label}</span>
      {children}
      {hint && <span className="settings__hint">{hint}</span>}
    </label>
  )
}

function Check({
  label,
  hint,
  checked,
  onChange
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}): React.JSX.Element {
  return (
    <label className="settings__check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="settings__hint">{hint}</span>}
      </span>
    </label>
  )
}

function clamp(raw: string, min: number, max: number): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}
