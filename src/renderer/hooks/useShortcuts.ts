import { useEffect } from 'react'
import { useStore } from '@renderer/store'
import { usePaneActions } from './usePaneActions'

/**
 * Đăng ký ở capture phase trên window: xterm gắn listener lên textarea của nó và
 * nuốt phím, nên listener bubble thông thường sẽ không bao giờ chạy.
 * Không dùng globalShortcut của Electron — nó chiếm phím toàn hệ thống.
 */
export function useShortcuts(): void {
  const { newPane, closeActivePane } = usePaneActions()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!e.ctrlKey || e.altKey) return

      // Ctrl+Shift+` — terminal mới
      if (e.shiftKey && (e.code === 'Backquote' || e.key === '~')) {
        e.preventDefault()
        void newPane()
        return
      }

      // Ctrl+Shift+W — đóng pane đang focus
      if (e.shiftKey && e.code === 'KeyW') {
        e.preventDefault()
        closeActivePane()
        return
      }

      // Ctrl+B — ẩn/hiện sidebar
      if (!e.shiftKey && e.code === 'KeyB') {
        e.preventDefault()
        useStore.getState().toggleSidebar()
        return
      }

      // Ctrl+1..6 — focus pane theo thứ tự
      if (!e.shiftKey && /^Digit[1-6]$/.test(e.code)) {
        const index = Number(e.code.slice(-1)) - 1
        const pane = useStore.getState().panes[index]
        if (pane) {
          e.preventDefault()
          useStore.getState().setActivePane(pane.id)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [newPane, closeActivePane])
}
