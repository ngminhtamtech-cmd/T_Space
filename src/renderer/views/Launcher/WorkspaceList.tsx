import { useState } from 'react'
import type { SavedWorkspace } from '@shared/types'
import { useStore } from '@renderer/store'
import { useWorkspaceActions } from '@renderer/hooks/useWorkspaceActions'
import { FolderIcon, LayersIcon, PlusIcon, TrashIcon } from '@renderer/components/icons'

type Mode = 'folder' | 'workspace'

interface Props {
  selectedPath: string | null
  onSelect: (path: string) => void
  /** Áp preset + agent đã lưu khi người dùng chọn một Workspace. */
  onApplySaved: (saved: SavedWorkspace) => void
  onSaveCurrent: () => void
}

export function WorkspaceList({
  selectedPath,
  onSelect,
  onApplySaved,
  onSaveCurrent
}: Props): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('folder')
  const recents = useStore((s) => s.recentWorkspaces)
  const saved = useStore((s) => s.savedWorkspaces)
  const setSavedWorkspaces = useStore((s) => s.setSavedWorkspaces)
  const removeRecentWorkspace = useStore((s) => s.removeRecentWorkspace)
  const { pickWorkspace } = useWorkspaceActions()

  const pick = async (): Promise<void> => {
    const picked = await pickWorkspace()
    if (picked) onSelect(picked)
  }

  return (
    <div className="wslist">
      <div className="wslist__head">
        <h1 className="wslist__title">Workspaces</h1>
        <div className="segmented" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'folder'}
            className={`segmented__item ${mode === 'folder' ? 'segmented__item--on' : ''}`}
            onClick={() => setMode('folder')}
          >
            Folder
          </button>
          <button
            role="tab"
            aria-selected={mode === 'workspace'}
            className={`segmented__item ${mode === 'workspace' ? 'segmented__item--on' : ''}`}
            onClick={() => setMode('workspace')}
          >
            Workspace
          </button>
        </div>
      </div>

      <div className="wslist__body">
        {mode === 'folder' &&
          (recents.length === 0 ? (
            <p className="wslist__empty">
              Chưa có thư mục nào gần đây.
              <br />
              Bấm “Duyệt thư mục” bên dưới.
            </p>
          ) : (
            recents.map((item) => (
              <div
                key={item.path}
                className={`ws-item ${selectedPath === item.path ? 'ws-item--on' : ''}`}
                onClick={() => onSelect(item.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(item.path)}
              >
                <FolderIcon />
                <span className="ws-item__text">
                  <span className="ws-item__name">{item.name}</span>
                  <span className="ws-item__path" title={item.path}>
                    {item.path}
                  </span>
                </span>
                <button
                  className="ws-item__drop"
                  title="Bỏ khỏi danh sách gần đây"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeRecentWorkspace(item.path)
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          ))}

        {mode === 'workspace' &&
          (saved.length === 0 ? (
            <p className="wslist__empty">
              Chưa lưu workspace nào.
              <br />
              Chọn thư mục + layout + agent rồi bấm “Lưu thành Workspace”.
            </p>
          ) : (
            saved.map((item) => (
              <div
                key={item.id}
                className={`ws-item ${selectedPath === item.path ? 'ws-item--on' : ''}`}
                onClick={() => onApplySaved(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onApplySaved(item)}
              >
                <LayersIcon />
                <span className="ws-item__text">
                  <span className="ws-item__name">{item.name}</span>
                  <span className="ws-item__path" title={item.path}>
                    {item.path}
                  </span>
                </span>
                <button
                  className="ws-item__drop"
                  title="Xoá workspace đã lưu"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSavedWorkspaces(saved.filter((w) => w.id !== item.id))
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          ))}
      </div>

      <div className="wslist__foot">
        {mode === 'folder' ? (
          <button className="btn" onClick={() => void pick()}>
            <PlusIcon /> Duyệt thư mục…
          </button>
        ) : (
          <button className="btn" onClick={onSaveCurrent} disabled={!selectedPath}>
            <PlusIcon /> Lưu thành Workspace
          </button>
        )}
      </div>
    </div>
  )
}
