import type { AgentProfile, LayoutPreset, PaneNode, SplitDirection } from './types'

/**
 * paneId trong preset chỉ là chỗ giữ chỗ. Lúc tạo tab thật, mỗi leaf được gán
 * một pane id mới (xem `instantiatePreset` ở renderer).
 */
function leaf(paneId: string): PaneNode {
  return { kind: 'leaf', paneId }
}

function split(id: string, direction: SplitDirection, children: PaneNode[]): PaneNode {
  const size = 100 / children.length
  return { kind: 'split', id, direction, children, sizes: children.map(() => size) }
}

export const BUILTIN_PRESETS: LayoutPreset[] = [
  {
    id: 'single',
    name: '1 pane',
    layout: leaf('p1'),
    cwds: {},
    builtin: true
  },
  {
    id: 'twoCols',
    name: '2 cột',
    layout: split('s1', 'row', [leaf('p1'), leaf('p2')]),
    cwds: {},
    builtin: true
  },
  {
    id: 'twoRows',
    name: '2 hàng',
    layout: split('s1', 'column', [leaf('p1'), leaf('p2')]),
    cwds: {},
    builtin: true
  },
  {
    id: 'threeCols',
    name: '3 cột',
    layout: split('s1', 'row', [leaf('p1'), leaf('p2'), leaf('p3')]),
    cwds: {},
    builtin: true
  },
  {
    id: 'oneLeftTwoRight',
    name: '1 trái + 2 phải',
    layout: split('s1', 'row', [leaf('p1'), split('s2', 'column', [leaf('p2'), leaf('p3')])]),
    cwds: {},
    builtin: true
  },
  {
    id: 'grid4',
    name: '2 × 2',
    layout: split('s1', 'column', [
      split('s2', 'row', [leaf('p1'), leaf('p2')]),
      split('s3', 'row', [leaf('p3'), leaf('p4')])
    ]),
    cwds: {},
    builtin: true
  },
  {
    id: 'grid6',
    name: '3 × 2',
    layout: split('s1', 'column', [
      split('s2', 'row', [leaf('p1'), leaf('p2'), leaf('p3')]),
      split('s3', 'row', [leaf('p4'), leaf('p5'), leaf('p6')])
    ]),
    cwds: {},
    builtin: true
  }
]

export const DEFAULT_PRESET_ID = 'single'

export const BUILTIN_AGENTS: AgentProfile[] = [
  { id: 'shell', label: 'Shell', shell: 'powershell', command: '', builtin: true },
  { id: 'claude', label: 'Claude Code', shell: 'powershell', command: 'claude', builtin: true },
  { id: 'codex', label: 'Codex', shell: 'powershell', command: 'codex', builtin: true },
  { id: 'gemini', label: 'Gemini', shell: 'powershell', command: 'gemini', builtin: true }
]

export const DEFAULT_AGENT_ID = 'shell'
