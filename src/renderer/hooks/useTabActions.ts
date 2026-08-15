import { useCallback } from 'react'
import { newTab, useStore } from '@renderer/store'
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
      const tab = useStore.getState().tabs.find((t) => t.id === tabId)
      if (!tab) return
      await Promise.all(
        tab.panes.filter((p) => p.ptyId).map((p) => window.tspace.pty.kill(p.ptyId!))
      )
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
