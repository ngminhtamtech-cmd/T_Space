import { leafCount } from '@shared/layout'
import { useStore } from '@renderer/store'
import { PlusIcon } from '@renderer/components/icons'
import { MiniPreview } from './MiniPreview'

interface Props {
  presetId: string
  agentId: string
  onPickPreset: (id: string) => void
  onPickAgent: (id: string) => void
  onCustomLayout: () => void
  onCustomAgent: () => void
}

export function ConfigPanel({
  presetId,
  agentId,
  onPickPreset,
  onPickAgent,
  onCustomLayout,
  onCustomAgent
}: Props): React.JSX.Element {
  const presets = useStore((s) => s.layoutPresets)
  const agents = useStore((s) => s.agents)

  return (
    <div className="config">
      <section className="config__section">
        <div className="config__head">
          <span className="section-label">Layout</span>
          <span className="config__hint">Cách chia pane khi mở workspace</span>
        </div>
        <div className="config__grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              className={`card ${preset.id === presetId ? 'card--on' : ''}`}
              onClick={() => onPickPreset(preset.id)}
            >
              <MiniPreview layout={preset.layout} />
              <span className="card__title">{preset.name}</span>
              <span className="card__sub">{leafCount(preset.layout)} pane</span>
            </button>
          ))}

          <button className="card" onClick={onCustomLayout}>
            <div className="mini-preview" />
            <span className="card__title">
              <PlusIcon /> Custom…
            </span>
            <span className="card__sub">layout editor</span>
          </button>
        </div>
      </section>

      <section className="config__section">
        <div className="config__head">
          <span className="section-label">Agent</span>
          <span className="config__hint">Lệnh chạy sẵn trong mỗi pane</span>
        </div>
        <div className="config__grid">
          {agents.map((agent) => (
            <button
              key={agent.id}
              className={`card ${agent.id === agentId ? 'card--on' : ''}`}
              onClick={() => onPickAgent(agent.id)}
            >
              <span className="card__title">{agent.label}</span>
              <span className="agent-card__cmd">{agent.command || 'shell trần'}</span>
            </button>
          ))}

          <button className="card" onClick={onCustomAgent}>
            <span className="card__title">
              <PlusIcon /> Custom…
            </span>
            <span className="agent-card__cmd">lệnh của bạn</span>
          </button>
        </div>
      </section>
    </div>
  )
}
