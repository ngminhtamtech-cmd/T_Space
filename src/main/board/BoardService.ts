import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import type { WebContents } from 'electron'
import { IPC } from '@shared/ipc'
import { BOARD_DIR, BOARD_FILE, emptyBoard, type Board } from '@shared/board'
import { findGitCommonDir } from '../git/GitService'
import { BOARD_HELPER_PS1, boardAgentsDoc, ROOT_AGENTS_BLOCK } from './templates'

const WATCH_DEBOUNCE_MS = 150

/**
 * Quản lý `.tspace/board.json` trong worktree đang mở.
 *
 * Board là nơi các agent tự giao việc và chấm chéo nhau, nên nó bị nhiều tiến trình
 * ghi cùng lúc: T_Space từ đây, và mỗi agent qua `.tspace/board.ps1`. Vì vậy mọi lần
 * ghi đều là tmp + rename, và phía renderer luôn phải đọc lại trước khi ghi.
 */
class BoardService {
  private root: string | null = null
  private target: WebContents | null = null
  private watcher: FSWatcher | null = null
  private flushTimer: NodeJS.Timeout | null = null
  /** Nối tiếp thao tác ghi của chính process này. */
  private queue: Promise<unknown> = Promise.resolve()

  attach(webContents: WebContents): void {
    this.target = webContents
  }

  /** Trỏ service sang worktree khác. Không tạo file gì — `ensure` mới tạo. */
  async setRoot(root: string | null): Promise<void> {
    const next = root ? resolve(root) : null
    if (next === this.root) return
    this.root = next
    await this.restartWatcher()
  }

  getRoot(): string | null {
    return this.root
  }

  /**
   * Dựng `.tspace/` cho worktree: board rỗng, tài liệu luật chơi cho agent, script
   * helper, và một khối trỏ sang tài liệu đó trong AGENTS.md ở gốc (claude/opencode
   * đều tự đọc file này). Idempotent — gọi lại nhiều lần không hỏng gì.
   */
  async ensure(root: string): Promise<Board> {
    const target = resolve(root)
    const dir = join(target, BOARD_DIR)
    await mkdir(dir, { recursive: true })

    const boardPath = join(dir, BOARD_FILE)
    let board = await readBoard(boardPath)
    if (!board) {
      board = emptyBoard(Date.now())
      await atomicWrite(boardPath, `${JSON.stringify(board, null, 2)}\n`)
    }

    await writeFile(join(dir, 'AGENTS.md'), boardAgentsDoc(), 'utf8')
    await writeFile(join(dir, 'board.ps1'), BOARD_HELPER_PS1, 'utf8')
    await this.excludeFromGit(target)
    await this.linkRootAgentsDoc(target)

    if (this.root !== target) await this.setRoot(target)
    return board
  }

  async read(root: string): Promise<Board | null> {
    return readBoard(join(resolve(root), BOARD_DIR, BOARD_FILE))
  }

  /**
   * Ghi đè board. Người gọi phải `read` ngay trước đó — bản trong RAM của renderer có
   * thể đã cũ vì một agent vừa ghi vào file.
   */
  async write(root: string, board: Board): Promise<void> {
    const boardPath = join(resolve(root), BOARD_DIR, BOARD_FILE)
    const next: Board = { ...board, updatedAt: Date.now() }
    this.queue = this.queue.then(
      () => atomicWrite(boardPath, `${JSON.stringify(next, null, 2)}\n`),
      () => atomicWrite(boardPath, `${JSON.stringify(next, null, 2)}\n`)
    )
    await this.queue
  }

  async dispose(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    await this.watcher?.close()
    this.watcher = null
  }

  /** `.tspace/` là chuyện riêng của máy này — dùng info/exclude, không đụng .gitignore của repo. */
  private async excludeFromGit(root: string): Promise<void> {
    // Phải hỏi git: trong worktree phụ, `<root>/.git` là một file trỏ đi nơi khác.
    const commonDir = await findGitCommonDir(root)
    if (!commonDir) return

    const excludePath = join(commonDir, 'info', 'exclude')
    try {
      await mkdir(dirname(excludePath), { recursive: true })
      const current = await readFile(excludePath, 'utf8').catch(() => '')
      if (current.split(/\r?\n/).some((line) => line.trim() === `${BOARD_DIR}/`)) return
      const prefix = current.length === 0 || current.endsWith('\n') ? '' : '\n'
      await writeFile(excludePath, `${current}${prefix}${BOARD_DIR}/\n`, 'utf8')
    } catch {
      // Không ghi được thì board vẫn chạy, chỉ là .tspace/ hiện ra trong git status.
    }
  }

  /** Chèn/cập nhật khối có mốc trong AGENTS.md ở gốc worktree. */
  private async linkRootAgentsDoc(root: string): Promise<void> {
    const file = join(root, 'AGENTS.md')
    const begin = '<!-- tspace:board -->'
    const end = '<!-- /tspace:board -->'
    const block = `${begin}\n${ROOT_AGENTS_BLOCK}\n${end}`

    try {
      const current = await readFile(file, 'utf8').catch(() => '')
      if (current.includes(begin) && current.includes(end)) {
        const head = current.slice(0, current.indexOf(begin))
        const tail = current.slice(current.indexOf(end) + end.length)
        await writeFile(file, `${head}${block}${tail}`, 'utf8')
        return
      }
      const prefix = current.length === 0 ? '' : current.endsWith('\n') ? '\n' : '\n\n'
      await writeFile(file, `${current}${prefix}${block}\n`, 'utf8')
    } catch {
      // Không ghi được AGENTS.md thì agent vẫn dùng được board qua .tspace/AGENTS.md.
    }
  }

  private async restartWatcher(): Promise<void> {
    await this.watcher?.close()
    this.watcher = null
    if (!this.root) return

    const boardPath = join(this.root, BOARD_DIR, BOARD_FILE)
    const watcher = chokidar.watch(boardPath, { ignoreInitial: true })
    watcher.on('add', () => this.onChange())
    watcher.on('change', () => this.onChange())
    watcher.on('unlink', () => this.onChange())
    this.watcher = watcher
  }

  /** Agent ghi board bằng tmp + rename nên chokidar bắn nhiều sự kiện liền nhau. */
  private onChange(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.pushBoard()
    }, WATCH_DEBOUNCE_MS)
  }

  private async pushBoard(): Promise<void> {
    if (!this.root || !this.target || this.target.isDestroyed()) return
    const board = await this.read(this.root)
    if (!this.target || this.target.isDestroyed()) return
    this.target.send(IPC.board.changed, board)
  }
}

async function readBoard(boardPath: string): Promise<Board | null> {
  try {
    const raw = await readFile(boardPath, 'utf8')
    // board.ps1 chạy trên PowerShell 5.1 nên file có thể kèm BOM — JSON.parse không nuốt được.
    const parsed = JSON.parse(raw.replace(/^﻿/, '')) as Partial<Board>
    return {
      version: 1,
      updatedAt: parsed.updatedAt ?? 0,
      agents: Array.isArray(parsed.agents) ? parsed.agents : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
    }
  } catch {
    // Không có file, hoặc một agent đang ghi dở và JSON chưa hợp lệ.
    return null
  }
}

async function atomicWrite(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, file)
}

export const boardService = new BoardService()
