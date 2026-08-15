import { useEffect, useRef } from 'react'
import { useStore, type Tab } from '@renderer/store'
import { newId } from '@renderer/utils/id'
import { usePaneActions } from './usePaneActions'
import { useWorkspaceActions } from './useWorkspaceActions'

const SAVE_DEBOUNCE_MS = 500

/** Khôi phục state lúc khởi động, sau đó tự lưu mỗi khi có thay đổi. */
export function usePersistence(): void {
  const hydrated = useStore((s) => s.hydrated)
  const { restoreTabPanes } = usePaneActions()
  const { openWorkspace } = useWorkspaceActions()
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current) return
    restored.current = true

    const restore = async (): Promise<void> => {
      const [shells, state] = await Promise.all([
        window.tspace.pty.listShells(),
        window.tspace.state.load()
      ])
      useStore.getState().setShells(shells)
      useStore.getState().hydrate(state)

      // Chỉ khôi phục pane nếu workspace mở thành công — tránh spawn vào thư mục đã bị xoá.
      if (!state.workspaceRoot) return
      if (!(await openWorkspace(state.workspaceRoot))) return

      const restoredIds: string[] = []
      for (const persisted of state.tabs) {
        const tab: Tab = {
          id: newId('tab-'),
          name: persisted.name,
          layout: persisted.layout,
          panes: [],
          activePaneId: null
        }
        useStore.getState().addTab(tab)

        // Tab nào không spawn lại được pane nào thì bỏ hẳn, đừng để tab rỗng.
        if ((await restoreTabPanes(tab.id, persisted.panes)) > 0) restoredIds.push(tab.id)
        else useStore.getState().closeTab(tab.id)
      }

      // Không có pane nào sống lại thì ở lại Launcher thay vì mở màn hình trống.
      if (restoredIds.length === 0) return
      const active = restoredIds[state.activeTabIndex] ?? restoredIds[0]!
      useStore.getState().setActiveTab(active)
      useStore.getState().setView('workspace')
    }

    // Bật tự lưu sau khi khôi phục kết thúc. Nếu bật sớm, một lần khôi phục hỏng
    // sẽ ghi đè state rỗng lên phiên đã lưu và mất sạch tab/layout.
    void restore().finally(() => useStore.getState().finishHydration())
  }, [restoreTabPanes, openWorkspace])

  useEffect(() => {
    if (!hydrated) return
    let timer: number | undefined
    let previous = useStore.getState().toPersisted()

    const unsubscribe = useStore.subscribe(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const next = useStore.getState().toPersisted()
        // Kéo divider bắn hàng chục lần/giây và toast cũng làm store đổi — chỉ ghi
        // đĩa khi phần thực sự được lưu có thay đổi.
        const serialized = JSON.stringify(next)
        if (serialized === JSON.stringify(previous)) return
        previous = next
        void window.tspace.state.save(next)
      }, SAVE_DEBOUNCE_MS)
    })

    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [hydrated])
}
