import { useCallback } from 'react'
import { getActiveTab, useStore, type Pane } from '@renderer/store'

/**
 * Đưa text vào PTY của một pane khác — cách để agent này giao việc hoặc chuyển kết
 * quả cho agent kia mà không cần người dùng copy/paste qua lại.
 *
 * Chỉ dùng `pty.write` sẵn có, đúng cơ chế mà PtyManager dùng cho initialCommand.
 */
export interface SendOptions {
  /** Gửi kèm Enter để agent chạy luôn. Tắt đi nếu chỉ muốn mồi sẵn câu lệnh. */
  submit?: boolean
}

export function useAgentBus() {
  const setToast = useStore((s) => s.setToast)

  const sendToPane = useCallback(
    (paneId: string, text: string, options: SendOptions = {}): boolean => {
      const pane = findPane(paneId)
      if (!pane) return false
      if (!pane.ptyId || pane.exited) {
        setToast(`Pane ${pane.slot} đã thoát, không gửi được.`)
        return false
      }
      // xterm hiểu \r là Enter; \n sẽ chỉ xuống dòng trong ô nhập của agent.
      window.tspace.pty.write(pane.ptyId, options.submit === false ? text : `${text}\r`)
      return true
    },
    [setToast]
  )

  /** Gửi cho mọi pane còn sống trong tab hiện tại, trừ pane gửi. */
  const broadcast = useCallback(
    (text: string, exceptPaneId?: string, options: SendOptions = {}): number => {
      const tab = getActiveTab()
      if (!tab) return 0
      let sent = 0
      for (const pane of tab.panes) {
        if (pane.id === exceptPaneId) continue
        if (sendToPane(pane.id, text, options)) sent += 1
      }
      return sent
    },
    [sendToPane]
  )

  return { sendToPane, broadcast }
}

function findPane(paneId: string): Pane | undefined {
  for (const tab of useStore.getState().tabs) {
    const pane = tab.panes.find((p) => p.id === paneId)
    if (pane) return pane
  }
  return undefined
}
