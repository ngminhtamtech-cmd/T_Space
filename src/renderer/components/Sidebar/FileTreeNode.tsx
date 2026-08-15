import type { DirEntry } from '@shared/types'
import { useStore } from '@renderer/store'
import { fileIcon } from './fileIcon'

interface Props {
  entry: DirEntry
  depth: number
  expanded: Set<string>
  childrenMap: Map<string, DirEntry[]>
  onToggle: (entry: DirEntry) => void
  onOpenFile: (entry: DirEntry) => void
  onContextMenu: (e: React.MouseEvent, entry: DirEntry) => void
}

export function FileTreeNode({
  entry,
  depth,
  expanded,
  childrenMap,
  onToggle,
  onOpenFile,
  onContextMenu
}: Props): React.JSX.Element {
  const openFilePath = useStore((s) => s.openFile?.path)
  const isOpen = expanded.has(entry.path)
  const isActive = openFilePath === entry.path
  const kids = childrenMap.get(entry.path)

  return (
    <>
      <div
        className={`tree-node ${isActive ? 'tree-node--active' : ''}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => (entry.isDirectory ? onToggle(entry) : onOpenFile(entry))}
        onContextMenu={(e) => onContextMenu(e, entry)}
        title={entry.path}
      >
        <span className="tree-node__chevron">
          {entry.isDirectory ? (isOpen ? '▾' : '▸') : ''}
        </span>
        <span className="tree-node__icon">{fileIcon(entry)}</span>
        <span className="tree-node__name">{entry.name}</span>
      </div>

      {entry.isDirectory &&
        isOpen &&
        (kids === undefined ? (
          <div className="tree-node tree-node--muted" style={{ paddingLeft: 8 + (depth + 1) * 12 }}>
            đang tải…
          </div>
        ) : (
          kids.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              childrenMap={childrenMap}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
            />
          ))
        ))}
    </>
  )
}
