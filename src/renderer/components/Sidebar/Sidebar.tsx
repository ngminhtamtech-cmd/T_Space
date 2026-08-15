import { useState } from 'react'
import { useStore } from '@renderer/store'
import { FileTree } from './FileTree'
import { BoardPanel } from './BoardPanel'

type Tab = 'files' | 'board'

/**
 * Sidebar có hai mặt: cây file và task board dùng chung. Board chỉ có ý nghĩa khi
 * workspace đã được dựng `.tspace/`, nhưng vẫn cho mở để bấm nút tạo board.
 */
export function Sidebar(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('files')
  const taskCount = useStore((s) => s.board?.tasks.length ?? 0)

  return (
    <div className="sidebar__inner">
      <div className="segmented segmented--sidebar" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'files'}
          className={`segmented__item ${tab === 'files' ? 'segmented__item--on' : ''}`}
          onClick={() => setTab('files')}
        >
          Files
        </button>
        <button
          role="tab"
          aria-selected={tab === 'board'}
          className={`segmented__item ${tab === 'board' ? 'segmented__item--on' : ''}`}
          onClick={() => setTab('board')}
        >
          Board{taskCount > 0 ? ` (${taskCount})` : ''}
        </button>
      </div>

      {/* Cây file giữ nguyên trạng thái expand khi qua lại giữa hai tab. */}
      <div className="sidebar__panel" style={{ display: tab === 'files' ? 'flex' : 'none' }}>
        <FileTree />
      </div>
      <div className="sidebar__panel" style={{ display: tab === 'board' ? 'flex' : 'none' }}>
        <BoardPanel />
      </div>
    </div>
  )
}
