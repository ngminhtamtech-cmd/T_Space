import { useCallback, useEffect, useState } from 'react'
import type { DirEntry } from '@shared/types'
import { useStore } from '@renderer/store'
import { basename, dirname } from '@renderer/utils/path'
import { FileTreeNode } from './FileTreeNode'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { useFileActions } from './useFileActions'

export function FileTree(): React.JSX.Element {
  const workspace = useStore((s) => s.workspace)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [children, setChildren] = useState<Map<string, DirEntry[]>>(new Map())
  const [menu, setMenu] = useState<{ x: number; y: number; entry: DirEntry } | null>(null)

  const actions = useFileActions()

  const loadDir = useCallback(async (dir: string): Promise<void> => {
    try {
      const entries = await window.tspace.fs.readDir(dir)
      setChildren((prev) => new Map(prev).set(dir, entries))
    } catch {
      setChildren((prev) => new Map(prev).set(dir, []))
    }
  }, [])

  useEffect(() => {
    setExpanded(new Set())
    setChildren(new Map())
    if (workspace) void loadDir(workspace.root)
  }, [workspace, loadDir])

  // Watcher chỉ báo thư mục nào đổi — reload đúng nhánh đang mở, không reload cả cây.
  useEffect(() => {
    return window.tspace.fs.onChanged(({ dir }) => {
      setChildren((prev) => {
        if (!prev.has(dir)) return prev
        void loadDir(dir)
        return prev
      })
    })
  }, [loadDir])

  const toggle = (entry: DirEntry): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(entry.path)) {
        next.delete(entry.path)
      } else {
        next.add(entry.path)
        if (!children.has(entry.path)) void loadDir(entry.path)
      }
      return next
    })
  }

  if (!workspace) {
    return (
      <div className="sidebar__empty">
        <p>Chưa mở workspace.</p>
        <button className="btn" onClick={actions.pickWorkspace}>
          Mở thư mục…
        </button>
      </div>
    )
  }

  const rootEntry: DirEntry = {
    name: basename(workspace.root),
    path: workspace.root,
    isDirectory: true
  }

  return (
    <div
      className="file-tree"
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY, entry: rootEntry })
      }}
    >
      <div className="file-tree__root" title={workspace.root}>
        {rootEntry.name}
      </div>
      <div className="file-tree__list">
        {(children.get(workspace.root) ?? []).map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            expanded={expanded}
            childrenMap={children}
            onToggle={toggle}
            onOpenFile={actions.openFile}
            onContextMenu={(e, target) => {
              e.preventDefault()
              e.stopPropagation()
              setMenu({ x: e.clientX, y: e.clientY, entry: target })
            }}
          />
        ))}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildMenu(menu.entry, actions)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

function buildMenu(entry: DirEntry, actions: ReturnType<typeof useFileActions>): MenuItem[] {
  const parentDir = entry.isDirectory ? entry.path : dirname(entry.path)

  return [
    { label: 'File mới…', onSelect: () => actions.createFile(parentDir) },
    { label: 'Thư mục mới…', onSelect: () => actions.createDir(parentDir) },
    { separator: true },
    { label: 'Mở terminal tại đây', onSelect: () => actions.openTerminalAt(parentDir) },
    { label: 'Copy đường dẫn', onSelect: () => actions.copyPath(entry.path) },
    { label: 'Hiện trong Explorer', onSelect: () => actions.reveal(entry.path) },
    { separator: true },
    { label: 'Đổi tên…', onSelect: () => actions.rename(entry) },
    { label: 'Xoá (vào Recycle Bin)', danger: true, onSelect: () => actions.trash(entry) }
  ]
}
