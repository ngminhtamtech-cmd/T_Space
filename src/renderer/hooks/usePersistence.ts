import { useEffect, useRef } from 'react'
import { useStore } from '@renderer/store'
import { usePaneActions } from './usePaneActions'
import { useWorkspaceActions } from './useWorkspaceActions'

const SAVE_DEBOUNCE_MS = 500

/** Khôi phục state lúc khởi động, sau đó tự lưu mỗi khi có thay đổi. */
export function usePersistence(): void {
  const hydrated = useStore((s) => s.hydrated)
  const { newPane } = usePaneActions()
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

      if (!state.workspaceRoot) return
      await openWorkspace(state.workspaceRoot)

      // Chỉ khôi phục pane nếu workspace mở thành công — tránh spawn vào thư mục đã bị xoá.
      if (!useStore.getState().workspace) return
      // Tuần tự: newPane đọc số pane hiện tại để chặn vượt giới hạn, chạy song song sẽ đọc sai.
      for (const pane of state.panes) await newPane(pane.cwd, pane.shell)
    }

    void restore()
  }, [newPane, openWorkspace])

  useEffect(() => {
    if (!hydrated) return
    let timer: number | undefined

    const unsubscribe = useStore.subscribe(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void window.tspace.state.save(useStore.getState().toPersisted())
      }, SAVE_DEBOUNCE_MS)
    })

    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [hydrated])
}
