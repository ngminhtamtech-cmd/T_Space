import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { app } from 'electron'

/**
 * Lưu output của từng pane ra đĩa để mở lại workspace là thấy nguyên phiên trước —
 * agent CLI (claude, opencode, codex) chat thẳng ra terminal nên đây chính là lịch
 * sử chat của chúng.
 *
 * Khoá theo `paneId` của renderer chứ không phải id PTY: id PTY sinh mới mỗi lần
 * spawn, còn paneId được giữ nguyên trong state.json nên sống qua các lần khởi động.
 */

const FLUSH_INTERVAL_MS = 400
/** Cắt sớm hơn trần một chút để không phải rewrite file sau gần như mọi lần ghi. */
const TRIM_SLACK = 0.25

class TranscriptStore {
  private root: string | null = null
  private enabled = true
  private maxBytes = 1024 * 1024
  private buffers = new Map<string, string>()
  private sizes = new Map<string, number>()
  private flushTimer: NodeJS.Timeout | null = null
  /** Nối tiếp mọi thao tác đĩa để hai lần flush không giẫm lên nhau. */
  private queue: Promise<void> = Promise.resolve()

  setWorkspace(workspaceRoot: string | null): void {
    const next = workspaceRoot ? join(baseDir(), keyFor(workspaceRoot)) : null
    if (next === this.root) return
    // Đổi workspace: xả nốt phần đang đệm vào thư mục cũ rồi mới chuyển.
    this.flushNow()
    this.root = next
    this.sizes.clear()
  }

  setEnabled(enabled: boolean, maxBytes: number): void {
    this.enabled = enabled
    this.maxBytes = Math.max(64 * 1024, maxBytes)
    if (!enabled) {
      this.buffers.clear()
      this.clearTimer()
    }
  }

  append(paneId: string, chunk: string): void {
    if (!this.enabled || !this.root || chunk.length === 0) return
    this.buffers.set(paneId, (this.buffers.get(paneId) ?? '') + chunk)
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flushNow()
    }, FLUSH_INTERVAL_MS)
  }

  async read(paneId: string): Promise<string> {
    const file = this.fileFor(paneId)
    if (!file) return ''
    // Phần đang đệm chưa chạm đĩa cũng thuộc về transcript.
    await this.flushNow()
    try {
      return await readFile(file, 'utf8')
    } catch {
      return ''
    }
  }

  async clear(paneId: string): Promise<void> {
    this.buffers.delete(paneId)
    this.sizes.delete(paneId)
    const file = this.fileFor(paneId)
    if (!file) return
    await rm(file, { force: true }).catch(() => undefined)
  }

  async clearWorkspace(): Promise<void> {
    this.buffers.clear()
    this.sizes.clear()
    if (!this.root) return
    await rm(this.root, { recursive: true, force: true }).catch(() => undefined)
  }

  async dispose(): Promise<void> {
    this.clearTimer()
    await this.flushNow()
  }

  private clearTimer(): void {
    if (!this.flushTimer) return
    clearTimeout(this.flushTimer)
    this.flushTimer = null
  }

  private fileFor(paneId: string): string | null {
    if (!this.root) return null
    // paneId do renderer sinh (`p-…`), vẫn lọc để không thể trỏ ra ngoài thư mục.
    return join(this.root, `${paneId.replace(/[^a-zA-Z0-9_-]/g, '_')}.log`)
  }

  private flushNow(): Promise<void> {
    const root = this.root
    if (!root || this.buffers.size === 0) return this.queue

    const pending = [...this.buffers.entries()]
    this.buffers.clear()

    this.queue = this.queue
      .then(async () => {
        await mkdir(root, { recursive: true })
        for (const [paneId, chunk] of pending) {
          const file = this.fileFor(paneId)
          if (!file) continue
          try {
            await appendFile(file, chunk, 'utf8')
            // Bộ đếm trong RAM để khỏi stat sau mỗi lần ghi; mất dấu thì hỏi lại đĩa.
            const cached = this.sizes.get(paneId)
            const size =
              cached === undefined ? await sizeOf(file) : cached + Buffer.byteLength(chunk)
            this.sizes.set(paneId, size)
            if (size > this.maxBytes) await this.trim(file, paneId)
          } catch {
            // Ghi transcript hỏng không được phép ảnh hưởng tới terminal.
          }
        }
      })
      .catch(() => undefined)

    return this.queue
  }

  /** Giữ phần đuôi, cắt tại ranh giới dòng gần nhất để không vỡ escape sequence giữa chừng. */
  private async trim(file: string, paneId: string): Promise<void> {
    try {
      const keep = Math.floor(this.maxBytes * (1 - TRIM_SLACK))
      const buffer = await readFile(file)
      if (buffer.byteLength <= keep) {
        this.sizes.set(paneId, buffer.byteLength)
        return
      }
      let tail = buffer.subarray(buffer.byteLength - keep)
      const newline = tail.indexOf(0x0a)
      if (newline !== -1 && newline + 1 < tail.byteLength) tail = tail.subarray(newline + 1)

      const tmp = `${file}.tmp`
      await writeFile(tmp, tail)
      await rename(tmp, file)
      this.sizes.set(paneId, tail.byteLength)
    } catch {
      this.sizes.delete(paneId)
    }
  }
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

async function sizeOf(file: string): Promise<number> {
  try {
    return (await stat(file)).size
  } catch {
    return 0
  }
}

export const transcriptStore = new TranscriptStore()
