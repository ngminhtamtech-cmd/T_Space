import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { Board } from '@shared/board'
import type {
  BranchListInfo,
  CommitResult,
  CreateWorktreeOptions,
  DirEntry,
  FileReadResult,
  FsChangeEvent,
  GitStatusInfo,
  PersistedState,
  PtyDataEvent,
  PtyExitEvent,
  ShellProfile,
  SpawnOptions,
  WorkspaceInfo,
  WorktreeInfo
} from '@shared/types'

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

const api = {
  pty: {
    listShells: (): Promise<ShellProfile[]> => ipcRenderer.invoke(IPC.pty.listShells),
    spawn: (options: SpawnOptions): Promise<string> => ipcRenderer.invoke(IPC.pty.spawn, options),
    write: (paneId: string, data: string): void => ipcRenderer.send(IPC.pty.write, paneId, data),
    resize: (paneId: string, cols: number, rows: number): void =>
      ipcRenderer.send(IPC.pty.resize, paneId, cols, rows),
    kill: (paneId: string): Promise<void> => ipcRenderer.invoke(IPC.pty.kill, paneId),
    onData: (handler: (e: PtyDataEvent) => void): (() => void) =>
      subscribe<PtyDataEvent>(IPC.pty.data, handler),
    onExit: (handler: (e: PtyExitEvent) => void): (() => void) =>
      subscribe<PtyExitEvent>(IPC.pty.exit, handler)
  },
  fs: {
    readDir: (dir: string): Promise<DirEntry[]> => ipcRenderer.invoke(IPC.fs.readDir, dir),
    readFile: (file: string): Promise<FileReadResult> => ipcRenderer.invoke(IPC.fs.readFile, file),
    writeFile: (file: string, content: string): Promise<void> =>
      ipcRenderer.invoke(IPC.fs.writeFile, file, content),
    createFile: (file: string): Promise<void> => ipcRenderer.invoke(IPC.fs.createFile, file),
    createDir: (dir: string): Promise<void> => ipcRenderer.invoke(IPC.fs.createDir, dir),
    rename: (from: string, to: string): Promise<void> =>
      ipcRenderer.invoke(IPC.fs.rename, from, to),
    trash: (target: string): Promise<void> => ipcRenderer.invoke(IPC.fs.trash, target),
    reveal: (target: string): Promise<void> =>
      ipcRenderer.invoke(IPC.fs.revealInExplorer, target),
    onChanged: (handler: (e: FsChangeEvent) => void): (() => void) =>
      subscribe<FsChangeEvent>(IPC.fs.changed, handler)
  },
  workspace: {
    pickFolder: (title?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.workspace.pickFolder, title),
    open: (root: string): Promise<WorkspaceInfo> => ipcRenderer.invoke(IPC.workspace.open, root)
  },
  git: {
    status: (gitRoot: string): Promise<GitStatusInfo> => ipcRenderer.invoke(IPC.git.status, gitRoot),
    listWorktrees: (gitRoot: string, currentRoot: string): Promise<WorktreeInfo[]> =>
      ipcRenderer.invoke(IPC.git.listWorktrees, gitRoot, currentRoot),
    listBranches: (gitRoot: string): Promise<BranchListInfo> =>
      ipcRenderer.invoke(IPC.git.listBranches, gitRoot),
    commitAll: (gitRoot: string, message: string): Promise<CommitResult> =>
      ipcRenderer.invoke(IPC.git.commitAll, gitRoot, message),
    createWorktree: (gitRoot: string, options: CreateWorktreeOptions): Promise<WorktreeInfo> =>
      ipcRenderer.invoke(IPC.git.createWorktree, gitRoot, options),
    removeWorktree: (gitRoot: string, path: string, force?: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.git.removeWorktree, gitRoot, path, force),
    suggestWorktreePath: (gitRoot: string, branch: string): Promise<string> =>
      ipcRenderer.invoke(IPC.git.suggestWorktreePath, gitRoot, branch)
  },
  board: {
    ensure: (root: string): Promise<Board> => ipcRenderer.invoke(IPC.board.ensure, root),
    read: (root: string): Promise<Board | null> => ipcRenderer.invoke(IPC.board.read, root),
    write: (root: string, board: Board): Promise<void> =>
      ipcRenderer.invoke(IPC.board.write, root, board),
    onChanged: (handler: (board: Board | null) => void): (() => void) =>
      subscribe<Board | null>(IPC.board.changed, handler)
  },
  transcript: {
    save: (paneId: string, text: string): Promise<void> =>
      ipcRenderer.invoke(IPC.transcript.save, paneId, text),
    read: (paneId: string): Promise<string> => ipcRenderer.invoke(IPC.transcript.read, paneId),
    clear: (paneId: string): Promise<void> => ipcRenderer.invoke(IPC.transcript.clear, paneId),
    clearWorkspace: (): Promise<void> => ipcRenderer.invoke(IPC.transcript.clearWorkspace)
  },
  state: {
    load: (): Promise<PersistedState> => ipcRenderer.invoke(IPC.state.load),
    save: (state: PersistedState): Promise<void> => ipcRenderer.invoke(IPC.state.save, state)
  },
  app: {
    onFlushState: (handler: () => void): (() => void) =>
      subscribe<void>(IPC.app.flushState, handler),
    stateFlushed: (): void => ipcRenderer.send(IPC.app.stateFlushed)
  },
  window: {
    minimize: (): void => ipcRenderer.send(IPC.window.minimize),
    toggleMaximize: (): void => ipcRenderer.send(IPC.window.toggleMaximize),
    close: (): void => ipcRenderer.send(IPC.window.close),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.window.isMaximized),
    onMaximizeChanged: (handler: (maximized: boolean) => void): (() => void) =>
      subscribe<boolean>(IPC.window.maximizeChanged, handler)
  }
}

export type TSpaceApi = typeof api

contextBridge.exposeInMainWorld('tspace', api)
