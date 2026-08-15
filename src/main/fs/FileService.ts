import { readdir, readFile, writeFile, rename, mkdir, stat, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join, relative, resolve, isAbsolute, sep } from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import { shell, type WebContents } from 'electron'
import { IPC } from '@shared/ipc'
import type { DirEntry, FileReadResult } from '@shared/types'

const MAX_TEXT_BYTES = 2 * 1024 * 1024
const BINARY_SNIFF_BYTES = 8192
const WATCH_DEBOUNCE_MS = 150

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'release', '.next', 'target'])

export class FileService {
  private root: string | null = null
  private watcher: FSWatcher | null = null
  private target: WebContents | null = null
  private pendingDirs = new Set<string>()
  private flushTimer: NodeJS.Timeout | null = null

  attach(webContents: WebContents): void {
    this.target = webContents
  }

  /**
   * Mọi path đến từ renderer phải đi qua đây. Chặn cả path tương đối lẫn path
   * thoát ra ngoài workspace root.
   */
  private guard(input: string): string {
    if (!this.root) throw new Error('Chưa mở workspace nào.')
    if (!isAbsolute(input)) throw new Error(`Path phải là tuyệt đối: ${input}`)

    const target = resolve(input)
    const rel = relative(this.root, target)
    if (rel !== '' && (rel.startsWith('..') || isAbsolute(rel))) {
      throw new Error(`Path nằm ngoài workspace: ${input}`)
    }
    return target
  }

  async setRoot(root: string): Promise<void> {
    const resolved = resolve(root)
    await access(resolved, constants.R_OK)
    this.root = resolved
    await this.restartWatcher()
  }

  getRoot(): string | null {
    return this.root
  }

  async readDir(dirPath: string): Promise<DirEntry[]> {
    const dir = this.guard(dirPath)
    const entries = await readdir(dir, { withFileTypes: true })

    return entries
      .map((entry) => ({
        name: entry.name,
        path: join(dir, entry.name),
        isDirectory: entry.isDirectory() || entry.isSymbolicLink()
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      })
  }

  async readFileContent(filePath: string): Promise<FileReadResult> {
    const target = this.guard(filePath)
    const info = await stat(target)

    if (info.size > MAX_TEXT_BYTES) {
      return { kind: 'tooLarge', path: target, size: info.size }
    }

    const buffer = await readFile(target)
    if (isBinary(buffer)) {
      return { kind: 'binary', path: target, size: info.size }
    }
    return { kind: 'text', content: buffer.toString('utf8'), path: target }
  }

  async writeFileContent(filePath: string, content: string): Promise<void> {
    await writeFile(this.guard(filePath), content, 'utf8')
  }

  async createFile(filePath: string): Promise<void> {
    const target = this.guard(filePath)
    // wx: fail nếu đã tồn tại, tránh ghi đè file người dùng.
    await writeFile(target, '', { encoding: 'utf8', flag: 'wx' })
  }

  async createDir(dirPath: string): Promise<void> {
    await mkdir(this.guard(dirPath), { recursive: false })
  }

  async renameEntry(from: string, to: string): Promise<void> {
    await rename(this.guard(from), this.guard(to))
  }

  /** Xoá vào Recycle Bin, không xoá vĩnh viễn. */
  async trashEntry(targetPath: string): Promise<void> {
    await shell.trashItem(this.guard(targetPath))
  }

  async reveal(targetPath: string): Promise<void> {
    shell.showItemInFolder(this.guard(targetPath))
  }

  async dispose(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = null
    await this.watcher?.close()
    this.watcher = null
  }

  private async restartWatcher(): Promise<void> {
    await this.watcher?.close()
    this.watcher = null
    if (!this.root) return

    this.watcher = chokidar.watch(this.root, {
      ignoreInitial: true,
      depth: 8,
      ignored: (checked: string) =>
        checked.split(sep).some((segment) => IGNORED_DIRS.has(segment))
    })

    const onChange = (changedPath: string): void => {
      this.pendingDirs.add(dirname(changedPath))
      if (this.flushTimer) return
      this.flushTimer = setTimeout(() => this.flushChanges(), WATCH_DEBOUNCE_MS)
    }

    this.watcher
      .on('add', onChange)
      .on('unlink', onChange)
      .on('addDir', onChange)
      .on('unlinkDir', onChange)
      .on('change', onChange)
  }

  private flushChanges(): void {
    this.flushTimer = null
    const dirs = [...this.pendingDirs]
    this.pendingDirs.clear()
    if (!this.target || this.target.isDestroyed()) return
    for (const dir of dirs) {
      this.target.send(IPC.fs.changed, { dir })
    }
  }
}

function isBinary(buffer: Buffer): boolean {
  const limit = Math.min(buffer.length, BINARY_SNIFF_BYTES)
  for (let i = 0; i < limit; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

export const fileService = new FileService()
