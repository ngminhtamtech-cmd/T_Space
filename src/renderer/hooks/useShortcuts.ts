import { useEffect } from 'react'
import { collectLeaves } from '@shared/layout'
import { getActiveTab, useStore } from '@renderer/store'
import { usePaneActions } from './usePaneActions'
import { useTabActions } from './useTabActions'

/**
 * Đăng ký ở capture phase trên window: xterm gắn listener lên textarea của nó và
 * nuốt phím, nên listener bubble thông thường sẽ không bao giờ chạy.
 * Không dùng globalShortcut của Electron — nó chiếm phím toàn hệ thống.
 */
export function useShortcuts(): void {
  const { newPane, splitActivePane, closeActivePane } = usePaneActions()
  const { openBlankTab, nextTab } = useTabActions()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      // Launcher không có pane/tab nào để thao tác.
      if (useStore.getState().view !== 'workspace') return

      // Escape — thu pane đang phóng to về lưới. Không đòi Ctrl nên xét trước.
      // Nhường Escape cho modal đang mở và cho ô nhập (xterm dùng textarea nên
      // chỉ loại trừ input/select, không loại trừ textarea).
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey) {
        const s = useStore.getState()
        if (s.modal || s.layoutEditor) return
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag === 'INPUT' || tag === 'SELECT') return
        const tab = getActiveTab()
        if (!tab?.maximizedPaneId) return
        e.preventDefault()
        s.toggleMaximizePane(tab.id, tab.maximizedPaneId)
        return
      }

      if (!e.ctrlKey || e.altKey) return

      // Ctrl+Shift+Z — phóng to / thu nhỏ pane đang focus
      if (e.shiftKey && e.code === 'KeyZ') {
        const tab = getActiveTab()
        if (!tab?.activePaneId) return
        e.preventDefault()
        useStore.getState().toggleMaximizePane(tab.id, tab.maximizedPaneId ?? tab.activePaneId)
        return
      }

      // Ctrl+\ — split right; Ctrl+Shift+\ — split down
      if (e.code === 'Backslash') {
        e.preventDefault()
        void splitActivePane(e.shiftKey ? 'column' : 'row')
        return
      }

      // Ctrl+Shift+` — pane mới (chia pane đang focus, hoặc pane đầu tiên của tab rỗng)
      if (e.shiftKey && (e.code === 'Backquote' || e.key === '~')) {
        e.preventDefault()
        const tab = getActiveTab()
        if (tab?.activePaneId) void splitActivePane('row')
        else void newPane()
        return
      }

      // Ctrl+Shift+W — đóng pane đang focus
      if (e.shiftKey && e.code === 'KeyW') {
        e.preventDefault()
        closeActivePane()
        return
      }

      // Ctrl+T — tab mới
      if (!e.shiftKey && e.code === 'KeyT') {
        e.preventDefault()
        void openBlankTab()
        return
      }

      // Ctrl+Tab / Ctrl+Shift+Tab — chuyển tab
      if (e.code === 'Tab') {
        e.preventDefault()
        nextTab(e.shiftKey ? -1 : 1)
        return
      }

      // Ctrl+B — ẩn/hiện sidebar
      if (!e.shiftKey && e.code === 'KeyB') {
        e.preventDefault()
        useStore.getState().toggleSidebar()
        return
      }

      // Ctrl+1..8 — focus pane theo thứ tự hiển thị
      if (!e.shiftKey && /^Digit[1-8]$/.test(e.code)) {
        const tab = getActiveTab()
        const paneId = collectLeaves(tab?.layout ?? null)[Number(e.code.slice(-1)) - 1]
        if (paneId) {
          e.preventDefault()
          useStore.getState().setActivePane(paneId)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [newPane, splitActivePane, closeActivePane, openBlankTab, nextTab])
}
