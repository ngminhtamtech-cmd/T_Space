import { useEffect, useState } from 'react'
import {
  WinCloseIcon,
  WinMaximizeIcon,
  WinMinimizeIcon,
  WinRestoreIcon
} from './icons'

interface Props {
  /** Nội dung giữa thanh — thường là đường dẫn workspace đang mở. */
  title?: string
  /** Nút phụ đặt sát nhóm nút cửa sổ. */
  tools?: React.ReactNode
}

export function TitleBar({ title, tools }: Props): React.JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.tspace.window.isMaximized().then(setMaximized)
    return window.tspace.window.onMaximizeChanged(setMaximized)
  }, [])

  return (
    <div className="titlebar">
      <div className="titlebar__brand">
        <span className="titlebar__mark" />
        T_Space
      </div>

      <div className="titlebar__title" title={title}>
        {title}
      </div>

      {tools && <div className="titlebar__tools">{tools}</div>}

      <div className="titlebar__controls">
        <button
          className="win-btn"
          onClick={() => window.tspace.window.minimize()}
          title="Thu nhỏ"
          aria-label="Thu nhỏ"
        >
          <WinMinimizeIcon />
        </button>
        <button
          className="win-btn"
          onClick={() => window.tspace.window.toggleMaximize()}
          title={maximized ? 'Khôi phục' : 'Phóng to'}
          aria-label={maximized ? 'Khôi phục' : 'Phóng to'}
        >
          {maximized ? <WinRestoreIcon /> : <WinMaximizeIcon />}
        </button>
        <button
          className="win-btn win-btn--close"
          onClick={() => window.tspace.window.close()}
          title="Đóng"
          aria-label="Đóng"
        >
          <WinCloseIcon />
        </button>
      </div>
    </div>
  )
}
