import { useEffect } from 'react'
import { useStore } from './store'
import { TitleBar } from './components/TitleBar'
import { StatusBar } from './components/StatusBar'
import { PromptDialog } from './components/Prompt/PromptDialog'
import { Toast } from './components/Toast'
import { Launcher } from './views/Launcher/Launcher'
import { LayoutEditor } from './views/LayoutEditor/LayoutEditor'
import { Workspace } from './views/Workspace'
import { useShortcuts } from './hooks/useShortcuts'
import { usePersistence } from './hooks/usePersistence'
import { useWorkspaceActions } from './hooks/useWorkspaceActions'

const GIT_POLL_MS = 5000

export function App(): React.JSX.Element {
  const view = useStore((s) => s.view)
  const layoutEditor = useStore((s) => s.layoutEditor)
  const workspace = useStore((s) => s.workspace)

  const { refreshGit } = useWorkspaceActions()
  usePersistence()
  useShortcuts()

  // Các pane dùng chung một worktree nên trạng thái git đổi từ bất kỳ pane nào —
  // poll thay vì chỉ refresh khi có thao tác trong UI.
  useEffect(() => {
    if (view !== 'workspace' || !workspace?.gitRoot) return
    const timer = window.setInterval(() => void refreshGit(), GIT_POLL_MS)
    return () => window.clearInterval(timer)
  }, [view, workspace?.gitRoot, refreshGit])

  return (
    <div className="app">
      <TitleBar title={view === 'workspace' ? workspace?.root : undefined} />

      {view === 'workspace' ? <Workspace /> : <Launcher />}

      {view === 'workspace' && <StatusBar />}

      {layoutEditor && <LayoutEditor />}
      <PromptDialog />
      <Toast />
    </div>
  )
}
