import { Group, Panel, Separator, type PanelSize } from 'react-resizable-panels'
import { SIDEBAR_MAX_PCT, SIDEBAR_MIN_PCT } from '@shared/types'
import { useStore } from '@renderer/store'
import { TabBar } from '@renderer/components/TabBar'
import { Sidebar } from '@renderer/components/Sidebar/Sidebar'
import { EditorPane } from '@renderer/components/Editor/EditorPane'
import { PaneStack } from '@renderer/components/Terminal/PaneStack'

export function Workspace(): React.JSX.Element {
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  const sidebarWidth = useStore((s) => s.sidebarWidth)
  const setSidebarWidth = useStore((s) => s.setSidebarWidth)
  const openFile = useStore((s) => s.openFile)

  // Panel sidebar bị gỡ hẳn khỏi Group khi ẩn, và trên đường ra nó còn bắn thêm một
  // onResize với phần trăm vô nghĩa — nhận nó là mất bề rộng người dùng đã kéo.
  // Cờ sidebarVisible đã là false từ trước lúc unmount nên đọc trực tiếp từ store là
  // chặn được. Store còn chặn thêm một lớp theo biên min/max.
  const onSidebarResize = (size: PanelSize): void => {
    if (!useStore.getState().sidebarVisible) return
    setSidebarWidth(size.asPercentage)
  }

  return (
    <>
      <TabBar />

      <div className="app__body">
        <Group orientation="horizontal" className="split">
          {sidebarVisible && (
            <>
              <Panel
                defaultSize={String(sidebarWidth)}
                minSize={String(SIDEBAR_MIN_PCT)}
                maxSize={String(SIDEBAR_MAX_PCT)}
                onResize={onSidebarResize}
                className="sidebar"
              >
                <Sidebar />
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
