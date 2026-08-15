import { useEffect } from 'react'
import { Group, Panel, Separator, type PanelSize } from 'react-resizable-panels'
import { useStore } from './store'
import { Toolbar } from './components/Toolbar'
import { StatusBar } from './components/StatusBar'
import { FileTree } from './components/Sidebar/FileTree'
import { EditorPane } from './components/Editor/EditorPane'
import { PaneGrid } from './components/Terminal/PaneGrid'
import { PromptDialog } from './components/Prompt/PromptDialog'
import { Toast } from './components/Toast'
import { useShortcuts } from './hooks/useShortcuts'
import { usePersistence } from './hooks/usePersistence'
import { useWorkspaceActions } from './hooks/useWorkspaceActions'

const GIT_POLL_MS = 5000

export function App(): React.JSX.Element {
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  const sidebarWidth = useStore((s) => s.sidebarWidth)
  const setSidebarWidth = useStore((s) => s.setSidebarWidth)
  const openFile = useStore((s) => s.openFile)
  const workspace = useStore((s) => s.workspace)

  const { refreshGit } = useWorkspaceActions()
  usePersistence()
  useShortcuts()

  // 6 shell dùng chung một worktree nên trạng thái git đổi từ bất kỳ pane nào —
  // poll thay vì chỉ refresh khi có thao tác trong UI.
  useEffect(() => {
    if (!workspace?.gitRoot) return
    const timer = window.setInterval(() => void refreshGit(), GIT_POLL_MS)
    return () => window.clearInterval(timer)
  }, [workspace?.gitRoot, refreshGit])

  const onSidebarResize = (size: PanelSize): void => setSidebarWidth(size.asPercentage)

  return (
    <div className="app">
      <Toolbar />

      <div className="app__body">
        <Group orientation="horizontal" className="split">
          {sidebarVisible && (
            <>
              <Panel
                defaultSize={String(sidebarWidth)}
                minSize="12"
                maxSize="45"
                onResize={onSidebarResize}
                className="sidebar"
              >
                <FileTree />
              </Panel>
              <Separator className="resize-handle resize-handle--h" />
            </>
          )}

          <Panel minSize="30">
            {openFile ? (
              <Group orientation="vertical" className="split">
                <Panel defaultSize="45" minSize="15">
                  <EditorPane />
                </Panel>
                <Separator className="resize-handle resize-handle--v" />
                <Panel minSize="15">
                  <PaneGrid />
                </Panel>
              </Group>
            ) : (
              <PaneGrid />
            )}
          </Panel>
        </Group>
      </div>

      <StatusBar />
      <PromptDialog />
      <Toast />
    </div>
  )
}
