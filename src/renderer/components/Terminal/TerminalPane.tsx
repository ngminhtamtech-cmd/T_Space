import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useStore, type Pane } from '@renderer/store'
import { usePaneActions } from '@renderer/hooks/usePaneActions'
import { CollapseIcon } from '@renderer/components/icons'
import { PaneHeader } from './PaneHeader'
import { terminalTheme } from './theme'

const RESIZE_DEBOUNCE_MS = 50

interface Props {
  pane: Pane
  tabId: string
  maximized: boolean
}

export function TerminalPane({ pane, tabId, maximized }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  /** Output đến trước khi xterm mount xong sẽ mất nếu không đệm lại. */
  const pendingRef = useRef<string[]>([])
  /** Cho tới khi transcript phiên trước được ghi xong, output mới vẫn phải chờ. */
  const replayedRef = useRef(false)
  const ptyIdRef = useRef<string | null>(pane.ptyId)

  const isActive = useStore(
    (s) => s.tabs.find((t) => t.id === tabId)?.activePaneId === pane.id
  )
  // Tab nền vẫn mount (để không mất output) nên phải kiểm tra cả tab có đang hiện.
  const isVisible = useStore((s) => s.activeTabId === tabId)
  const setActivePane = useStore((s) => s.setActivePane)
  const updatePane = useStore((s) => s.updatePane)
  const toggleMaximizePane = useStore((s) => s.toggleMaximizePane)
  const terminalSettings = useStore((s) => s.settings.terminal)
  const { closePane } = usePaneActions()

  ptyIdRef.current = pane.ptyId

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false

    const settings = useStore.getState().settings.terminal
    const term = new Terminal({
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      lineHeight: 1.2,
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      scrollback: settings.scrollback,
      allowProposedApi: true,
      theme: terminalTheme
    })
    const fit = new FitAddon()
    fitRef.current = fit
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

    // Phát lại phiên trước rồi mới xả output mới, để dòng thời gian không bị đảo.
    void (async () => {
      try {
        const past = await window.tspace.transcript.read(pane.id)
        if (cancelled) return
        if (past) {
          term.write(past)
          term.write('\r\n\x1b[2m─────────── phiên trước ───────────\x1b[0m\r\n')
        }
      } catch {
        /* không đọc được transcript thì vẫn chạy tiếp bình thường */
      }
      if (cancelled) return
      for (const chunk of pendingRef.current) term.write(chunk)
      pendingRef.current = []
      replayedRef.current = true
    })()

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
      cancelled = true
      window.clearTimeout(timer)
      observer.disconnect()
      termRef.current = null
      fitRef.current = null
      // Bắt buộc: không dispose sẽ rò WebGL context sau vài lần đóng pane.
      term.dispose()
    }
  }, [pane.id])

  // Đổi settings áp ngay cho pane đang mở, không cần khởi động lại app.
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontFamily = terminalSettings.fontFamily
    term.options.fontSize = terminalSettings.fontSize
    term.options.scrollback = terminalSettings.scrollback
    term.options.cursorStyle = terminalSettings.cursorStyle
    term.options.cursorBlink = terminalSettings.cursorBlink

    // Ô chữ đổi kích thước nhưng khung pane thì không, nên ResizeObserver không bắn.
    try {
      fitRef.current?.fit()
    } catch {
      return
    }
    if (ptyIdRef.current) window.tspace.pty.resize(ptyIdRef.current, term.cols, term.rows)
  }, [terminalSettings])

  useEffect(() => {
    const offData = window.tspace.pty.onData(({ paneId, data }) => {
      if (paneId !== ptyIdRef.current) return
      const term = termRef.current
      if (term && replayedRef.current) term.write(data)
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

  const toggleMaximize = (): void => toggleMaximizePane(tabId, pane.id)

  return (
    <div
      className={`pane ${isActive ? 'pane--active' : ''} ${maximized ? 'pane--max' : ''}`}
      onMouseDown={() => setActivePane(pane.id)}
    >
      <PaneHeader
        pane={pane}
        tabId={tabId}
        maximized={maximized}
        onClose={() => void closePane(tabId, pane.id)}
        onToggleMaximize={toggleMaximize}
      />
      <div className="pane__body" ref={hostRef} />

      {maximized && (
        <button className="pane__restore" onClick={toggleMaximize} title="Thu nhỏ lại (Esc)">
          <CollapseIcon size={14} />
        </button>
      )}
    </div>
  )
}
