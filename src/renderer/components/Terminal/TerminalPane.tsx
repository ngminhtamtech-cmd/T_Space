import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useStore, type Pane } from '@renderer/store'
import { usePaneActions } from '@renderer/hooks/usePaneActions'
import { CollapseIcon } from '@renderer/components/icons'
import { PaneHeader } from './PaneHeader'
import { terminalTheme } from './theme'
import { registerTranscriptSaver, serializeTerminal } from './transcript'

const RESIZE_DEBOUNCE_MS = 50
/** Ghi lịch sử sau khi output im tiếng ngần này — tránh chạm đĩa giữa lúc lệnh đang in. */
const TRANSCRIPT_SAVE_MS = 2500

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
  const ptyIdRef = useRef<string | null>(pane.ptyId)
  /** Nội dung phiên trước của đúng pane này; null = không có gì để xem. */
  const [history, setHistory] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

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
    for (const chunk of pendingRef.current) term.write(chunk)
    pendingRef.current = []

    /*
     * Lịch sử phiên trước KHÔNG được ghi vào xterm.
     *
     * ConPTY sở hữu viewport và vẽ lại toàn bộ nó — lúc shell khởi động và sau mỗi
     * lần resize (`ESC[2J`, rồi `ESC[H` + `ESC[K` từng dòng). Bất cứ thứ gì ta ghi
     * vào đó đều bị xoá ngay sau đấy, nên lịch sử phải nằm ngoài terminal.
     */
    void window.tspace.transcript
      .read(pane.id)
      .then((past) => {
        if (!cancelled && past.trim()) setHistory(past.replace(/\s+$/, ''))
      })
      .catch(() => undefined)

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

  // Lưu lại nội dung đã render, chống rung theo nhịp output.
  useEffect(() => {
    let timer: number | undefined

    const save = async (): Promise<void> => {
      const term = termRef.current
      if (!term || !useStore.getState().settings.behavior.saveTranscripts) return
      await window.tspace.transcript.save(pane.id, serializeTerminal(term))
    }

    const schedule = (): void => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void save(), TRANSCRIPT_SAVE_MS)
    }

    const off = window.tspace.pty.onData(({ paneId }) => {
      if (paneId === ptyIdRef.current) schedule()
    })
    // Cửa sổ đóng thì component không unmount, nên phải có đường ghi riêng lúc thoát.
    const unregister = registerTranscriptSaver(pane.id, save)

    return () => {
      window.clearTimeout(timer)
      off()
      unregister()
      void save()
    }
  }, [pane.id])

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

      {history && (
        <div className={`pane__history ${historyOpen ? 'pane__history--open' : ''}`}>
          <button
            className="pane__history-bar"
            onClick={() => setHistoryOpen((open) => !open)}
            title="Nội dung pane này ở phiên làm việc trước"
          >
            <span className="pane__history-caret">{historyOpen ? '▾' : '▸'}</span>
            Phiên trước · {history.split('\n').length} dòng
            <span
              className="pane__history-drop"
              role="button"
              tabIndex={0}
              title="Xoá lịch sử của pane này"
              onClick={(e) => {
                e.stopPropagation()
                setHistory(null)
                void window.tspace.transcript.clear(pane.id)
              }}
            >
              Xoá
            </span>
          </button>
          {historyOpen && <pre className="pane__history-text">{history}</pre>}
        </div>
      )}

      <div className="pane__body" ref={hostRef} />

      {maximized && (
        <button className="pane__restore" onClick={toggleMaximize} title="Thu nhỏ lại (Esc)">
          <CollapseIcon size={14} />
        </button>
      )}
    </div>
  )
}
