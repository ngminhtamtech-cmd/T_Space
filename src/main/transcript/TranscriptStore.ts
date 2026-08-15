import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { app } from 'electron'

/**
 * Lưu lịch sử phiên của từng pane để mở lại workspace là thấy nguyên nội dung cũ —
 * agent CLI (claude, opencode, codex) chat thẳng ra terminal nên đây chính là lịch
 * sử chat của chúng.
 *
 * Lưu **text đã render**, không phải luồng byte của PTY. ConPTY là giao thức vẽ màn
 * hình chứ không phải luồng text nối tiếp: nó chèn `ESC[2J`, `ESC[H`, `ESC[K` liên
 * tục, cả lúc shell khởi động lẫn lúc thoát. Phát lại byte thô là tự xoá sạch màn
 * hình mình vừa vẽ. Renderer đã có sẵn kết quả emulation trong buffer của xterm nên
 * nó serialize ra text thuần rồi gửi xuống đây.
 *
 * Khoá theo `paneId` của renderer chứ không phải id PTY: id PTY sinh mới mỗi lần
 * spawn, còn paneId được giữ nguyên trong state.json nên sống qua các lần khởi động.
 */

class TranscriptStore {
  private root: string | null = null
  private enabled = true
  private maxBytes = 1024 * 1024
  /** Nối tiếp mọi thao tác đĩa để hai lần ghi không giẫm lên nhau. */
  private queue: Promise<unknown> = Promise.resolve()

  setWorkspace(workspaceRoot: string | null): void {
    this.root = workspaceRoot ? join(baseDir(), keyFor(workspaceRoot)) : null
  }

  setEnabled(enabled: boolean, maxBytes: number): void {
    this.enabled = enabled
    this.maxBytes = Math.max(16 * 1024, maxBytes)
  }

  async save(paneId: string, text: string): Promise<void> {
    const file = this.fileFor(paneId)
    if (!this.enabled || !file) return

    const body = trimToTail(text, this.maxBytes)
    this.queue = this.queue
      .then(async () => {
        await mkdir(dirname(file), { recursive: true })
        const tmp = `${file}.tmp`
        await writeFile(tmp, body, 'utf8')
        await rename(tmp, file)
      })
      .catch(() => undefined)
    await this.queue
  }

  async read(paneId: string): Promise<string> {
    const file = this.fileFor(paneId)
    if (!file) return ''
    try {
      return await readFile(file, 'utf8')
    } catch {
      return ''
    }
  }

  async clear(paneId: string): Promise<void> {
    const file = this.fileFor(paneId)
    if (!file) return
    await rm(file, { force: true }).catch(() => undefined)
  }

  async clearWorkspace(): Promise<void> {
    if (!this.root) return
    await rm(this.root, { recursive: true, force: true }).catch(() => undefined)
  }

  async dispose(): Promise<void> {
    await this.queue.catch(() => undefined)
  }

  private fileFor(paneId: string): string | null {
    if (!this.root) return null
    // paneId do renderer sinh (`p-…`), vẫn lọc để không thể trỏ ra ngoài thư mục.
    return join(this.root, `${paneId.replace(/[^a-zA-Z0-9_-]/g, '_')}.log`)
  }
}

/** Vượt trần thì bỏ phần cũ nhất, cắt tại ranh giới dòng cho gọn. */
function trimToTail(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text
  let tail = Buffer.from(text, 'utf8').subarray(-maxBytes).toString('utf8')
  const newline = tail.indexOf('\n')
  if (newline !== -1) tail = tail.slice(newline + 1)
  return tail
}

function baseDir(): string {
  return join(app.getPath('userData'), 'transcripts')
}

/** Tên thư mục vừa đọc được bằng mắt vừa không đụng nhau giữa hai workspace cùng tên. */
function keyFor(workspaceRoot: string): string {
  const normalized = resolve(workspaceRoot).replace(/\\/g, '/').toLowerCase()
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 8)
  const name = basename(normalized).replace(/[^a-zA-Z0-9_-]/g, '_') || 'workspace'
  return `${name}-${hash}`
}

export const transcriptStore = new TranscriptStore()
