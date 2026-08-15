import type { PaneNode, SplitDirection } from './types'

/**
 * Engine hình học cho cây layout. Thuần tuý: không React, không DOM, và **không
 * import runtime nào** — nhờ vậy `scripts/smoke-layout.mjs` chạy thẳng được bằng
 * node (type-only import bị strip nên không cần resolve alias). Giữ nguyên tính
 * chất này khi sửa file.
 */

/** Phần trăm tối thiểu của một nhánh khi kéo divider. */
export const MIN_SPLIT_PCT = 8

/** Toạ độ theo phần trăm của container gốc. */
export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface DividerRect extends Rect {
  splitId: string
  /** Chỉ số của nhánh nằm bên phải/bên dưới divider (1..children.length-1). */
  index: number
  direction: SplitDirection
  /** Phần trăm container mà split node này chiếm dọc theo trục chia — dùng để quy đổi px → %. */
  spanPct: number
}

export interface Geometry {
  panes: Map<string, Rect>
  dividers: DividerRect[]
}

const FULL: Rect = { left: 0, top: 0, width: 100, height: 100 }

let idCounter = 0

/** Id split node duy nhất trong toàn phiên và không đụng id đã lưu trong state.json. */
export function newSplitId(): string {
  idCounter += 1
  return `s${Date.now().toString(36)}${idCounter.toString(36)}`
}

export function isLeaf(node: PaneNode): node is Extract<PaneNode, { kind: 'leaf' }> {
  return node.kind === 'leaf'
}

/* ---------- Truy vấn ---------- */

/** Thứ tự trái → phải, trên → dưới. */
export function collectLeaves(node: PaneNode | null): string[] {
  if (!node) return []
  if (isLeaf(node)) return [node.paneId]
  return node.children.flatMap(collectLeaves)
}

export function leafCount(node: PaneNode | null): number {
  return collectLeaves(node).length
}

export function hasLeaf(node: PaneNode | null, paneId: string): boolean {
  return collectLeaves(node).includes(paneId)
}

/* ---------- Hình học ---------- */

export function computeGeometry(root: PaneNode | null): Geometry {
  const geo: Geometry = { panes: new Map(), dividers: [] }
  if (root) walk(root, FULL, geo)
  return geo
}

function walk(node: PaneNode, rect: Rect, geo: Geometry): void {
  if (isLeaf(node)) {
    geo.panes.set(node.paneId, rect)
    return
  }

  const horizontal = node.direction === 'row'
  const spanPct = horizontal ? rect.width : rect.height
  let cursor = 0

  node.children.forEach((child, i) => {
    const size = node.sizes[i] ?? 0

    if (i > 0) {
      geo.dividers.push({
        splitId: node.id,
        index: i,
        direction: node.direction,
        spanPct,
        left: horizontal ? rect.left + (rect.width * cursor) / 100 : rect.left,
        top: horizontal ? rect.top : rect.top + (rect.height * cursor) / 100,
        width: horizontal ? 0 : rect.width,
        height: horizontal ? rect.height : 0
      })
    }

    walk(
      child,
      horizontal
        ? {
            left: rect.left + (rect.width * cursor) / 100,
            top: rect.top,
            width: (rect.width * size) / 100,
            height: rect.height
          }
        : {
            left: rect.left,
            top: rect.top + (rect.height * cursor) / 100,
            width: rect.width,
            height: (rect.height * size) / 100
          },
      geo
    )

    cursor += size
  })
}

/* ---------- Biến đổi (thuần, luôn trả cây mới) ---------- */

/**
 * Chia leaf `paneId` theo `direction`. Nếu split cha đã cùng chiều thì chèn thêm
 * sibling cho cây phẳng — giống cách IDE chia editor. Ngược lại thay leaf bằng
 * một split node mới.
 */
export function splitLeaf(
  root: PaneNode,
  paneId: string,
  direction: SplitDirection,
  newPaneId: string
): PaneNode {
  if (isLeaf(root)) {
    if (root.paneId !== paneId) return root
    return {
      kind: 'split',
      id: newSplitId(),
      direction,
      children: [root, { kind: 'leaf', paneId: newPaneId }],
      sizes: [50, 50]
    }
  }

  const index = root.children.findIndex((c) => isLeaf(c) && c.paneId === paneId)

  if (index !== -1 && root.direction === direction) {
    const half = (root.sizes[index] ?? 0) / 2
    const children = [...root.children]
    const sizes = [...root.sizes]
    children.splice(index + 1, 0, { kind: 'leaf', paneId: newPaneId })
    sizes.splice(index, 1, half, half)
    return { ...root, children, sizes: normalize(sizes) }
  }

  return {
    ...root,
    children: root.children.map((child) => splitLeaf(child, paneId, direction, newPaneId))
  }
}

