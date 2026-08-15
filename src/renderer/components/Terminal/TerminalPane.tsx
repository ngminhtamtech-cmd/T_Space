import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useStore, type Pane } from '@renderer/store'
import { usePaneActions } from '@renderer/hooks/usePaneActions'
import { PaneHeader } from './PaneHeader'
import { terminalTheme } from './theme'

const RESIZE_DEBOUNCE_MS = 50

interface Props {
  pane: Pane
  tabId: string
}

export function TerminalPane({ pane, tabId }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  /** Output đến trước khi xterm mount xong sẽ mất nếu không đệm lại. */
  const pendingRef = useRef<string[]>([])
  const ptyIdRef = useRef<string | null>(pane.ptyId)

  const isActive = useStore(
    (s) => s.tabs.find((t) => t.id === tabId)?.activePaneId === pane.id
  )
  // Tab nền vẫn mount (để không mất output) nên phải kiểm tra cả tab có đang hiện.
  const isVisible = useStore((s) => s.activeTabId === tabId)
  const setActivePane = useStore((s) => s.setActivePane)
  const updatePane = useStore((s) => s.updatePane)
  const { closePane } = usePaneActions()

  ptyIdRef.current = pane.ptyId

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      fontFamily: 'Cascadia Mono, Consolas, Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 10000,
      allowProposedApi: true,
      theme: terminalTheme
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(host)

    // WebGL không có sẵn trên mọi driver — rơi về renderer mặc định thay vì crash.
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch {
      /* dùng renderer mặc định */
    }

    termRef.current = term
    for (const chunk of pendingRef.current) term.write(chunk)
    pendingRef.current = []

    term.onData((data) => {
      if (ptyIdRef.current) window.tspace.pty.write(ptyIdRef.current, data)
    })

    let timer: number | undefined
    const syncSize = (): void => {
      if (host.clientWidth === 0 || host.clientHeight === 0) return
      try {
        fit.fit()
      } catch {
        return
      }
      if (ptyIdRef.current) window.tspace.pty.resize(ptyIdRef.current, term.cols, term.rows)
    }

    // PTY được spawn với 80×24 mặc định; đồng bộ ngay kích thước thật của pane.
    syncSize()

    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(syncSize, RESIZE_DEBOUNCE_MS)
    })
    observer.observe(host)

    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      termRef.current = null
      // Bắt buộc: không dispose sẽ rò WebGL context sau vài lần đóng pane.
      term.dispose()
    }
  }, [])

  useEffect(() => {
    const offData = window.tspace.pty.onData(({ paneId, data }) => {
      if (paneId !== ptyIdRef.current) return
      const term = termRef.current
      if (term) term.write(data)
      else pendingRef.current.push(data)
    })

    const offExit = window.tspace.pty.onExit(({ paneId, exitCode }) => {
      if (paneId !== ptyIdRef.current) return
      termRef.current?.write(`\r\n\x1b[90m[tiến trình kết thúc — mã ${exitCode}]\x1b[0m\r\n`)
      updatePane(pane.id, { exited: true, ptyId: null })
    })

    return () => {
      offData()
      offExit()
    }
  }, [pane.id, updatePane])

  useEffect(() => {
    if (isActive && isVisible) termRef.current?.focus()
  }, [isActive, isVisible])

  return (
    <div
      className={`pane ${isActive ? 'pane--active' : ''}`}
      onMouseDown={() => setActivePane(pane.id)}
    >
      <PaneHeader pane={pane} tabId={tabId} onClose={() => closePane(tabId, pane.id)} />
      <div className="pane__body" ref={hostRef} />
    </div>
  )
}
