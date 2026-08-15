import { useState } from 'react'
import { BUILTIN_AGENTS } from '@shared/presets'
import type { AgentProfile, ShellId } from '@shared/types'
import { useStore } from '@renderer/store'
import { newId } from '@renderer/utils/id'
import { askConfirm } from '@renderer/components/Prompt/promptStore'
import { PlusIcon, TrashIcon } from '@renderer/components/icons'

/**
 * CRUD đầy đủ trên AgentProfile. Agent dựng sẵn **sửa được** (bản sửa ghi đè theo id
 * lúc hydrate) nhưng không xoá được — thay vào đó có nút trả về mặc định.
 */
export function AgentTable(): React.JSX.Element {
  const agents = useStore((s) => s.agents)
  const setAgents = useStore((s) => s.setAgents)
  const shells = useStore((s) => s.shells)
  const [openId, setOpenId] = useState<string | null>(null)

  const patch = (id: string, change: Partial<AgentProfile>): void =>
    setAgents(agents.map((a) => (a.id === id ? { ...a, ...change } : a)))

  const add = (): void => {
    const agent: AgentProfile = {
      id: newId('agent-'),
      label: 'Agent mới',
      shell: 'powershell',
      command: '',
      builtin: false
    }
    setAgents([...agents, agent])
    setOpenId(agent.id)
  }

  return (
    <div className="agents">
      {agents.map((agent) => {
        const original = BUILTIN_AGENTS.find((a) => a.id === agent.id)
        const modified = original && JSON.stringify(original) !== JSON.stringify(agent)
        const open = openId === agent.id

        return (
          <div key={agent.id} className={`agent-row ${open ? 'agent-row--open' : ''}`}>
            <button className="agent-row__head" onClick={() => setOpenId(open ? null : agent.id)}>
              <span className="agent-row__label">{agent.label}</span>
              <span className="agent-row__cmd">{agent.command || 'shell trần'}</span>
              {original && <span className="agent-row__tag">dựng sẵn{modified ? ' • đã sửa' : ''}</span>}
            </button>

            {open && (
              <div className="agent-row__body">
                <label className="settings__field">
                  <span className="settings__label">Tên hiển thị</span>
                  <input
                    className="input"
                    value={agent.label}
                    onChange={(e) => patch(agent.id, { label: e.target.value })}
                  />
                </label>

                <label className="settings__field">
                  <span className="settings__label">Shell</span>
                  <select
                    className="select"
                    value={agent.shell}
                    onChange={(e) => patch(agent.id, { shell: e.target.value as ShellId })}
                  >
                    {shells.map((shell) => (
                      <option key={shell.id} value={shell.id}>
                        {shell.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="settings__field">
                  <span className="settings__label">Lệnh khởi động</span>
                  <input
                    className="input"
                    placeholder="để trống = shell trần"
                    value={agent.command}
                    onChange={(e) => patch(agent.id, { command: e.target.value })}
                  />
                  <span className="settings__hint">
                    Gõ vào PTY ngay sau khi pane mở, ví dụ <code>opencode</code>.
                  </span>
                </label>

                <label className="settings__field">
                  <span className="settings__label">Biến môi trường</span>
                  <textarea
                    className="input input--area"
                    rows={3}
                    placeholder={'KEY=value\nMOT_BIEN_KHAC=1'}
                    value={envToText(agent.env)}
                    onChange={(e) => patch(agent.id, { env: textToEnv(e.target.value) })}
                  />
                  <span className="settings__hint">
                    Mỗi dòng một biến. TSPACE_AGENT_SLOT / TSPACE_BOARD do app tự đặt.
                  </span>
                </label>

                <div className="agent-row__actions">
                  {original ? (
                    <button
                      className="btn"
                      disabled={!modified}
                      onClick={() => setAgents(agents.map((a) => (a.id === agent.id ? original : a)))}
                    >
                      Trả về mặc định
                    </button>
                  ) : (
                    <button
                      className="btn btn--danger"
                      onClick={() => {
                        void (async () => {
                          if (!(await askConfirm(`Xoá agent "${agent.label}"?`))) return
                          setAgents(agents.filter((a) => a.id !== agent.id))
                          setOpenId(null)
                        })()
                      }}
                    >
                      <TrashIcon /> Xoá
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <button className="btn" onClick={add}>
        <PlusIcon /> Thêm agent
      </button>
    </div>
  )
}

function envToText(env: Record<string, string> | undefined): string {
  return Object.entries(env ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

function textToEnv(text: string): Record<string, string> | undefined {
  const env: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf('=')
    if (at <= 0) continue
    const key = line.slice(0, at).trim()
    if (key) env[key] = line.slice(at + 1).trim()
  }
  // undefined thay vì {} để agent chưa đặt env nào vẫn khớp bản builtin khi so sánh.
  return Object.keys(env).length > 0 ? env : undefined
}
