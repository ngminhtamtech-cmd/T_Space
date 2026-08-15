import { Group, Panel, Separator, type PanelSize } from 'react-resizable-panels'
import { useStore } from '@renderer/store'
import { TabBar } from '@renderer/components/TabBar'
import { FileTree } from '@renderer/components/Sidebar/FileTree'
import { EditorPane } from '@renderer/components/Editor/EditorPane'
import { PaneStack } from '@renderer/components/Terminal/PaneStack'

export function Workspace(): React.JSX.Element {
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  const sidebarWidth = useStore((s) => s.sidebarWidth)
  const setSidebarWidth = useStore((s) => s.setSidebarWidth)
  const openFile = useStore((s) => s.openFile)

  const onSidebarResize = (size: PanelSize): void => setSidebarWidth(size.asPercentage)

  return (
    <>
      <TabBar />

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
                  <PaneStack />
                </Panel>
              </Group>
            ) : (
              <PaneStack />
            )}
          </Panel>
        </Group>
      </div>
    </>
  )
}
