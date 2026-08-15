import { useCallback } from 'react'
import { newTab, useStore } from '@renderer/store'
import { askConfirm } from '@renderer/components/Prompt/promptStore'
import { usePaneActions } from './usePaneActions'

export function useTabActions() {
  const addTab = useStore((s) => s.addTab)
  const closeTab = useStore((s) => s.closeTab)
  const setLayoutEditor = useStore((s) => s.setLayoutEditor)
  const setToast = useStore((s) => s.setToast)
  const { newPane } = usePaneActions()

  /** Tab mới kèm sẵn một pane ở gốc workspace. */
  const openBlankTab = useCallback(async (): Promise<void> => {
    const state = useStore.getState()
    if (!state.workspace?.root) {
      setToast('Mở một thư mục workspace trước khi tạo tab.')
      return
    }
    const tab = newTab(`tab ${state.tabs.length + 1}`)
    addTab(tab)
    await newPane({ tabId: tab.id })
  }, [addTab, newPane, setToast])

  /** Đóng tab: giết hết PTY của nó trước, nếu không sẽ để lại tiến trình mồ côi. */
  const closeTabWithPanes = useCallback(
    async (tabId: string): Promise<void> => {
      const state = useStore.getState()
      const tab = state.tabs.find((t) => t.id === tabId)
      if (!tab) return

      const live = tab.panes.filter((p) => !p.exited)
      if (state.settings.behavior.confirmClosePane && live.length > 0) {
        if (!(await askConfirm(`Đóng tab "${tab.name}" và ${live.length} pane?`, 'Đóng'))) return
      }

      await Promise.all(
        tab.panes.filter((p) => p.ptyId).map((p) => window.tspace.pty.kill(p.ptyId!))
      )
      // Tab đã đóng thì transcript của nó không còn được khôi phục nữa.
      await Promise.all(tab.panes.map((p) => window.tspace.transcript.clear(p.id)))
      closeTab(tabId)
    },
    [closeTab]
  )

  const openLayoutEditor = useCallback(() => setLayoutEditor('createTab'), [setLayoutEditor])

  const nextTab = useCallback((step: number): void => {
    const { tabs, activeTabId, setActiveTab } = useStore.getState()
    if (tabs.length < 2) return
    const index = tabs.findIndex((t) => t.id === activeTabId)
    const next = tabs[(index + step + tabs.length) % tabs.length]
    if (next) setActiveTab(next.id)
  }, [])

  return { openBlankTab, closeTabWithPanes, openLayoutEditor, nextTab }
}