/** Xoá leaf; split còn đúng 1 nhánh sẽ tự gộp lên. Trả null nếu cây rỗng. */
export function removeLeaf(root: PaneNode, paneId: string): PaneNode | null {
  if (isLeaf(root)) return root.paneId === paneId ? null : root

  const kept: PaneNode[] = []
  const keptSizes: number[] = []

  root.children.forEach((child, i) => {
    const next = removeLeaf(child, paneId)
    if (next) {
      kept.push(next)
      keptSizes.push(root.sizes[i] ?? 0)
    }
  })

  if (kept.length === 0) return null
  // Split một con là vô nghĩa: hoist nhánh còn lại lên thay chỗ.
  if (kept.length === 1) return kept[0]!
  return { ...root, children: kept, sizes: normalize(keptSizes) }
}

/** Dịch ranh giới giữa children[index-1] và children[index] đi `deltaPct` (theo % của split cha). */
export function resizeSplit(
  root: PaneNode,
  splitId: string,
  index: number,
  deltaPct: number
): PaneNode {
  if (isLeaf(root)) return root

  if (root.id === splitId) {
    const before = root.sizes[index - 1]
    const after = root.sizes[index]
    if (before === undefined || after === undefined) return root

    const total = before + after
    const max = total - MIN_SPLIT_PCT
    if (max < MIN_SPLIT_PCT) return root

    const nextBefore = clamp(before + deltaPct, MIN_SPLIT_PCT, max)
    const sizes = [...root.sizes]
    sizes[index - 1] = nextBefore
    sizes[index] = total - nextBefore
    return { ...root, sizes }
  }

  return {
    ...root,
    children: root.children.map((child) => resizeSplit(child, splitId, index, deltaPct))
  }
}

/**
 * Nhân bản cây với paneId mới và split id mới — dùng khi dựng tab từ preset,
 * tránh trùng id giữa các tab.
 */
export function cloneLayout(root: PaneNode, mapPaneId: (oldId: string) => string): PaneNode {
  if (isLeaf(root)) return { kind: 'leaf', paneId: mapPaneId(root.paneId) }
  return {
    kind: 'split',
    id: newSplitId(),
    direction: root.direction,
    children: root.children.map((child) => cloneLayout(child, mapPaneId)),
    sizes: [...root.sizes]
  }
}

/** Dựng cây một hàng ngang từ danh sách pane — dùng cho migrate state cũ. */
export function rowLayout(paneIds: string[]): PaneNode | null {
  if (paneIds.length === 0) return null
  if (paneIds.length === 1) return { kind: 'leaf', paneId: paneIds[0]! }
  const size = 100 / paneIds.length
  return {
    kind: 'split',
    id: newSplitId(),
    direction: 'row',
    children: paneIds.map((paneId) => ({ kind: 'leaf', paneId })),
    sizes: paneIds.map(() => size)
  }
}

/**
 * Sửa cây cho khớp với tập pane thực tế: bỏ leaf mồ côi, thêm leaf còn thiếu.
 * Dùng sau khi hydrate state.json để một file hỏng không làm mất pane.
 */
export function reconcile(root: PaneNode | null, paneIds: string[]): PaneNode | null {
  const valid = new Set(paneIds)
  let next = root

  for (const orphan of collectLeaves(next).filter((id) => !valid.has(id))) {
    if (next) next = removeLeaf(next, orphan)
  }

  const present = new Set(collectLeaves(next))
  for (const missing of paneIds.filter((id) => !present.has(id))) {
    next = next
      ? splitLeaf(next, collectLeaves(next).at(-1)!, 'row', missing)
      : { kind: 'leaf', paneId: missing }
  }

  return next
}

/* ---------- Nội bộ ---------- */

function normalize(sizes: number[]): number[] {
  const total = sizes.reduce((sum, n) => sum + n, 0)
  if (total <= 0) return sizes.map(() => 100 / sizes.length)
  return sizes.map((n) => (n * 100) / total)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
