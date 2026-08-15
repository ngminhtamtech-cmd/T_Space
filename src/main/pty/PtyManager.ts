import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import * as pty from '@lydell/node-pty'
import type { IPty } from '@lydell/node-pty'
import type { WebContents } from 'electron'
import { IPC } from '@shared/ipc'
import { MAX_PTY, type SpawnOptions } from '@shared/types'
import { resolveShell } from './shells'

/** Gom output rồi flush theo nhịp này. Gửi từng chunk sẽ nghẽn IPC khi lệnh in nhiều. */
const FLUSH_INTERVAL_MS = 8

/** Chờ tối đa ngần này cho ConPTY đóng hẳn trước khi ép thoát app. */
const DISPOSE_TIMEOUT_MS = 2000

/**
 * Chờ ngần này sau chunk output đầu tiên rồi mới gõ lệnh khởi động của agent.
 * Gõ ngay lúc spawn thì PowerShell chưa đọc stdin và sẽ nuốt mất lệnh.
 */
const INITIAL_COMMAND_DELAY_MS = 250

interface Session {
  id: string
  /** Id pane phía renderer; cũng là giá trị của $env:TSPACE_PANE trong tiến trình con. */
  paneId: string
  proc: IPty
  buffer: string
  flushTimer: NodeJS.Timeout | null
  /** Lệnh agent chờ gõ; null khi đã gõ xong hoặc pane là shell trần. */
  pendingCommand: string | null
  /** Có gõ Enter thay người dùng không. */
  submitCommand: boolean
  commandTimer: NodeJS.Timeout | null
  /** Gọi khi tiến trình thực sự thoát; dùng để chờ dọn sạch lúc quit. */
  onClosed: (() => void) | null
}

export class PtyManager {
  private sessions = new Map<string, Session>()
  private target: WebContents | null = null

  attach(webContents: WebContents): void {
    this.target = webContents
  }

  get count(): number {
    return this.sessions.size
  }

  spawn(options: SpawnOptions): string {
    if (this.sessions.size >= MAX_PTY) {
      throw new Error(`Đã đạt giới hạn ${MAX_PTY} terminal. Đóng bớt một pane trước.`)
    }

    const profile = resolveShell(options.shell)
    const cwd = existsSync(options.cwd) ? options.cwd : homedir()
    const id = randomUUID()

    const proc = pty.spawn(profile.path, profile.args, {
      name: 'xterm-256color',
      cols: Math.max(options.cols, 2),
      rows: Math.max(options.rows, 1),
      cwd,
      env: {
        ...process.env,
        ...options.env,
        TSPACE_PANE: options.paneId
      } as Record<string, string>,
      useConpty: true
    })

    const session: Session = {
      id,
      paneId: options.paneId,
      proc,
      buffer: '',
      flushTimer: null,
      pendingCommand: options.initialCommand?.trim() || null,
      submitCommand: options.submitInitialCommand === true,
      commandTimer: null,
      onClosed: null
    }
    this.sessions.set(id, session)

    proc.onData((chunk) => this.enqueue(session, chunk))
    proc.onExit(({ exitCode }) => {
      this.flush(session)
      this.clearCommandTimer(session)
      this.sessions.delete(id)
      if (this.target && !this.target.isDestroyed()) {
        this.target.send(IPC.pty.exit, { paneId: id, exitCode })
      }
      session.onClosed?.()
    })

    return id
  }

  write(paneId: string, data: string): void {
    this.sessions.get(paneId)?.proc.write(data)
  }

  resize(paneId: string, cols: number, rows: number): void {
    const session = this.sessions.get(paneId)
    if (!session) return
    try {
      session.proc.resize(Math.max(cols, 2), Math.max(rows, 1))
    } catch {
      // PTY vừa thoát giữa lúc renderer gửi resize — bỏ qua.
    }
  }

  kill(paneId: string): void {
    const session = this.sessions.get(paneId)
    if (!session) return
    this.clearTimer(session)
    this.clearCommandTimer(session)
    this.sessions.delete(paneId)
    try {
      session.proc.kill()
    } catch {
      // Tiến trình đã chết.
    }
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id)
  }

  /**
   * ConPTY đóng bất đồng bộ: nếu thoát app ngay sau kill(), tiến trình Electron sẽ treo
   * vì thread của ConPTY chưa kết thúc. Chờ tất cả PTY báo exit rồi mới cho quit.
   */
  disposeAll(): Promise<void> {
    const sessions = [...this.sessions.values()]
    if (sessions.length === 0) return Promise.resolve()

    return new Promise((resolve) => {
      let remaining = sessions.length
      const timer = setTimeout(resolve, DISPOSE_TIMEOUT_MS)
      const done = (): void => {
        remaining -= 1
        if (remaining <= 0) {
          clearTimeout(timer)
          resolve()
        }
      }
      for (const session of sessions) {
        session.onClosed = done
        this.kill(session.id)
      }
    })
  }

  private enqueue(session: Session, chunk: string): void {
    session.buffer += chunk

    // Output đầu tiên nghĩa là shell đã in prompt — giờ mới an toàn để gõ lệnh agent.
    if (session.pendingCommand && !session.commandTimer) {
      session.commandTimer = setTimeout(() => {
        session.commandTimer = null
        const command = session.pendingCommand
        session.pendingCommand = null
        if (!command || !this.sessions.has(session.id)) return
        // Không tự Enter: chỉ điền lệnh ra prompt để người dùng tự chạy. Agent CLI
        // hay hỏi lại ngay lúc mở nên chạy thay người dùng là cướp quyền quyết định.
        session.proc.write(session.submitCommand ? `${command}\r` : command)
      }, INITIAL_COMMAND_DELAY_MS)
    }

    if (session.flushTimer) return
    session.flushTimer = setTimeout(() => this.flush(session), FLUSH_INTERVAL_MS)
  }

  private flush(session: Session): void {
    this.clearTimer(session)
    if (!session.buffer) return
    const data = session.buffer
    session.buffer = ''
    if (this.target && !this.target.isDestroyed()) {
      this.target.send(IPC.pty.data, { paneId: session.id, data })
    }
  }

  private clearTimer(session: Session): void {
    if (session.flushTimer) {
      clearTimeout(session.flushTimer)
      session.flushTimer = null
    }
  }

  private clearCommandTimer(session: Session): void {
    if (session.commandTimer) {
      clearTimeout(session.commandTimer)
      session.commandTimer = null
    }
    session.pendingCommand = null
  }
}

export const ptyManager = new PtyManager()
