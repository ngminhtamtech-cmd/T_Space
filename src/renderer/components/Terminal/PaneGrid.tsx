import { Fragment } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useStore, type Pane } from '@renderer/store'
import type { LayoutId } from '@shared/types'
import { TerminalPane } from './TerminalPane'

/** minSize dạng số bị hiểu là pixel; chuỗi không đơn vị mới là phần trăm. */
const MIN_SIZE = '10'

export function PaneGrid(): React.JSX.Element {
  const panes = useStore((s) => s.panes)
  const layout = useStore((s) => s.layout)

  if (panes.length === 0) {
    return (
      <div className="pane-grid pane-grid--empty">
        <div className="empty-hint">
          <p>Chưa có terminal nào.</p>
          <p className="empty-hint__key">
            <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>`</kbd> để mở pane mới
          </p>
        </div>
      </div>
    )
  }

  return <div className="pane-grid">{renderLayout(layout, panes)}</div>
}

function renderLayout(layout: LayoutId, panes: Pane[]): React.JSX.Element {
  switch (layout) {
    case 'single':
    case 'twoCols':
    case 'threeCols':
      return <Row panes={panes} />
    case 'twoRows':
      return <Column panes={panes} />
    case 'grid4':
      return <Rows groups={chunk(panes, 2)} />
    case 'grid6':
      return <Rows groups={chunk(panes, 3)} />
  }
}

/** Một hàng ngang các pane. */
function Row({ panes }: { panes: Pane[] }): React.JSX.Element {
  return (
    <Group orientation="horizontal" className="split">
      {panes.map((pane, i) => (
        <Fragment key={pane.id}>
          {i > 0 && <Separator className="resize-handle resize-handle--h" />}
          <Panel minSize={MIN_SIZE}>
            <TerminalPane pane={pane} />
          </Panel>
        </Fragment>
      ))}
    </Group>
  )
}

/** Một cột dọc các pane. */
function Column({ panes }: { panes: Pane[] }): React.JSX.Element {
  return (
    <Group orientation="vertical" className="split">
      {panes.map((pane, i) => (
        <Fragment key={pane.id}>
          {i > 0 && <Separator className="resize-handle resize-handle--v" />}
          <Panel minSize={MIN_SIZE}>
            <TerminalPane pane={pane} />
          </Panel>
        </Fragment>
      ))}
    </Group>
  )
}

/** Nhiều hàng, mỗi hàng là một Row lồng bên trong. */
function Rows({ groups }: { groups: Pane[][] }): React.JSX.Element {
  return (
    <Group orientation="vertical" className="split">
      {groups.map((group, i) => (
        // Key theo vị trí hàng, không theo danh sách pane id: id đổi khi thêm pane
        // sẽ remount cả hàng, huỷ xterm và giết PTY đang spawn dở.
        <Fragment key={`row-${i}`}>
          {i > 0 && <Separator className="resize-handle resize-handle--v" />}
          <Panel minSize={MIN_SIZE}>
            <Row panes={group} />
          </Panel>
        </Fragment>
      ))}
    </Group>
  )
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
