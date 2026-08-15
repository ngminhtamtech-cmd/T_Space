import { ipcMain, dialog, type BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { PersistedState, SpawnOptions, WorkspaceInfo } from '@shared/types'
import { ptyManager } from '../pty/PtyManager'
import { listShells } from '../pty/shells'
import { fileService } from '../fs/FileService'
import { findGitRoot, getStatus, listWorktrees } from '../git/GitService'
import { loadState, saveState } from '../state/Persist'

export function registerHandlers(window: BrowserWindow): void {
  ptyManager.attach(window.webContents)
  fileService.attach(window.webContents)

  ipcMain.handle(IPC.pty.listShells, () => listShells())
  ipcMain.handle(IPC.pty.spawn, (_e, options: SpawnOptions) => ptyManager.spawn(options))
  ipcMain.on(IPC.pty.write, (_e, paneId: string, data: string) => ptyManager.write(paneId, data))
  ipcMain.on(IPC.pty.resize, (_e, paneId: string, cols: number, rows: number) =>
    ptyManager.resize(paneId, cols, rows)
  )
  ipcMain.handle(IPC.pty.kill, (_e, paneId: string) => ptyManager.kill(paneId))

  ipcMain.handle(IPC.fs.readDir, (_e, dir: string) => fileService.readDir(dir))
  ipcMain.handle(IPC.fs.readFile, (_e, file: string) => fileService.readFileContent(file))
  ipcMain.handle(IPC.fs.writeFile, (_e, file: string, content: string) =>
    fileService.writeFileContent(file, content)
  )
  ipcMain.handle(IPC.fs.createFile, (_e, file: string) => fileService.createFile(file))
  ipcMain.handle(IPC.fs.createDir, (_e, dir: string) => fileService.createDir(dir))
  ipcMain.handle(IPC.fs.rename, (_e, from: string, to: string) => fileService.renameEntry(from, to))
  ipcMain.handle(IPC.fs.trash, (_e, target: string) => fileService.trashEntry(target))
  ipcMain.handle(IPC.fs.revealInExplorer, (_e, target: string) => fileService.reveal(target))

  ipcMain.handle(IPC.workspace.pickFolder, async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Chọn thư mục workspace',
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.workspace.open, async (_e, root: string): Promise<WorkspaceInfo> => {
    await fileService.setRoot(root)
    const resolvedRoot = fileService.getRoot()!
    return { root: resolvedRoot, gitRoot: await findGitRoot(resolvedRoot) }
  })

  ipcMain.handle(IPC.git.status, (_e, gitRoot: string) => getStatus(gitRoot))
  ipcMain.handle(IPC.git.listWorktrees, (_e, gitRoot: string, currentRoot: string) =>
    listWorktrees(gitRoot, currentRoot)
  )

  ipcMain.handle(IPC.state.load, () => loadState())
  ipcMain.handle(IPC.state.save, (_e, state: PersistedState) => saveState(state))
}
