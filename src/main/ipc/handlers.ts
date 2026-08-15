import { ipcMain, dialog, type BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { Board } from '@shared/board'
import type {
  CreateWorktreeOptions,
  PersistedState,
  SpawnOptions,
  WorkspaceInfo
} from '@shared/types'
import { ptyManager } from '../pty/PtyManager'
import { listShells } from '../pty/shells'
import { fileService } from '../fs/FileService'
import { boardService } from '../board/BoardService'
import {
  commitAll,
  createWorktree,
  findGitRoot,
  getStatus,
  listBranches,
  listWorktrees,
  removeWorktree,
  suggestWorktreePath
} from '../git/GitService'
import { loadState, saveState } from '../state/Persist'
import { transcriptStore } from '../transcript/TranscriptStore'

/** Kênh invoke chỉ cho phép một handler; gỡ trước để đăng ký lại không throw. */
function handle(channel: string, listener: Parameters<typeof ipcMain.handle>[1]): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

function on(channel: string, listener: Parameters<typeof ipcMain.on>[1]): void {
  ipcMain.removeAllListeners(channel)
  ipcMain.on(channel, listener)
}

export function registerHandlers(window: BrowserWindow): void {
  ptyManager.attach(window.webContents)
  fileService.attach(window.webContents)
  boardService.attach(window.webContents)

  handle(IPC.pty.listShells, () => listShells())
  handle(IPC.pty.spawn, (_e, options: SpawnOptions) => ptyManager.spawn(options))
  on(IPC.pty.write, (_e, paneId: string, data: string) => ptyManager.write(paneId, data))
  on(IPC.pty.resize, (_e, paneId: string, cols: number, rows: number) =>
    ptyManager.resize(paneId, cols, rows)
  )
  handle(IPC.pty.kill, (_e, paneId: string) => ptyManager.kill(paneId))

  handle(IPC.fs.readDir, (_e, dir: string) => fileService.readDir(dir))
  handle(IPC.fs.readFile, (_e, file: string) => fileService.readFileContent(file))
  handle(IPC.fs.writeFile, (_e, file: string, content: string) =>
    fileService.writeFileContent(file, content)
  )
  handle(IPC.fs.createFile, (_e, file: string) => fileService.createFile(file))
  handle(IPC.fs.createDir, (_e, dir: string) => fileService.createDir(dir))
  handle(IPC.fs.rename, (_e, from: string, to: string) => fileService.renameEntry(from, to))
  handle(IPC.fs.trash, (_e, target: string) => fileService.trashEntry(target))
  handle(IPC.fs.revealInExplorer, (_e, target: string) => fileService.reveal(target))

  handle(IPC.workspace.pickFolder, async (_e, title?: string) => {
    const result = await dialog.showOpenDialog(window, {
      title: title ?? 'Chọn thư mục workspace',
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  handle(IPC.workspace.open, async (_e, root: string): Promise<WorkspaceInfo> => {
    await fileService.setRoot(root)
    const resolvedRoot = fileService.getRoot()!
    // Transcript và board đều bám theo workspace đang mở.
    transcriptStore.setWorkspace(resolvedRoot)
    await boardService.setRoot(resolvedRoot)
    return { root: resolvedRoot, gitRoot: await findGitRoot(resolvedRoot) }
  })

  handle(IPC.git.status, (_e, gitRoot: string) => getStatus(gitRoot))
  handle(IPC.git.listWorktrees, (_e, gitRoot: string, currentRoot: string) =>
    listWorktrees(gitRoot, currentRoot)
  )
  handle(IPC.git.listBranches, (_e, gitRoot: string) => listBranches(gitRoot))
  handle(IPC.git.commitAll, (_e, gitRoot: string, message: string) => commitAll(gitRoot, message))
  handle(IPC.git.createWorktree, (_e, gitRoot: string, options: CreateWorktreeOptions) =>
    createWorktree(gitRoot, options)
  )
  handle(IPC.git.removeWorktree, (_e, gitRoot: string, path: string, force?: boolean) =>
    removeWorktree(gitRoot, path, force)
  )
  handle(IPC.git.suggestWorktreePath, (_e, gitRoot: string, branch: string) =>
    suggestWorktreePath(gitRoot, branch)
  )

  handle(IPC.board.ensure, (_e, root: string) => boardService.ensure(root))
  handle(IPC.board.read, (_e, root: string) => boardService.read(root))
  handle(IPC.board.write, (_e, root: string, board: Board) => boardService.write(root, board))

  handle(IPC.transcript.read, (_e, paneId: string) => transcriptStore.read(paneId))
  handle(IPC.transcript.clear, (_e, paneId: string) => transcriptStore.clear(paneId))
  handle(IPC.transcript.clearWorkspace, () => transcriptStore.clearWorkspace())

  handle(IPC.state.load, () => loadState())
  handle(IPC.state.save, (_e, state: PersistedState) => {
    // Settings đi cùng state nên main biết ngay khi người dùng tắt/bật lưu transcript.
    const behavior = state.settings?.behavior
    if (behavior) transcriptStore.setEnabled(behavior.saveTranscripts, behavior.transcriptMaxBytes)
    return saveState(state)
  })

  on(IPC.window.minimize, () => window.minimize())
  on(IPC.window.toggleMaximize, () => {
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  on(IPC.window.close, () => window.close())
  handle(IPC.window.isMaximized, () => window.isMaximized())

  const pushMaximized = (): void => {
    if (!window.isDestroyed()) window.webContents.send(IPC.window.maximizeChanged, window.isMaximized())
  }
  window.on('maximize', pushMaximized)
  window.on('unmaximize', pushMaximized)
}

const FLUSH_TIMEOUT_MS = 1000

/**
 * Renderer lưu state kiểu debounce 500 ms, nên thay đổi cuối cùng (ẩn sidebar, đổi
 * settings) có thể chưa chạm đĩa lúc người dùng đóng cửa sổ. Bảo nó ghi ngay và chờ,
 * nhưng không chờ quá lâu — thoát app vẫn quan trọng hơn.
 */
export function flushRendererState(window: BrowserWindow): Promise<void> {
  if (window.isDestroyed() || window.webContents.isDestroyed()) return Promise.resolve()

  return new Promise((resolve) => {
    let settled = false
    const done = (): void => {
      if (settled) return
      settled = true
      ipcMain.removeListener(IPC.app.stateFlushed, done)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, FLUSH_TIMEOUT_MS)
    ipcMain.once(IPC.app.stateFlushed, done)
    window.webContents.send(IPC.app.flushState)
  })
}
